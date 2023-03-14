import { query } from "./db.js";
import { mean, median, std, min, max } from "mathjs";
import { groupBy, some, take } from "lodash-es";
import { getMaxValue } from "./outliers.js";

// Get items from db
const query_items = await query(
  "SELECT id, url_name, last_scrape FROM items ORDER BY last_scrape ASC NULLS FIRST"
);

let counter = 0;
let max_requests = 9999;

console.log(`Starting getPrices for ${query_items.rows.length} items.`);

while (counter < Math.min(query_items.rows.length, max_requests)) {
  const currentItemId = query_items.rows[counter].id;
  const currentItemUrl = query_items.rows[counter].url_name;

  console.log(currentItemUrl);

  const item_orders_url = `https://api.warframe.market/v1/items/${currentItemUrl}/orders`;

  // Get orders info for item from WF market
  const item_orders_res = await fetch(item_orders_url).then((response) => {
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    return response.json();
  });

  const item_orders_obj = item_orders_res["payload"]["orders"];

  // only sell orders and only ingame users
  const item_sell_orders = item_orders_obj.filter(
    (i) => i.order_type === "sell" && i.user.status === "ingame"
  );

  // check if any orders exist
  if (item_sell_orders.length === 0) {
    // If no orders, just update the database with null's mostly
    updateDatabase(currentItemId, currentItemUrl);
  } else {
    // If order includes a "mod_rank" property, we need to group
    // on this to have more accurate price data

    if (some(item_sell_orders, "mod_rank")) {
      const grouped_item_sell_orders = groupBy(
        item_sell_orders,
        ({ mod_rank }) => mod_rank
      );

      // console.log(grouped_item_sell_orders);

      for (const [rank, rank_orders] of Object.entries(
        grouped_item_sell_orders
      )) {
        console.log(`Mod_rank = ${rank}`);
        const stats = getStatistics(rank_orders);
        updateDatabase(
          currentItemId,
          currentItemUrl,
          stats.number_of_sellers,
          stats.quantity_available,
          stats.mean_price,
          stats.median_price,
          stats.stddev_price,
          stats.min_price,
          stats.max_price,
          stats.avg_listed_time,
          stats.avg_listed_time_new_3,
          Number(rank)
        );

        // sleep before next api request
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    } else {
      // no mod_rank

      const stats = getStatistics(item_sell_orders);

      updateDatabase(
        currentItemId,
        currentItemUrl,
        stats.number_of_sellers,
        stats.quantity_available,
        stats.mean_price,
        stats.median_price,
        stats.stddev_price,
        stats.min_price,
        stats.max_price,
        stats.avg_listed_time,
        stats.avg_listed_time_new_3
      );
    }
  }

  counter++;

  // sleep before next api request
  await new Promise((resolve) => setTimeout(resolve, 500));
}

function getStatistics(ordersArray) {
  // Statistics
  let raw_number_of_sellers = 0;
  let raw_quantity_available = 0;
  const raw_distribution = [];
  let number_of_sellers = 0;
  let quantity_available = 0;
  const distribution = [];
  let mean_price = null;
  let median_price = null;
  let stddev_price = null;
  let min_price = null;
  let max_price = null;
  const since_created = [];
  let avg_listed_time = null;
  let avg_listed_time_new_3 = null;

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
    median_price = median(raw_distribution).toFixed(2);
    stddev_price = std(raw_distribution).toFixed(2);
    min_price = min(raw_distribution);
    max_price = max(raw_distribution);
  }

  // Remove outliers and recompute
  ordersArray.forEach((seller) => {
    const price = seller.platinum;

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
    median_price = median(distribution).toFixed(2);
    stddev_price = std(distribution).toFixed(2);
    min_price = min(distribution);
    max_price = max(distribution);
    avg_listed_time = mean(since_created).toFixed(2);
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
    Std (filtered) = ${stddev_price}
    Min (filtered) = ${min_price}
    Max (filtered) = ${max_price}
    Avg Listed Time (filtered) = ${avg_listed_time}
    Avg Listed Time New 3 (filtered) = ${avg_listed_time_new_3}
    `);
  Performance;

  return {
    number_of_sellers,
    quantity_available,
    mean_price,
    median_price,
    stddev_price,
    min_price,
    max_price,
    avg_listed_time,
    avg_listed_time_new_3,
  };
}

async function updateDatabase(
  itemId,
  itemUrlName,
  number_of_sellers = 0,
  quantity_available = 0,
  mean_price = null,
  median_price = null,
  stddev_price = null,
  min_price = null,
  max_price = null,
  avg_listed_time = null,
  avg_listed_time_new_3 = null,
  rank = null
) {
  // Add to database
  const query_insert = await query(
    "INSERT INTO item_sell_data(item_id, date, item_url_name, number_of_sellers, quantity_available, mean_price, median_price, stddev_price, min_price, max_price, avg_listed_time, avg_listed_time_new_3, rank) VALUES ($1, CURRENT_TIMESTAMP, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING date",
    [
      itemId,
      itemUrlName,
      number_of_sellers,
      quantity_available,
      mean_price,
      median_price,
      stddev_price,
      min_price,
      max_price,
      avg_listed_time,
      avg_listed_time_new_3,
      rank,
    ]
  );

  const inserted_date = query_insert.rows[0].date;

  console.log(inserted_date);

  // Update item in database to show last scrape and ++number of scrapes
  await query(
    "UPDATE items SET last_scrape = $1, number_of_scrapes = number_of_scrapes + 1 WHERE id = $2",
    [inserted_date, itemId]
  );
}

function getHoursOld(date) {
  const created_time = new Date(date);
  const now = new Date();
  const diffTime = Math.abs(now - created_time);
  const diffHours = diffTime / (1000 * 60 * 60);
  return diffHours;
}
