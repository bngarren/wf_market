import { NumericDictionary } from "lodash"

export type Item = {
    id: string,
    url_name: string,
    name: string,
    wiki_link: string,
    component: boolean,
    set: boolean,
    prime: boolean,
    blueprint: boolean,
    syndicate: boolean,
    primary_weapon: boolean,
    secondary_weapon: boolean,
    warframe: boolean,
    melee_weapon: boolean,
    mod: boolean,
    arcane: boolean,
    archwing: boolean,
    ducats: number,
    skin: boolean,
    lens: boolean,
    riven: boolean,
    misc: boolean,
    last_scrape: string | null,
    number_of_scrapes: number,
}

export type ItemOrderData = {
    item_id: string,
    number_of_sellers: number,
    quantity_available: number,
    mean_price: number | null,
    median_price: number | null,
    std_price: number | null,
    min_price: number | null,
    max_price: number | null,
    min_3_price_avg: number | null,
    item_url_name: string,
    rank: number | null,
    avg_listed_time: number | null,
    std_listed_time: number | null,
    avg_listed_time_new_3: number | null
}

export type SetComponent = {
    item_id: string,
    set_root_id: string,
    quantity: number
}