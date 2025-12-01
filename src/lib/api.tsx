import { createContext } from "preact";
import { useContext, useMemo } from "preact/hooks";
import { memo } from "preact/compat";
import { MAIN_API_BASE_URL } from "./constants";
import {
  GetShortVideosRequestBody,
  GetShortVideosResponse,
  GetStoriesRequestBody,
  ShortVideosBoronRequestBody,
  ShortVideosBoronResponse,
  GetProductDetailsResponse,
  GetViewerTokenResponse,
  ShortVideo,
  GetVideosExistParams,
  GetStoriesExistParams,
  GetVideoPopRestResponse,
  GetHighlightsResponse,
  GetHighlightsParams,
  GetVideoBannersResponse,
  GetVideoBannersExistParams,
  GetStoryReelsResponse,
} from "../types/api";

// Shopify Cart Types
export interface ShopifyCartResponse {
  data: {
    cartCreate: {
      cart: {
        id: string;
        createdAt: string;
        lines: {
          edges: Array<{
            node: {
              id: string;
              quantity: number;
              merchandise: {
                id: string;
                title: string;
                sku?: string;
                price: {
                  amount: string;
                  currencyCode: string;
                };
                product: {
                  id: string;
                  handle: string;
                  title: string;
                };
              };
            };
          }>;
        };
        estimatedCost: {
          totalAmount: {
            amount: string;
            currencyCode: string;
          };
        };
        attributes: Array<{
          key: string;
          value: string;
        }>;
      };
      userErrors: Array<{
        field: string[];
        message: string;
      }>;
    };
  };
}

export interface ShopifyCartAddResponse {
  data: {
    cartLinesAdd: {
      cart: {
        id: string;
        lines: {
          edges: Array<{
            node: {
              id: string;
              quantity: number;
              merchandise: {
                id: string;
                title: string;
                sku?: string;
                price: {
                  amount: string;
                  currencyCode: string;
                };
                product: {
                  id: string;
                  handle: string;
                  title: string;
                };
              };
            };
          }>;
        };
        estimatedCost: {
          totalAmount: {
            amount: string;
            currencyCode: string;
          };
        };
        attributes: Array<{
          key: string;
          value: string;
        }>;
      };
      userErrors: Array<{
        field: string[];
        message: string;
      }>;
    };
  };
}

export interface CreateCartParams {
  productVariantId: string;
  quantity?: number;
  attributionToken?: string;
  countryCode?: string;
  customAttributes?: Array<{ key: string; value: string }>;
  shopDomain: string;
  storefrontAccessToken: string;
}

export interface AddItemToCartParams {
  cartId: string;
  productVariantId: string;
  quantity?: number;
  attributionToken?: string;
  customAttributes?: Array<{ key: string; value: string }>;
  shopDomain: string;
  storefrontAccessToken: string;
}

export interface CheckStockParams {
  productId: string;
  variantId: string;
}

export interface IApiService {
  /**
   * Get short videos using the rest api
   */
  getShortVideos(params: {
    originFqdn: string;
    pageType: "home" | "product" | "collection";
    currentProductId?: string;
    currentCollectionId?: string;
  }): Promise<GetShortVideosResponse>;

  /**
   * Get video banners using the rest api
   */
  getVideoBanners(params: {
    originFqdn: string;
    pageType: "home" | "product" | "collection";
    currentProductId?: string;
    currentCollectionId?: string;
  }): Promise<GetVideoBannersResponse>;

  /**
   * Check if video banners exist for the given page
   */
  checkVideoBannersExist(params: GetVideoBannersExistParams): Promise<boolean>;

  /**
   * Send a boron event to server
   */
  shortVideosBoron(
    body: ShortVideosBoronRequestBody
  ): Promise<ShortVideosBoronResponse>;

  /**
   * Get detailed product information
   */
  getProductDetails(productId: string): Promise<GetProductDetailsResponse>;

  /**
   * Get story videos using the rest api
   */
  getStories(params: {
    originFqdn: string;
    pageType: "home" | "product" | "collection" | "customPage";
    pageId: string;
    customPageRoute?: string;
  }): Promise<GetStoryReelsResponse>;

  /**
   * Get highlights using the rest api
   */
  getHighlights(params: {
    originFqdn: string;
    pageType: "home" | "product" | "collection" | "customPage";
    pageId: string;
  }): Promise<GetHighlightsResponse>;

  getViewerToken(params: {
    originFqdn: string;
  }): Promise<GetViewerTokenResponse>;

