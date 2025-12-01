import { render } from "preact";
import { App } from "./video-pop-app";
import { ShopifyCart, ShopifyProduct } from "./types/types";
import { ApiContextProvider } from "./lib/api";
import { VideoPopContextProvider } from "./context/VideoPopContext";
import { GAEventsProvider } from "./context/GoogleAnalytics";
import { CleverTapEventsProvider } from "./context/ClevertapAnalytics";
import { MetaEventsProvider } from "./context/MetaEventsContext";

type InstasellVideoPopEmbedConfig = {
  element: HTMLElement;
  playlistId?: string;
  widgetType: "shoppable-reels" | "live";
  addToCart: (
    variantId: string,
    via: "REELS" | "LIVE",
    handle: string,
    orderAttributionToken: string
  ) => Promise<void>;
  getProductDetailsBySlug: (slug: string) => Promise<ShopifyProduct>;
  getCurrentCart: () => Promise<ShopifyCart>;
  getCurrentCartId: () => Promise<string>;
  getCurrencyCode: () => string;
  getShopDomain: () => string;
  getCurrencyRate: () => number;
  redirectToCart: () => void;
  getCountry: () => string;
  skeletonLength: number;
  getPageType: () => "home" | "product" | "collection";
  getActiveProductPageId: (() => string) | null;
  updateCartInfo: (orderAttributionToken: string) => Promise<void>;
  showFeedOnHomePageOnly: boolean;
  currentProductId?: string;
  currentCollectionId?: string;
  pageType: "home" | "product" | "collection";
  fetchProductDetails: (productHandle: string) => Promise<any | null>;
  getProductImages: (productData: any) => string[];
};

const getStoreRoot = () => {
  return (window as any).Shopify?.routes?.root || "/";
};

const woocommerceRoot = getStoreRoot();

const defaultConfig: InstasellVideoPopEmbedConfig = {
  element: document.querySelector("#instasell-live-short-videos")!,
  widgetType: "shoppable-reels",
  async addToCart(variantId, _via, handle, orderAttributionToken) {
    await fetch(woocommerceRoot + "products/" + handle + ".js")
      .then((res) => res.json())
      .catch((error) => {
        console.log(`%cError fetching product: ${error}`, "color: red;");
      });

    const addToCartResponse = await fetch(woocommerceRoot + "cart/add.json", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [
          {
            id: variantId,
            quantity: 1,
          },
        ],
      }),
    });

    if (!addToCartResponse.ok) {
      throw new Error("Failed to add to cart");
    }

    return addToCartResponse.json();
  },
  async updateCartInfo(orderAttributionToken) {
    const storeRoot = woocommerceRoot;

    const addToCartResponse = await fetch(storeRoot + "cart/update.json", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        attributes: {
          instavid_attribution_token: orderAttributionToken,
        },
      }),
    });

    if (!addToCartResponse.ok) {
      throw new Error("Failed to add to cart");
    }

    return addToCartResponse.json();
  },
  async getCurrentCart() {
    const response = await fetch(woocommerceRoot + "cart.json");
    if (!response.ok) {
      throw new Error("Failed to get cart");
    }
    return response.json();
  },
  async getCurrentCartId() {
    return await fetch(woocommerceRoot + "cart.json")
      .then((res) => res.json())
      .then((res) => res.token)
      .catch((error) => console.log(error));
  },
  async getProductDetailsBySlug(slug) {
    return await fetch(woocommerceRoot + "/products/" + slug + ".js")
      .then((res) => res.json())
      .catch((error) => console.log(error));
  },
  getCurrencyCode() {
    return (window as any).Shopify?.currency?.active || "USD";
  },
  getShopDomain() {
    return (window as any).Shopify?.shop || window.location.host;
  },
  getCurrencyRate() {
    return (window as any).Shopify?.currency?.rate || 1;
  },
  redirectToCart() {
    window.location.href = "/cart";
  },
  getCountry() {
    return (window as any).Shopify?.country || "";
  },
  skeletonLength: 6,
  getPageType() {
    if (
      location.pathname.startsWith("/products/") ||
      (location.pathname.includes("/collections/") &&
        location.pathname.includes("/products/"))
    ) {
      return "product";
    } else if (location.pathname.startsWith("/collections/")) {
      return "collection";
    } else {
      return "home";
    }
  },
  getActiveProductPageId: null,
  showFeedOnHomePageOnly: false,
  pageType: null as never,
  async fetchProductDetails(productHandle: string): Promise<any | null> {
    try {
      const storeRoot = getStoreRoot();
      const response = await fetch(`${storeRoot}products/${productHandle}.js`);

      if (!response.ok) {
        throw new Error(`Failed to fetch product: ${response.status}`);
      }

      const productData = await response.json();
      return productData;
    } catch (error) {
      console.log(`%cError fetching product details: ${error}`, "color: red;");
      return null;
    }
  },
  getProductImages(productData: any): string[] {
    if (!productData || !productData.images) {
      return [];
    }

    // Convert relative URLs to absolute URLs
    return productData.images.map((imageUrl: string) => {
      if (imageUrl.startsWith("//")) {
        return `https:${imageUrl}`;
      }
      return imageUrl;
    });
  },
};

defaultConfig.pageType = defaultConfig.getPageType();

const getVideoPopConfig = (): InstasellVideoPopEmbedConfig => {
  const globalConfig = (window as any).__INSTASELL_VIDEO_POP_CONFIG__;

  if (!globalConfig) {
    throw new Error(
      "[Instasell] WooCommerce video pop config not found. Ensure the plugin injected __INSTASELL_VIDEO_POP_CONFIG__."
    );
  }

  return { ...defaultConfig, ...globalConfig };
};

export const instasellVideoPopEmbedConfig = getVideoPopConfig();

let maybePromise = Promise.resolve();

if (
  defaultConfig.pageType == "product" &&
  !(window as any).__INSTASELL_VIDEO_POP_CONFIG__?.currentProductId
) {
  const handle = window.location.pathname
    .split("/")
    .filter((part) => part != "")
    .reverse()[0];
  maybePromise = fetch(`/products/${handle}.json`)
    .then((r) => r.json())
    .then((resp) => {
      const { id } = resp.product;
      defaultConfig.currentProductId = String(id);
    })
    .catch(() => {
      defaultConfig.pageType = "home";
    });
} else if (
  defaultConfig.pageType == "collection" &&
  !(window as any).__INSTASELL_VIDEO_POP_CONFIG__?.currentCollectionId
) {
  const handle = window.location.pathname
    .split("/")
    .filter((part) => part != "")[1];
  maybePromise = fetch(`/collections/${handle}.json`)
    .then((r) => r.json())
    .then((resp) => {
      const { id } = resp.collection;
      defaultConfig.currentCollectionId = String(id);
    })
    .catch(() => {
      defaultConfig.pageType = "home";
    });
}

maybePromise.then(() => {
  render(
    <ApiContextProvider>
      <VideoPopContextProvider>
        <GAEventsProvider>
          <CleverTapEventsProvider>
            <MetaEventsProvider>
              <App />
            </MetaEventsProvider>
          </CleverTapEventsProvider>
        </GAEventsProvider>
      </VideoPopContextProvider>
    </ApiContextProvider>,
    document.getElementById("instasell-live-video-pop") as HTMLElement
  );
});
