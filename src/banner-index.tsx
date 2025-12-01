import { render } from "preact";
import { App } from "./banner-app";
import { ShopifyCart, ShopifyProduct } from "./types/types";
import { ApiContextProvider, standardApiClient } from "./lib/api";
import { GAEventsProvider } from "./context/GoogleAnalytics";
import { CleverTapEventsProvider } from "./context/ClevertapAnalytics";
import { GetVideoBannersExistParams } from "./types/api";
import { BannerModalContextProvider } from "./context/VideoBannerContext";
import { MetaEventsProvider } from "./context/MetaEventsContext";

type InstasellBannerEmbedConfig = {
  element: HTMLElement;
  addToCart: (
    variantId: string,
    via: "BANNER",
    handle: string,
    orderAttributionToken: string
  ) => Promise<void>;
  getProductDetailsBySlug: (slug: string) => Promise<ShopifyProduct>;
  getCurrentCart: () => Promise<ShopifyCart>;
  getCurrentCartId: () => Promise<string>;
  getCurrencyCode: () => string;
  getShopDomain: () => string;
  getCurrencyRate: () => number;
  getCountry: () => string;
  redirectToCart: () => void;
  updateCartInfo: (orderAttributionToken: string) => Promise<void>;
  skeletonLength: number;
  getPageType: () => "home" | "product" | "collection";
  getActiveProductPageId: (() => string) | null;
  currentProductId?: string;
  currentCollectionId?: string;
  pageType: "home" | "product" | "collection";
};

const getStoreRoot = () => {
  return (window as any).Shopify?.routes?.root || "/";
};

const defaultConfig: InstasellBannerEmbedConfig = {
  element: document.querySelector("#instasell-banner")!,
  async addToCart(variantId, _via, handle, orderAttributionToken) {
    const storeRoot = getStoreRoot();
    await fetch(storeRoot + "products/" + handle + ".js")
      .then((res) => res.json())
      .catch((error) => {
        console.log(`%cError fetching product: ${error}`, "color: red;");
      });

    try {
      const addToCartResponse = await fetch(storeRoot + "cart/add.json", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: [{ id: variantId, quantity: 1 }],
          attributes: {
            instavid_attribution_token: orderAttributionToken,
          },
        }),
      });

      if (!addToCartResponse.ok) {
        console.log(`%cFailed to updated cart`, "color: red;");
      }
      return addToCartResponse.json();
    } catch (error) {
      console.log(`%cFailed to updated cart ${error}`, "color: red;");
    }
  },
  async updateCartInfo(orderAttributionToken) {
    try {
      const storeRoot = getStoreRoot();
      const response = await fetch(storeRoot + "cart/update.json", {
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
      if (!response.ok) {
        console.log(`%cFailed to updated cart`, "color: red;");
      }
      return response.json();
    } catch (error) {
      console.log(`%cFailed to updated cart ${error}`, "color: red;");
    }
  },
  async getCurrentCart() {
    try {
      const storeRoot = getStoreRoot();
      const response = await fetch(storeRoot + "cart.json");
      if (!response.ok) {
        console.log(`%cFailed to get cart`, "color: red;");
      }
      return response.json();
    } catch (error) {
      console.log(`%cFailed to get cart ${error}`, "color: red;");
    }
  },
  async getCurrentCartId() {
    const storeRoot = getStoreRoot();
    return await fetch(storeRoot + "cart.json")
      .then((res) => res.json())
      .then((res) => res.token)
      .catch((error) => console.log(`%c${error}`, "color: red;"));
  },
  async getProductDetailsBySlug(slug) {
    const storeRoot = getStoreRoot();
    return await fetch(storeRoot + "products/" + slug + ".js")
      .then((res) => res.json())
      .catch((error) => console.log(`%c${error}`, "color: red;"));
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
  getCountry() {
    return (window as any).Shopify?.country || "US";
  },
  redirectToCart() {
    window.location.href = "/cart";
  },
  skeletonLength: 1,
  getPageType() {
    if (location.pathname.includes("/products/")) {
      return "product";
    } else if (location.pathname.startsWith("/collections/")) {
      return "collection";
    }
    return "home";
  },
  getActiveProductPageId: null,
  pageType: "home",
  currentProductId: undefined,
  currentCollectionId: undefined,
};

const getConfig = (): InstasellBannerEmbedConfig => {
  const globalConfig = (window as any).__INSTASELL_BANNER_CONFIG__;

  if (!globalConfig) {
    throw new Error(
      "[Instasell] WooCommerce banner config not found. Ensure the plugin injected __INSTASELL_BANNER_CONFIG__."
    );
  }

  return { ...defaultConfig, ...globalConfig };
};

export const instasellBannerEmbedConfig = getConfig();

const createContainer = (id: string): HTMLElement => {
  let container = document.getElementById(id);
  if (!container) {
    container = document.createElement("div");
    container.id = id;
    document.body.appendChild(container);
  }
  return container;
};

const api = standardApiClient;

async function checkBannersExist(
  pageType: string,
  config: InstasellBannerEmbedConfig
): Promise<boolean> {
  const params: GetVideoBannersExistParams = {
    pageType: pageType as "home" | "product" | "collection",
    originFqdn: instasellBannerEmbedConfig.getShopDomain?.(),
  };

  if (pageType === "product" && config.currentProductId) {
    params.currentProductId = config.currentProductId;
  } else if (pageType === "collection" && config.currentCollectionId) {
    params.currentCollectionId = config.currentCollectionId;
  }

  const exists = await api.checkVideoBannersExist(params);
  return exists;
}

const initializeApp = async () => {
  const config = getConfig();
  const bannersExist = await checkBannersExist(config.pageType, config);

  if (!bannersExist) {
    document
      .querySelectorAll(
        '[id^="instasell-banner-"], #instasell-live-video-banner'
      )
      .forEach((el) => ((el as HTMLElement).style.display = "none"));
    return;
  }

  // Find all banner containers (both specific and default)
  const bannerContainers = document.querySelectorAll(
    '[id^="instasell-banner-"], #instasell-live-video-banner'
  );

  if (bannerContainers.length === 0) {
    // Create default container if none exist
    const container = createContainer("instasell-live-video-banner");
    renderApp(container);
  } else {
    // Initialize each banner container
    bannerContainers.forEach((container) => {
      const bannerName =
        container.getAttribute("data-banner-name") || "Banner 1";
      renderApp(container, {
        bannerName,
        elementId: container.id,
      });
    });
  }
};

function renderApp(
  container: Element,
  bannerData?: { bannerName: string; elementId: string }
) {
  render(
    <ApiContextProvider>
      <CleverTapEventsProvider>
        <GAEventsProvider>
          <MetaEventsProvider>
            <BannerModalContextProvider>
              <App bannerData={bannerData} loadImmediately={false} />
            </BannerModalContextProvider>
          </MetaEventsProvider>
        </GAEventsProvider>
      </CleverTapEventsProvider>
    </ApiContextProvider>,
    container
  );
}

const waitForConfig = () => {
  const config = getConfig();
  if (config.pageType) {
    initializeApp();
  } else {
    setTimeout(waitForConfig, 100);
  }
};

waitForConfig();