  getLibraryVideos(params: {
    originFqdn: string;
    viewerToken?: string;
  }): Promise<ShortVideo[]>;

  /**
   * Check if videos exist for at least one carousel
   */
  checkVideosExist(params: GetVideosExistParams): Promise<{
    exists: boolean;
    isSingleVideo?: boolean;
    hasDefaultVideoPip?: boolean;
  }>;

  /**
   * Check if stories exist for the given page
   */
  checkStoriesExist(params: GetStoriesExistParams): Promise<boolean>;

  /**
   * Get VideoPop using the rest api
   */
  getVideoPop(params: {
    originFqdn: string;
    pageType: "home" | "product" | "collection";
    currentProductId?: string;
    currentCollectionId?: string;
  }): Promise<GetVideoPopRestResponse>;

  /**
   * Create a new Shopify cart with attribution
   */
  createCartWithAttribution(params: CreateCartParams): Promise<string>;

  /**
   * Add item to existing Shopify cart
   */
  addItemToCartWithAttribution(params: AddItemToCartParams): Promise<string>;

  /**
   * Check product/variant stock availability
   */
  checkStock(params: CheckStockParams): Promise<string>;
}

export const ApiContext = createContext<IApiService>(null as never);

export class ApiService implements IApiService {
  private readonly shopifyApiVersion = "2025-01";

