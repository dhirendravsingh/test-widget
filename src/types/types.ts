export type ShopifyCart = {
  token: string;
  note: string;
  attributes: { [key: string]: string };
  total_price: number;
  total_weight: number;
  item_count: number;
  items: {
    id: number;
    properties: { [key: string]: string };
    quantity: number;
    variant_id: number;
    key: string;
    title: string;
    price: number;
    line_price: number;
    final_price: number;
    final_line_price: number;
    sku: string | null;
    grams: number;
    vendor: string;
    taxable: boolean;
    product_id: number;
    product_has_only_default_variant: boolean;
    gift_card: boolean;
    url: string;
    featured_image: {
      url: string;
      aspect_ratio: number;
      alt: string;
    };
    image: string;
    handle: string;
    requires_shipping: boolean;
    product_title: string;
    product_description: string;
    product_type: string;
    variant_title: string;
    variant_options: string[];
    options_with_values: {
      name: string;
      value: string;
    }[];
  }[];
  requires_shipping: boolean;
  currency: string;
  items_subtotal_price: number;
  // Todo: update this when handling coupons
  cart_level_discount_applications: null;
};

export type ShopifyProduct = {
  id: number;
  title: string;
  handle: string;
  description: string;
  published_at: string;
  created_at: string;
  vendor: string;
  type: string;
  tags: string[] | null;
  price: number;
  price_min: number;
  price_max: number;
  available: boolean;
  price_varies: boolean;
  compare_at_price: number | null;
  compare_at_price_min: number | null;
  compare_at_price_max: number | null;
  compare_at_price_varies: boolean;
  variants: {
    id: number;
    title: string;
    options: string[];
    option1: string | null;
    option2: string | null;
    option3: string | null;
    price: number;
    weight: number;
    compare_at_price: number | null;
    inventory_management: string;
    available: boolean;
    sku: string | null;
    requires_shipping: boolean;
    taxable: boolean;
    barcode: string | null;
  }[];
  images: string[];
  featured_image: string[];
  options: [
    {
      name: string;
      position: number;
    }
  ];
  url: string;
};
