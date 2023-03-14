import { query } from "./db.js";

let res_items = await fetch("https://api.warframe.market/v1/items").then(
  (response) => {
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    return response.json();
  }
);

const items = res_items["payload"]["items"];

console.log(`There are ${items.length} items.`);

// sleep before next api request
await new Promise((resolve) => setTimeout(resolve, 1000));

let counter = 0;
let max_requests = 9999;

while (counter < max_requests) {
  const db_item = {
    id: null,
    url_name: "",
    name: "",
    wiki_link: "",
  };

  const item = items[counter + 0];

  // get item info
  const item_url = `https://api.warframe.market/v1/items/${item["url_name"]}`;

  const item_details_res = await fetch(item_url).then((response) => {
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    return response.json();
  });

  const item_details_obj = item_details_res["payload"]["item"];

  // DEBUG
  console.log(item_details_obj);

  const items_in_set = item_details_obj["items_in_set"];

  let item_details = items_in_set.filter(
    (i) => i["id"] === item_details_obj["id"]
  );

  if (item_details.length !== 1) {
    throw new Error("Problem finding item in set");
  }

  item_details = item_details[0];

  // DEBUG
  console.log(item_details["tags"]);

  const item_tags = item_details["tags"];

  db_item["id"] = item_details["id"];
  db_item["url_name"] = item["url_name"];
  db_item["name"] = item_details["en"]["item_name"];
  db_item["wiki_link"] = item_details["en"]["wiki_link"];
  db_item["component"] = item_tags.includes("component");
  db_item["set"] = item_tags.includes("set");
  db_item["prime"] = item_tags.includes("prime");
  db_item["ducats"] = item_details["ducats"] || 0;
  db_item["blueprint"] = item_tags.includes("blueprint");
  db_item["syndicate"] = item_tags.includes("syndicate");
  db_item["primary_weapon"] =
    item_tags.includes("primary") && !item_tags.includes("mod");
  db_item["secondary_weapon"] =
    item_tags.includes("secondary") && !item_tags.includes("mod");
  db_item["melee_weapon"] =
    item_tags.includes("melee") && !item_tags.includes("mod");
  db_item["archwing"] = item_tags.includes("archwing");
  db_item["warframe"] = item_tags.includes("warframe") && db_item["prime"];
  db_item["mod"] = item_tags.includes("mod");
  db_item["arcane"] = item_tags.includes("arcane_enhancement");
  db_item["skin"] = item_tags.includes("skin");
  db_item["lens"] = item_tags.includes("lens");
  db_item["riven"] = item_tags.includes("riven_mod");
  db_item["misc"] = item_tags.includes("misc") || item_tags.includes("scene");

  // need lens, riven_mod, misc (scene, misc)

  const query_res = await query(
    `INSERT INTO items(
      id, url_name, name, wiki_link, component, set, prime, ducats,
      blueprint, syndicate, primary_weapon, secondary_weapon, melee_weapon,
      archwing, warframe, mod, arcane, skin, lens, riven, misc)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17, $18, $19, $20, $21)
      ON CONFLICT (id) DO NOTHING
      RETURNING *`,
    [
      db_item["id"],
      db_item["url_name"],
      db_item["name"],
      db_item["wiki_link"],
      db_item["component"],
      db_item["set"],
      db_item["prime"],
      db_item["ducats"],
      db_item["blueprint"],
      db_item["syndicate"],
      db_item["primary_weapon"],
      db_item["secondary_weapon"],
      db_item["melee_weapon"],
      db_item["archwing"],
      db_item["warframe"],
      db_item["mod"],
      db_item["arcane"],
      db_item["skin"],
      db_item["lens"],
      db_item["riven"],
      db_item["misc"],
    ]
  );

  counter++;

  // sleep before next api request
  await new Promise((resolve) => setTimeout(resolve, 500));
}

/* let res = await fetch("https://api.warframe.market/v1/items/eidolon_vazarin_lens/orders").then((response) => {
    if(!response.ok) {
        throw new Error(`HTTP error: ${response.status}`)
    }

    return response.json()
})

let orders = res["payload"]["orders"]

orders = orders.filter(order => {
    return order["order_type"] === "sell" && order["user"]["status"] === "ingame"
})

const prices = []

orders.forEach(order => {
    for (let i=0; i<order.quantity; i++) {
        prices.push(order["platinum"])
    }
})

prices.sort((a, b) => (a - b));

console.log(prices) */