  private async shopifyGraphQL(
    query: string,
    variables: Record<string, any>,
    shopDomain: string,
    storefrontAccessToken: string
  ) {
    const response = await fetch(
      `https://${shopDomain}/api/${this.shopifyApiVersion}/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Storefront-Access-Token": storefrontAccessToken,
        },
        body: JSON.stringify({
          query,
          variables,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(
        `Shopify GraphQL request failed: ${response.status} ${response.statusText}`
      );
    }

    return response.json();
  }

  async createCartWithAttribution({
    productVariantId,
    quantity = 1,
    attributionToken,
    countryCode = "IN",
    customAttributes = [],
    shopDomain,
    storefrontAccessToken,
  }: CreateCartParams): Promise<string> {
    const query = `
      mutation createCart($cartInput: CartInput!, $country: CountryCode!) @inContext(country: $country) {
        cartCreate(input: $cartInput) {
          cart {
            id
            createdAt
            lines(first: 10) {
              edges {
                node {
                  id
                  quantity
                  merchandise {
                    ... on ProductVariant {
                      id
                      title
                      sku
                      price {
                        amount
                        currencyCode
                      }
                      product {
                        id
                        handle
                        title
                      }
                    }
                  }
                }
              }
            }
            estimatedCost {
              totalAmount {
                amount
                currencyCode
              }
            }
            attributes {
              key
              value
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    // Build attributes array
    const attributes = [...customAttributes];
    if (attributionToken) {
      attributes.push({
        key: "instavid_attribution_token",
        value: attributionToken,
      });
    }

    const variables = {
      country: countryCode,
      cartInput: {
        buyerIdentity: {
          countryCode,
        },
        ...(attributes.length > 0 && { attributes }),
        lines: [
          {
            quantity,
            merchandiseId: productVariantId,
          },
        ],
      },
    };

    const response: ShopifyCartResponse = await this.shopifyGraphQL(
      query,
      variables,
      shopDomain,
      storefrontAccessToken
    );

    if (response.data.cartCreate.userErrors.length > 0) {
      throw new Error(
        `Cart creation failed: ${JSON.stringify(
          response.data.cartCreate.userErrors
        )}`
      );
    }

    return response.data.cartCreate.cart.id;
  }

  async addItemToCartWithAttribution({
    cartId,
    productVariantId,
    quantity = 1,
    attributionToken,
    customAttributes = [],
    shopDomain,
    storefrontAccessToken,
  }: AddItemToCartParams): Promise<string> {
    const query = `
      mutation addItemToCart($cartId: ID!, $lines: [CartLineInput!]!) {
        cartLinesAdd(cartId: $cartId, lines: $lines) {
          cart {
            id
            lines(first: 20) {
              edges {
                node {
                  id
                  quantity
                  merchandise {
                    ... on ProductVariant {
                      id
                      title
                      sku
                      price {
                        amount
                        currencyCode
                      }
                      product {
                        id
                        handle
                        title
                      }
                    }
                  }
                }
              }
            }
            estimatedCost {
              totalAmount {
                amount
                currencyCode
              }
            }
            attributes {
              key
              value
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    // Build line item attributes
    const lineAttributes = [...customAttributes];

    const variables = {
      cartId,
      lines: [
        {
          merchandiseId: productVariantId,
          quantity,
          ...(lineAttributes.length > 0 && { attributes: lineAttributes }),
        },
      ],
    };

    const response: ShopifyCartAddResponse = await this.shopifyGraphQL(
      query,
      variables,
      shopDomain,
      storefrontAccessToken
    );

    if (response.data.cartLinesAdd.userErrors.length > 0) {
      throw new Error(
        `Add to cart failed: ${JSON.stringify(
          response.data.cartLinesAdd.userErrors
        )}`
      );
    }

    // If we need to update cart-level attribution token, do it separately
    if (attributionToken) {
      await this.updateCartAttributes(
        cartId,
        [
          {
            key: "instavid_attribution_token",
            value: attributionToken,
          },
        ],
        shopDomain,
        storefrontAccessToken
      );
    }

    return response.data.cartLinesAdd.cart.id;
  }

  private async updateCartAttributes(
    cartId: string,
    attributes: Array<{ key: string; value: string }>,
    shopDomain: string,
    accessToken: string
  ) {
    const query = `
      mutation updateCartAttributes($cartId: ID!, $attributes: [AttributeInput!]!) {
        cartAttributesUpdate(cartId: $cartId, attributes: $attributes) {
          cart {
            id
            attributes {
              key
              value
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      cartId,
      attributes,
    };

    const response = await this.shopifyGraphQL(
      query,
      variables,
      shopDomain,
      accessToken
    );

    if (response.data.cartAttributesUpdate.userErrors.length > 0) {
      throw new Error(
        `Cart attributes update failed: ${JSON.stringify(
          response.data.cartAttributesUpdate.userErrors
        )}`
      );
    }

    return response.data.cartAttributesUpdate.cart;
  }

  async getShortVideos({
    originFqdn,
    pageType,
    currentProductId,
    currentCollectionId,
  }: {
    originFqdn: string;
    pageType: "home" | "product" | "collection";
    currentProductId?: string;
    currentCollectionId?: string;
  }): Promise<GetShortVideosResponse> {
    const queryParams = new URLSearchParams({
      origin_fqdn: originFqdn,
      page_type: pageType,
      ...(currentProductId && { current_product_id: currentProductId }),
      ...(currentCollectionId && {
        current_collection_id: currentCollectionId,
      }),
    }).toString();

    const res = await fetch(
      `${MAIN_API_BASE_URL}/_/GetShortVideos?${queryParams}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      }
    );
    const json = await res.json();
    return json as GetShortVideosResponse;
  }

  async getVideoBanners({
    originFqdn,
    pageType,
    currentProductId,
    currentCollectionId,
  }: {
    originFqdn: string;
    pageType: "home" | "product" | "collection";
    currentProductId?: string;
    currentCollectionId?: string;
  }): Promise<GetVideoBannersResponse> {
    const queryParams = new URLSearchParams({
      origin_fqdn: originFqdn,
      page_type: pageType,
      ...(currentProductId && { current_product_id: currentProductId }),
      ...(currentCollectionId && {
        current_collection_id: currentCollectionId,
      }),
    }).toString();

    const res = await fetch(
      `${MAIN_API_BASE_URL}/_/GetBanners?${queryParams}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (!res.ok) {
      console.log(
        `%cFailed to fetch video banners ${res.statusText}`,
        "color: red;"
      );
    }

    const json = await res.json();
    return json as GetVideoBannersResponse;
  }

  async checkVideoBannersExist(
    params: GetVideoBannersExistParams
  ): Promise<boolean> {
    const queryParams: Record<string, string> = Object.entries(params)
      .filter(([_, value]) => value !== undefined)
      .reduce(
        (acc, [key, value]) => ({
          ...acc,
          [key]: value.toString(),
        }),
        {}
      );

    const queryString = new URLSearchParams(queryParams).toString();
    const url = `${MAIN_API_BASE_URL}/_/CheckBanners?${queryString}`;

    try {
      const response = await fetch(url, { method: "HEAD" });

      if (response.status === 200) {
        return true;
      } else if (response.status === 204) {
        return false;
      } else {
        console.log(
          `%cUnexpected response status ${response.status}`,
          "color: red;"
        );
        return false;
      }
    } catch (error) {
      console.log(`%cCheck video banner exist error${error}`, "color: red;");
      return false;
    }
  }

  async checkVideosExist(params: GetVideosExistParams): Promise<{
    exists: boolean;
    isSingleVideo?: boolean;
    hasDefaultVideoPip?: boolean;
  }> {
    const paramsWithOriginHostName = {
      ...params,
      originHostName: window.location.hostname,
    };

    const queryString = Object.entries(paramsWithOriginHostName)
      .filter(([key, value]) => value !== undefined && value !== null)
      .map(([key, value]) => `${key}=${encodeURIComponent(value as string)}`)
      .join("&");
    const url = `${MAIN_API_BASE_URL}/_/CheckCarousel?${queryString}`;

    try {
      const response = await fetch(url, { method: "HEAD" });

      const headers = Array.from(response.headers.entries());

      const getHeader = (name: string) => {
        const lowerName = name.toLowerCase();
        for (const [key, value] of headers) {
          if (key.toLowerCase() === lowerName) return value;
        }
        return null;
      };

      console.log("Response headers:", Array.from(response.headers.entries()));

      if (response.status === 200) {
        const singleVideoHeader = getHeader("X-Single-Video");
        const isSingleVideo = singleVideoHeader === "true";

        const defaultVideoPipInfo = getHeader("X-Has-Default-Video-Pip");

        const hasDefaultVideoPip = defaultVideoPipInfo === "true";

        console.log("X-Single-Video header:", singleVideoHeader);
        console.log("Parsed isSingleVideo:", isSingleVideo);

        return { exists: true, isSingleVideo, hasDefaultVideoPip };
      } else if (response.status === 204) {
        return { exists: false };
      } else {
        console.log(
          `%cUnexpected response error${response.status}`,
          "color: red;"
        );
        return { exists: false };
      }
    } catch (error) {
      console.log(`%cCheck video video exist error${error}`, "color: red;");
      return { exists: false };
    }
  }

  async checkStoriesExist(params: GetStoriesExistParams): Promise<boolean> {
    const paramsWithOriginHostName = {
      ...params,
      originHostName: window.location.hostname,
    };

    const queryParams: Record<string, string> = Object.entries(
      paramsWithOriginHostName
    )
      .filter(([_, value]) => value !== undefined)
      .reduce(
        (acc, [key, value]) => ({
          ...acc,
          [key]: value.toString(),
        }),
        {}
      );

    const queryString = new URLSearchParams(queryParams).toString();
    const url = `${MAIN_API_BASE_URL}/_/CheckStory?${queryString}`;

    try {
      const response = await fetch(url, { method: "HEAD" });

      if (response.status === 200) {
        return true;
      } else if (response.status === 204) {
        return false;
      } else {
        console.log(
          `%cCheck video banner exist error${response.status}`,
          "color: red;"
        );
        return false;
      }
    } catch (error) {
      console.log(`%cCheck video story exist error${error}`, "color: red;");
      return false;
    }
  }

  async shortVideosBoron(
    body: ShortVideosBoronRequestBody
  ): Promise<ShortVideosBoronResponse> {
    const requestBody = {
      ...body,
      sessionToken: localStorage?.getItem("__IS_STOK") ?? "",
      viewerToken: localStorage?.getItem("__IS_VTOK") ?? "",
    };
    const res = await fetch(`${MAIN_API_BASE_URL}/_/ShortVideosBoron`, {
      method: "POST",
      body: JSON.stringify(requestBody),
      keepalive: true,
    });
    const json = await res.json();
    return json as ShortVideosBoronResponse;
  }

  async getProductDetails(
    productId: string
  ): Promise<GetProductDetailsResponse> {
    const res = await fetch(`${MAIN_API_BASE_URL}/_/GetProductDetails`, {
      method: "POST",
      body: JSON.stringify({ productId }),
    });

    if (!res.ok) {
      console.log(
        `%cFailed to fetch product details ${res.statusText}`,
        "color: red;"
      );
    }

    return res.json();
  }

  async getStories({
    originFqdn,
    pageType,
    pageId,
    customPageRoute,
  }: {
    originFqdn: string;
    pageType: "home" | "product" | "collection" | "customPage";
    pageId: string;
    customPageRoute?: string;
  }): Promise<GetStoryReelsResponse> {
    const queryParams = new URLSearchParams({
      origin_fqdn: originFqdn,
      page_type: pageType,
      customPageRoute: customPageRoute ?? "",
      ...(pageId && { page_id: pageId }),
    }).toString();
    const res = await fetch(
      `${MAIN_API_BASE_URL}/_/GetStories?${queryParams}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      }
    );
    const json = await res.json();
    return json as GetStoryReelsResponse;
  }

  async getHighlights({
    originFqdn,
    pageType,
    pageId,
  }: GetHighlightsParams): Promise<GetHighlightsResponse> {
    const queryParams = new URLSearchParams({
      origin_fqdn: originFqdn,
      page_type: pageType,
      ...(pageId && { page_id: pageId }),
    }).toString();

    const res = await fetch(
      `${MAIN_API_BASE_URL}/_/GetHighlights?${queryParams}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (!res.ok) {
      console.log(
        `%cFailed to fetch highlights banners ${res.statusText}`,
        "color: red;"
      );
    }

    const json = await res.json();
    return json as GetHighlightsResponse;
  }

  async getViewerToken({
    originFqdn,
  }: {
    originFqdn: string;
  }): Promise<GetViewerTokenResponse> {
    const requestBody = {
      originFqdn,
    };
    const res = await fetch(`${MAIN_API_BASE_URL}/_/GetViewerToken`, {
      method: "POST",
      body: JSON.stringify(requestBody),
    });
    const json = await res.json();
    return json as GetViewerTokenResponse;
  }

  async getLibraryVideos({
    originFqdn,
    viewerToken,
  }: {
    originFqdn: string;
    viewerToken?: string;
  }): Promise<ShortVideo[]> {
    const queryParams = new URLSearchParams({
      origin_fqdn: originFqdn,
      ...(viewerToken && { viewer_token: viewerToken }),
    }).toString();

    const res = await fetch(
      `${MAIN_API_BASE_URL}/_/GetLibraryVideos?${queryParams}`,
      {
        method: "GET",
      }
    );

    if (!res.ok) {
      console.log(
        `%cFailed to fetch library videos ${res.statusText}`,
        "color: red;"
      );
    }

    const json = await res.json();

    return json.v as ShortVideo[];
  }

  async getVideoPop({
    originFqdn,
    pageType,
    currentProductId,
    currentCollectionId,
  }: {
    originFqdn: string;
    pageType: "home" | "product" | "collection";
    currentProductId?: string;
    currentCollectionId?: string;
  }): Promise<GetVideoPopRestResponse> {
    const queryParams = new URLSearchParams({
      origin_fqdn: originFqdn,
      page_type: pageType,
      ...(currentProductId && { current_product_id: currentProductId }),
      ...(currentCollectionId && {
        current_collection_id: currentCollectionId,
      }),
      originHostName: window.location.hostname,
    }).toString();
    const res = await fetch(
      `${MAIN_API_BASE_URL}/_/GetVideoPop?${queryParams}`,
      {
        method: "GET",
      }
    );
    const json = await res.json();
    return json as GetVideoPopRestResponse;
  }

  async checkStock({
    productId,
    variantId,
  }: CheckStockParams): Promise<string> {
    try {
      console.log(
        `%c[CheckStock] Making request to ${MAIN_API_BASE_URL}/_/CheckStock`,
        "color: blue;"
      );
      console.log(`%c[CheckStock] Request body:`, "color: blue;", {
        productId,
        variantId,
      });

      const res = await fetch(`${MAIN_API_BASE_URL}/_/CheckStock`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId,
          variantId,
        }),
      });

      console.log(
        `%c[CheckStock] Response status: ${res.status} ${res.statusText}`,
        "color: blue;"
      );
      console.log(
        `%c[CheckStock] Response headers:`,
        "color: blue;",
        Array.from(res.headers.entries())
      );

      if (!res.ok) {
        const errorText = await res.text();
        console.log(
          `%c[CheckStock] Error response body: ${errorText}`,
          "color: red;"
        );
        throw new Error(
          `Stock check failed: ${res.status} ${res.statusText} - ${errorText}`
        );
      }

      const json = (await res.json()) as { stock: string };
      console.log(`%c[CheckStock] Success:`, "color: green;", json);
      return json.stock;
    } catch (error) {
      console.log(`%c[CheckStock] Fetch error: ${error}`, "color: red;");
      // Re-throw to let caller handle it
      throw error;
    }
  }
}

export const standardApiClient = new ApiService();

export const ApiContextProvider = memo(({ children }) => {
  const apiClient = useMemo(() => standardApiClient, []);
  return (
    <ApiContext.Provider value={apiClient}>{children}</ApiContext.Provider>
  );
});

export const useApi = () => {
  const apiClient = useContext(ApiContext);
  return apiClient;
};
