import { render } from "preact";
import { App } from "./story-reels-app";
import { StoryVideosModalContextProvider } from "./context/StoryVideosModalContext";
import { ShopifyCart, ShopifyProduct } from "./types/types";
import { ApiContextProvider, standardApiClient, useApi } from "./lib/api";
import { GAEventsProvider } from "./context/GoogleAnalytics";
import { MAIN_API_BASE_URL } from "./lib/constants";
import { GetStoriesExistParams } from "./types/api";
import { CleverTapEventsProvider } from "./context/ClevertapAnalytics";
import { MetaEventsProvider } from "./context/MetaEventsContext";

type InstasellStoryEmbedConfig = {
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
  getPageType: () => "home" | "product" | "collection" | "customPage";
  getActiveProductPageId: (() => string) | null;
  updateCartInfo: (orderAttributionToken: string) => Promise<void>;
  showFeedOnHomePageOnly: boolean;
  currentProductId?: string;
  currentCollectionId?: string;
  pageType: "home" | "product" | "collection" | "customPage";
  fetchProductDetails: (productHandle: string) => Promise<any | null>;
  getProductImages: (productData: any) => string[];
};

const shopifyRoot = (window as any).Shopify?.routes.root;

const defaultConfig: InstasellStoryEmbedConfig = {
  element: document.querySelector("#instasell-live-short-videos")!,
  widgetType: "shoppable-reels",
  async addToCart(variantId, _via, handle, orderAttributionToken) {
    await fetch(shopifyRoot + "products/" + handle + ".js")
      .then((res) => res.json())
      .catch((error) => {
        console.log(`%cError fetching product: ${error}`, "color: red;");
      });

    const addToCartResponse = await fetch(shopifyRoot + "cart/add.json", {
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
    const storeRoot = shopifyRoot;

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
    const response = await fetch(shopifyRoot + "cart.json");
    if (!response.ok) {
      throw new Error("Failed to get cart");
    }
    return response.json();
  },
  async getCurrentCartId() {
    return await fetch(shopifyRoot + "cart.json")
      .then((res) => res.json())
      .then((res) => res.token)
      .catch((error) => console.log(`%c${error}`, "color: red;"));
  },
  async getProductDetailsBySlug(slug) {
    return await fetch(shopifyRoot + "/products/" + slug + ".js")
      .then((res) => res.json())
      .catch((error) => console.log(`%c${error}`, "color: red;"));
  },
  getCurrencyCode() {
    return (window as any).Shopify?.currency.active;
  },
  getCountry() {
    return (window as any).Shopify?.country;
  },
  getShopDomain() {
    return (window as any).Shopify?.shop;
  },
  getCurrencyRate() {
    return (window as any).Shopify?.currency.rate;
  },
  redirectToCart() {
    window.location.href = "/cart";
  },
  skeletonLength: 6,
  getPageType() {
    if ((window as any).__custom_page) {
      return "customPage";
    } else if (
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
  currentProductId: undefined,
  currentCollectionId: undefined,
  async fetchProductDetails(productHandle: string): Promise<any | null> {
    try {
      const storeRoot = (window as any).Shopify?.routes?.root || "/";
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

const getStoryConfig = (): InstasellStoryEmbedConfig => {
  const globalConfig = (window as any).__INSTASELL_STORY_CONFIG__;

  if (!globalConfig) {
    throw new Error(
      "[Instasell] WooCommerce story config not found. Ensure the plugin injected __INSTASELL_STORY_CONFIG__."
    );
  }

  return { ...defaultConfig, ...globalConfig };
};

export const instasellStoryEmbedConfig = getStoryConfig();

const api = standardApiClient;

async function checkStoriesExist(
  config: InstasellStoryEmbedConfig,
  isHighlight: boolean = false,
  customPageRoute: string
): Promise<boolean> {
  const params: GetStoriesExistParams = {
    pageType: config.pageType,
    originFqdn: config.getShopDomain(),
    isHighlight: isHighlight,
    customPageRoute: customPageRoute,
  };

  if (config.pageType == "home") {
    return await api.checkStoriesExist(params);
  }

  if (config.pageType == "product") {
    params.pageId =
      config.currentProductId ??
      ((window as any).__st &&
        (window as any).__st.p === "product" &&
        (window as any).__st.rid);
  } else if (config.pageType == "collection") {
    params.pageId =
      config.currentCollectionId ??
      ((window as any).__st &&
        (window as any).__st.p === "collection" &&
        (window as any).__st.rid);
  }

  return await api.checkStoriesExist(params);
}

const findStoryContainer = (): HTMLElement | null => {
  const standardContainer = document.getElementById(
    "instasell-live-story-reels"
  );
  if (standardContainer) return standardContainer;

  const dynamicContainers = document.querySelectorAll(
    '[id^="instasell-story-"]'
  );
  if (dynamicContainers.length > 0) {
    return dynamicContainers[0] as HTMLElement;
  }

  return null;
};

const initializeApp = async () => {
  const config = instasellStoryEmbedConfig;
  const container = findStoryContainer();

  if (!container) {
    console.log(`%cStory reels container not found`, "color: red;");
    return;
  }
  // Check for data-highlight attribute
  const isHighlight = container.dataset.highlight === "true";
  // Check for data-story-name attribute
  const storyName =
    container.dataset.storyName || (isHighlight ? "Highlight 1" : "Story 1");
  let contentExists = false;
  try {
    contentExists = await checkStoriesExist(config, isHighlight, storyName);
  } catch (error) {
    console.log(`%cError checking stories exist: ${error}`, "color: red;");
    // Hide container when check fails
    if (container) {
      container.style.display = "none";
    }
    return;
  }

  if (!contentExists) {
    if (container) {
      container.style.display = "none";
    }
    return;
  }

  render(
    <ApiContextProvider>
      <StoryVideosModalContextProvider>
        <CleverTapEventsProvider>
          <GAEventsProvider>
            <MetaEventsProvider>
              <App storyName={storyName} />
            </MetaEventsProvider>
          </GAEventsProvider>
        </CleverTapEventsProvider>
      </StoryVideosModalContextProvider>
    </ApiContextProvider>,
    container
  );
};

initializeApp();
