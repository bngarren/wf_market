import { ItemOrderData } from "./types/db/index.js";
import { WFM_Item, WFM_ItemOrder } from "./types/wfm/index.js";
import { query } from "./db.js";
import { mean, median, std, min, max } from "mathjs";
import { groupBy, some, take } from "lodash-es";
import { getMaxValue } from "./outliers.js";

// Get items from db
const query_items = await query("SELECT id, url_name, last_scrape FROM items ORDER BY last_scrape ASC NULLS FIRST");

const db_items: WFM_Item[] = query_items.rows;

const startTime = process.hrtime();
let counter = 0;
let max_requests = 9999;
let errors: {}[] = [];

console.log(`Starting getPrices for ${db_items.length} items.`);

while (counter < Math.min(db_items.length, max_requests)) {
  const currentItemId = db_items[counter].id;
  const currentItemUrl = db_items[counter].url_name;

  console.log(`#${counter + 1} - ${currentItemUrl}`);

  const item_orders_url = `https://api.warframe.market/v1/items/${currentItemUrl}/orders`;

  // Get orders info for item from WF market
  const item_orders_res = await fetch(item_orders_url);

  if (!item_orders_res.ok) {
    console.error(`HTTP error: ${item_orders_res.status}`);
    errors.push({
      item_name_url: currentItemUrl,
      error: item_orders_res.status,
    });
    // skip this item
    continue;
  }

  const item_orders_json = await item_orders_res.json();

  // @ts-ignore
  const item_orders_obj: WFM_ItemOrder[] = item_orders_json["payload"]["orders"];

  // only sell orders and only ingame users
  const item_sell_orders = item_orders_obj.filter((i) => i.order_type === "sell" && i.user.status === "ingame");

  // check if any orders exist
  if (item_sell_orders.length === 0) {
    // If no orders, just update the database with null's mostly
    updateDatabase({ item_id: currentItemId, item_url_name: currentItemUrl });
  } else {
    // If order includes a "mod_rank" property, we need to group
    // on this to have more accurate price data

    if (some(item_sell_orders, "mod_rank")) {
      const grouped_item_sell_orders = groupBy(item_sell_orders, ({ mod_rank }) => mod_rank);

      // console.log(grouped_item_sell_orders);

      for (const [rank, rank_orders] of Object.entries(grouped_item_sell_orders)) {
        if (!rank) {
          throw new Error("missing mod_rank");
        }

        console.log(`Mod_rank = ${rank}`);
        const stats = getStatistics(rank_orders);
        updateDatabase({
          item_id: currentItemId,
          item_url_name: currentItemUrl,
          rank: Number(rank),
          number_of_sellers: stats.number_of_sellers,
          quantity_available: stats.quantity_available,
          mean_price: stats.mean_price,
          median_price: stats.median_price,
          std_price: stats.std_price,
          min_price: stats.min_price,
          max_price: stats.max_price,
          min_3_price_avg: stats.min_3_price_avg,
          avg_listed_time: stats.avg_listed_time,
          std_listed_time: stats.std_listed_time,
          avg_listed_time_new_3: stats.avg_listed_time_new_3,
        });

        // sleep before next api request
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    } else {
      // no mod_rank

      const stats = getStatistics(item_sell_orders);

      updateDatabase({
        item_id: currentItemId,
        item_url_name: currentItemUrl,
        number_of_sellers: stats.number_of_sellers,
        quantity_available: stats.quantity_available,
        mean_price: stats.mean_price,
        median_price: stats.median_price,
        std_price: stats.std_price,
        min_price: stats.min_price,
        max_price: stats.max_price,
        min_3_price_avg: stats.min_3_price_avg,
        avg_listed_time: stats.avg_listed_time,
        std_listed_time: stats.std_listed_time,
        avg_listed_time_new_3: stats.avg_listed_time_new_3,
      });
    }
  }

  counter++;

  // sleep before next api request
  await new Promise((resolve) => setTimeout(resolve, 500));
}

process.on("beforeExit", (code) => {
  const elapsedTime = Math.floor((process.hrtime()[0] - startTime[0]) / 60);
  console.log("Process beforeExit event with code: ", code);
  console.log(`Successfully indexed ${counter - errors.length} items in ${elapsedTime} minutes.`);

  if (errors.length > 0) {
    console.log(`There were ${errors.length} errors:
    ${errors}`);
  }
});

function getStatistics(ordersArray: WFM_ItemOrder[]) {
  // Statistics
  let raw_number_of_sellers = 0;
  let raw_quantity_available = 0;
  const raw_distribution: number[] = [];
  let number_of_sellers = 0;
  let quantity_available = 0;
  const distribution: number[] = [];
  let mean_price: number | null = null;
  let median_price: number | null = null;
  let std_price: number | null = null;
  let min_price: number | null = null;
  let max_price: number | null = null;
  const since_created: number[] = [];
  let min_3_price_avg: number | null = null;
  let avg_listed_time: number | null = null;
  let std_listed_time: number | null = null;
  let skew_listed_time: number | null = null;
  let avg_listed_time_new_3: number | null = null;

  // Get raw distribution
  ordersArray.forEach((seller) => {
    // unique seller +1
    raw_number_of_sellers++;

    // how many are they selling
    raw_quantity_available += seller.quantity;

    // add each price for each unit they're selling
    [...Array(seller.quantity)].forEach((unit) => {
      raw_distribution.push(seller.platinum);
    });
  });

  raw_distribution.sort((a, b) => a - b);

  if (raw_distribution.length > 0) {
    mean_price = mean(raw_distribution).toFixed(2);
    median_price = Number(median(raw_distribution).toFixed(2));
    std_price = getStd(raw_distribution);
    min_price = min(raw_distribution);
    max_price = max(raw_distribution);
  }

  // Remove outliers and recompute
  ordersArray.forEach((seller) => {
    const price = seller.platinum;

    // max = 25th percentile
    const maxValue = getMaxValue(raw_distribution);

    if (price > maxValue) {
      return;
    }

    // unique seller +1
    number_of_sellers++;

    // time since listed (created)
    const diffHours = getHoursOld(seller.creation_date);
    since_created.push(diffHours);

    // how many are they selling?
    //   *will set a max of 10 here so that people who put in 999
    //   *won't skew the data too much
    quantity_available += Math.min(seller.quantity, 10);

    // add each price for each unit they're selling
    [...Array(Math.min(seller.quantity, 10))].forEach((unit) => {
      distribution.push(seller.platinum);
    });
  });

  distribution.sort((a, b) => a - b);

  if (distribution.length > 0) {
    mean_price = mean(distribution).toFixed(2);
    median_price = Number(median(distribution).toFixed(2));
    std_price = getStd(distribution);
    min_price = min(distribution);
    max_price = max(distribution);
    min_3_price_avg = mean([...new Set(distribution)].sort((a, b) => a - b).slice(0, 3)).toFixed(1); // only unique prices
    avg_listed_time = mean(since_created).toFixed(2);
    std_listed_time = getStd(since_created);
    avg_listed_time_new_3 = mean(
      take(
        since_created.sort((a, b) => a - b),
        3
      )
    ).toFixed(2);
  }

  console.log(`
    Number of sellers = ${raw_number_of_sellers} (raw) ${number_of_sellers} (filtered)
    Quantity available = ${raw_quantity_available} (raw) ${quantity_available} (filtered)
    Distribution (raw) = ${raw_distribution}
    Distribution (filtered) = ${distribution}
    Mean (filtered) = ${mean_price}
    Median (filtered) = ${median_price}
    Std (filtered) = ${std_price}
    Min (filtered) = ${min_price}
    Max (filtered) = ${max_price}
    Min 3 Avg (filtered) = ${min_3_price_avg}
    Listed Times (filtered) = ${since_created}
    Avg Listed Time (filtered) = ${avg_listed_time}
    Std Listed Time (filtered) = ${std_listed_time}
    Avg Listed Time New 3 (filtered) = ${avg_listed_time_new_3}
    `);
  Performance;

  return {
    number_of_sellers,
    quantity_available,
    mean_price,
    median_price,
    std_price,
    min_price,
    max_price,
    min_3_price_avg,
    avg_listed_time,
    std_listed_time,
    avg_listed_time_new_3,
  };
}

async function updateDatabase({
  item_id,
  item_url_name,
  rank = null,
  number_of_sellers = 0,
  quantity_available = 0,
  mean_price = null,
  median_price = null,
  std_price = null,
  min_price = null,
  max_price = null,
  min_3_price_avg = null,
  avg_listed_time = null,
  std_listed_time = null,
  avg_listed_time_new_3 = null,
}: Partial<ItemOrderData>) {
  // Add to database
  const query_insert = await query(
    "INSERT INTO item_sell_data(item_id, date, item_url_name, rank, number_of_sellers, quantity_available, mean_price, median_price, std_price, min_price, max_price, min_3_price_avg, avg_listed_time, std_listed_time, avg_listed_time_new_3) VALUES ($1, CURRENT_TIMESTAMP, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING date",
    [
      item_id,
      item_url_name,
      rank,
      number_of_sellers,
      quantity_available,
      mean_price,
      median_price,
      std_price,
      min_price,
      max_price,
      min_3_price_avg,
      avg_listed_time,
      std_listed_time,
      avg_listed_time_new_3,
    ]
  );

  const inserted_date = query_insert.rows[0].date;

  console.log(inserted_date);

  // Update item in database to show last scrape and ++number of scrapes
  await query("UPDATE items SET last_scrape = $1, number_of_scrapes = number_of_scrapes + 1 WHERE id = $2", [
    inserted_date,
    item_id,
  ]);
}

function getStd(arr: number[]) {
  const res = std(arr);
  // @ts-ignore
  return Number(res.toFixed(2));
}

function getHoursOld(date: string) {
  const created_time = new Date(date).getTime();
  const now = new Date().getTime();
  const diffTime = Math.abs(now - created_time);
  const diffHours = diffTime / (1000 * 60 * 60);
  return diffHours;
}
