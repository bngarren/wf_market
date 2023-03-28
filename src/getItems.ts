import { query } from "./db.js";
import { WFM_Item, WFM_ItemDetails } from "./types/wfm/index.js";
import { Item, SetComponent } from "./types/db/index.js";

// Get list of items from WF market
let res_items = await fetch("https://api.warframe.market/v1/items").then((response) => {
  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  return response.json();
});

const items: WFM_Item[] = res_items["payload"]["items"];

console.log(`There are ${items.length} items.`);

// Done getting list of items from WFM
// sleep before next api request
await new Promise((resolve) => setTimeout(resolve, 500));

let counter = 0;
let max_requests = 9999;

while (counter < Math.min(items.length, max_requests)) {
  /**
   * Item to be inserted into the database
   */
  const db_item: Partial<Item> = {};

  const item = items[counter];

  // Get Item details from WFM
  const item_url = `https://api.warframe.market/v1/items/${item["url_name"]}`;

  const item_details_res = await fetch(item_url).then((response) => {
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    return response.json();
  });

  const item_details_obj: WFM_ItemDetails = item_details_res["payload"]["item"];

  // !DEBUG
  console.log(item_details_obj);

  const items_in_set = item_details_obj["items_in_set"];

  // "Our item" is somewhere within the "items_in_set" array that is returned
  let item_details = items_in_set.find((i) => i["id"] === item_details_obj["id"]);

  if (!item_details) {
    throw new Error("Problem finding item in set");
  }

  // If this item is a set root item, e.g. mag_prime_set,
  // get the set information from "items_in_set"
  if (items_in_set.length > 1 && item_details["set_root"] === true) {
    const set_root_id = item_details["id"];
    // Loop through each non-root item in the set and add it to the db
    await Promise.all(
      items_in_set.map(async (set_item) => {
        if (set_item["set_root"] === true) return;

        const db_set_component: Partial<SetComponent> = {};

        db_set_component["item_id"] = set_item["id"];
        db_set_component["set_root_id"] = set_root_id;
        db_set_component["quantity"] = set_item["quantity_for_set"];

        const query_res2 = await query(
          `INSERT INTO set_components(
          item_id, set_root_id, quantity)
          VALUES ($1, $2, $3)
          ON CONFLICT (item_id) DO NOTHING
          RETURNING *`,
          [db_set_component["item_id"], db_set_component["set_root_id"], db_set_component["quantity"]]
        );
      })
    );
  }

  // !DEBUG
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
  db_item["primary_weapon"] = item_tags.includes("primary") && !item_tags.includes("mod");
  db_item["secondary_weapon"] = item_tags.includes("secondary") && !item_tags.includes("mod");
  db_item["melee_weapon"] = item_tags.includes("melee") && !item_tags.includes("mod");
  db_item["archwing"] = item_tags.includes("archwing");
  db_item["warframe"] = item_tags.includes("warframe") && db_item["prime"];
  db_item["mod"] = item_tags.includes("mod");
  db_item["arcane"] = item_tags.includes("arcane_enhancement");
  db_item["skin"] = item_tags.includes("skin");
  db_item["lens"] = item_tags.includes("lens");
  db_item["riven"] = item_tags.includes("riven_mod");
  db_item["misc"] = item_tags.includes("misc") || item_tags.includes("scene");

  // Do the database insert operation into 'items' table
  const query_res1 = await query(
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
