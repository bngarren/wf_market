export type WFM_Item = {
  id: string;
  url_name: string;
  thumb: string;
  item_name: string;
};

export type WFM_ItemDetails = {
    id: string;
    items_in_set: {
        id: string,
        url_name: string,
        tags: string[],
        ducats: number,
        set_root: boolean,
        quantity_for_set: number,
        en: {
            item_name: string,
            description: string,
            wiki_link: string,
        }
    }[]
};

export type WFM_ItemOrder = {
    id: string,
    platinum: number,
    quantity: number,
    order_type: "sell" | "buy",
    creation_date: "string",
    user: {
        id: string,
        status: string,

    }
    mod_rank?: number
}
