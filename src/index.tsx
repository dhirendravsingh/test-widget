import { render } from "preact";
import { App } from "./app";
import { ShopifyCart, ShopifyProduct } from "./types/types";
import { ShortVideosModalContextProvider } from "./context/ShortVideosModalContext";
import { ApiContextProvider, standardApiClient } from "./lib/api";
import { GAEventsProvider } from "./context/GoogleAnalytics";
import { GetVideosExistParams } from "./types/api";
import { CleverTapEventsProvider } from "./context/ClevertapAnalytics";
import { MetaEventsProvider } from "./context/MetaEventsContext";

// Define the carousel config type
type CarouselConfig = {
  elementId: string;
  name: string;
  isTestimonial?: boolean;
};

let isVideoPop = false;
let hasDefaultVideoPipOnProductOrCollectionPage = false;

// Define the config type
type InstasellLiveEmbedConfig = {
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
  getCountry: () => string;
  redirectToCart: () => void;
  updateCartInfo: (orderAttributionToken: string) => Promise<void>;
  skeletonLength: number;
  getPageType: () => "home" | "product" | "collection";
  getActiveProductPageId: (() => string) | null;
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

const defaultConfig: InstasellLiveEmbedConfig = {
  element: document.querySelector("#instasell-live-short-videos")!,
  widgetType: "shoppable-reels",
  async addToCart(variantId, _via, handle, orderAttributionToken) {
    const storeRoot = getStoreRoot();

    await fetch(storeRoot + "products/" + handle + ".js")
      .then((res) => res.json())
      .catch((error) => {
        console.log(`%cError fetching product: ${error}`, "color: red;");
      });

    const addToCartResponse = await fetch(storeRoot + "cart/add.json", {
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
    const storeRoot = getStoreRoot();

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
    const storeRoot = getStoreRoot();
    const response = await fetch(storeRoot + "cart.json");
    if (!response.ok) {
      throw new Error("Failed to get cart");
    }
    return response.json();
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
    return (window as any).Shopify?.currency?.active || "INR";
  },
  getShopDomain() {
    return (window as any).Shopify?.shop || window.location.host;
  },
  getCurrencyRate() {
    return (window as any).Shopify?.currency?.rate || 1;
  },
  getCountry() {
    return (window as any).Shopify?.country;
  },
  redirectToCart() {
    if ((window as any).Shopify.shop === "hyphen-mcaffeine.myshopify.com") {
      window.location.href = "/?return_link=cart";
    } else {
      window.location.href = "/cart";
    }
  },
  skeletonLength: 6,
  getPageType() {
    if (
      location.pathname.startsWith("/products/") ||
      (location.pathname.includes("/collections/") &&
        location.pathname.includes("/products/")) ||
      location.pathname.includes("/products/")
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
  pageType: "home",
  playlistId: undefined,
  currentProductId: undefined,
  currentCollectionId: undefined,
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

const getConfig = (): InstasellLiveEmbedConfig => {
  const globalConfig = (window as any).__INSTASELL_LIVE_CONFIG__;

  if (!globalConfig) {
    throw new Error(
      "[Instasell] WooCommerce config not found. Ensure the plugin injected __INSTASELL_LIVE_CONFIG__."
    );
  }

  return { ...defaultConfig, ...globalConfig };
};

export const instasellLiveEmbedConfig = getConfig();

const createContainer = (): HTMLElement => {
  let container = document.getElementById("instasell-live-short-videos");

  if (!container) {
    container = document.createElement("div");
    container.id = "instasell-live-short-videos";
    document.body.appendChild(container);
  }

  return container;
};

const api = standardApiClient;

async function checkVideosExist(
  pageType: string,
  config: InstasellLiveEmbedConfig
): Promise<boolean> {
  if (pageType === "home") {
    return true;
  }

  const params: GetVideosExistParams = {
    pageType: pageType as "home" | "product" | "collection",
    originFqdn: config.getShopDomain(),
  };

  if ((window as any).isMockup) {
    return true;
  }

  if (
    (pageType === "product" && config.currentProductId) ||
    (pageType === "collection" && config.currentCollectionId)
  ) {
    if (pageType === "product") {
      params.currentProductId = config.currentProductId;
    } else {
      params.currentCollectionId = config.currentCollectionId;
    }

    try {
      const { exists, isSingleVideo, hasDefaultVideoPip } =
        await api.checkVideosExist(params);
      console.log("IsSingleVideo-1: " + isSingleVideo);

      if (isSingleVideo !== undefined) {
        isVideoPop = isSingleVideo;
      }

      if (hasDefaultVideoPip !== undefined) {
        hasDefaultVideoPipOnProductOrCollectionPage = hasDefaultVideoPip;
      }

      return exists;
    } catch (error) {
      // Silently handle errors and return false
      console.log("Error checking videos exist:", error);
      return false;
    }
  }

  return true;
}

const initializeApp = async () => {
  try {
    const config = getConfig();
    const videosExist = await checkVideosExist(config.pageType, config);

    if (!videosExist) {
      // Hide heading for specific shop when there are no videos
      if (config.getShopDomain() === "rasayanam.myshopify.com") {
        const headings = document.querySelectorAll(
          ".rich-text__heading.rte.inline-richtext.ct_video_head.center.h1"
        );
        headings.forEach((el) => {
          const parent = (el as HTMLElement)
            .parentElement as HTMLElement | null;
          if (parent) {
            parent.style.display = "none";
          }
        });
      }
      document
        .querySelectorAll(
          '[id^="instasell-carousel"], #instasell-live-short-videos'
        )
        .forEach((el) => ((el as HTMLElement).style.height = "0"));
      return;
    }
    if ((window as any).isMockup) {
      const carouselContainers = document.querySelectorAll(
        '[id^="instasell-carousel-"]'
      );

      carouselContainers.forEach((container) => {
        const carouselName =
          container.getAttribute("data-carousel-name") || "Homepage 1";
        const isTestimonial =
          container.getAttribute("data-testimonial") === "true";

        render(
          <ApiContextProvider>
            <CleverTapEventsProvider>
              <GAEventsProvider>
                <MetaEventsProvider>
                  <ShortVideosModalContextProvider>
                    <App
                      carouselData={{
                        carouselName,
                        elementId: container.id,
                        isTestimonial,
                      }}
                      loadImmediately={false}
                    />
                  </ShortVideosModalContextProvider>
                </MetaEventsProvider>
              </GAEventsProvider>
            </CleverTapEventsProvider>
          </ApiContextProvider>,
          container
        );
      });
    } else if (
      config.pageType === "product" ||
      config.pageType === "collection"
    ) {
      console.log("isVideoPop: " + isVideoPop);

      const containers = document.querySelectorAll(
        "#instasell-live-short-videos"
      );

      if (containers.length === 0) {
        const container = createContainer();

        render(
          <ApiContextProvider>
            <CleverTapEventsProvider>
              <GAEventsProvider>
                <ShortVideosModalContextProvider>
                  <MetaEventsProvider>
                    <App
                      loadImmediately={
                        hasDefaultVideoPipOnProductOrCollectionPage
                      }
                    />
                  </MetaEventsProvider>
                </ShortVideosModalContextProvider>
              </GAEventsProvider>
            </CleverTapEventsProvider>
          </ApiContextProvider>,
          container
        );
      } else {
        containers.forEach((container) => {
          render(
            <ApiContextProvider>
              <CleverTapEventsProvider>
                <GAEventsProvider>
                  <MetaEventsProvider>
                    <ShortVideosModalContextProvider>
                      <App
                        loadImmediately={
                          hasDefaultVideoPipOnProductOrCollectionPage
                        }
                      />
                    </ShortVideosModalContextProvider>
                  </MetaEventsProvider>
                </GAEventsProvider>
              </CleverTapEventsProvider>
            </ApiContextProvider>,
            container
          );
        });
      }
    } else {
      const carouselContainers = document.querySelectorAll(
        '[id^="instasell-carousel-"]'
      );

      if (carouselContainers.length === 0) {
        const defaultContainer = document.getElementById(
          "instasell-live-short-videos"
        );

        if (defaultContainer) {
          const isTestimonial =
            defaultContainer.getAttribute("data-testimonial") === "true";
          render(
            <ApiContextProvider>
              <CleverTapEventsProvider>
                <GAEventsProvider>
                  <MetaEventsProvider>
                    <ShortVideosModalContextProvider>
                      <App
                        carouselData={{
                          carouselName: "Homepage 1",
                          elementId: "instasell-live-short-videos",
                          isTestimonial,
                        }}
                        loadImmediately={false}
                      />
                    </ShortVideosModalContextProvider>
                  </MetaEventsProvider>
                </GAEventsProvider>
              </CleverTapEventsProvider>
            </ApiContextProvider>,
            defaultContainer
          );
        } else {
          const container = createContainer();

          render(
            <ApiContextProvider>
              <CleverTapEventsProvider>
                <GAEventsProvider>
                  <MetaEventsProvider>
                    <ShortVideosModalContextProvider>
                      <App
                        loadImmediately={
                          hasDefaultVideoPipOnProductOrCollectionPage
                        }
                      />
                    </ShortVideosModalContextProvider>
                  </MetaEventsProvider>
                </GAEventsProvider>
              </CleverTapEventsProvider>
            </ApiContextProvider>,
            container
          );
        }
      } else {
        carouselContainers.forEach((container) => {
          const carouselName =
            container.getAttribute("data-carousel-name") || "Homepage 1";
          const isTestimonial =
            container.getAttribute("data-testimonial") === "true";

          render(
            <ApiContextProvider>
              <CleverTapEventsProvider>
                <GAEventsProvider>
                  <MetaEventsProvider>
                    <ShortVideosModalContextProvider>
                      <App
                        carouselData={{
                          carouselName,
                          elementId: container.id,
                          isTestimonial,
                        }}
                        loadImmediately={false}
                      />
                    </ShortVideosModalContextProvider>
                  </MetaEventsProvider>
                </GAEventsProvider>
              </CleverTapEventsProvider>
            </ApiContextProvider>,
            container
          );
        });
      }
    }
  } catch (error) {
    console.log("Error initializing app:", error);
  }
};

const waitForConfig = () => {
  const config = getConfig();

  if (config.pageType) {
    (async () => {
      try {
        await initializeApp();
      } catch (error) {
        console.log(`%c${error}`, "color: red;");
      }
    })();
  } else {
    setTimeout(waitForConfig, 100);
  }
};

waitForConfig();
