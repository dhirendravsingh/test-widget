import { instasellLiveEmbedConfig } from "../..";
import ProductDetailsModal from "../ProductDetailsModal";
import { useShortVideosModalContext } from "../../context/ShortVideosModalContext";
import type { Product, ShortVideo } from "../../types/api";
import { formatCurrency } from "../../lib/utils";
import { useApi } from "../../lib/api";
import { useState, useEffect } from "preact/hooks";
import { useGAEvents } from "../../context/GoogleAnalytics";
import { addToCartDrawer } from "../../lib/addToCartDrawer";
import { useCleverTapEvents } from "../../context/ClevertapAnalytics";
import { useMetaEvents } from "../../context/MetaEventsContext";

const ProductPane = ({
  video,
  isDesktop,
  isActive,
  isLibrary,
  onMute,
}: {
  video: ShortVideo;
  isDesktop: boolean;
  isActive: boolean;
  isLibrary?: boolean;
  onMute?: () => void;
}) => {
  const {
    setActiveProductIndex,
    setIsProductDetailsModalOpen,
    purchaseFlowAction,
    customCode,
    activeVideoId,
    shortVideos,
    activeProductIndex,
    googleAnalyticsEnabled,
    useGtmForAnalytics,
    clevertapAnalyticsEnabled,
    shortVideoSessionToken,
    metaRetargetingEnabled,
    shopNowText,
    comparePriceEnabled,
    discountBadgeEnabled,
    storeFrontCartOperation,
    storeFrontAccessKey,
  } = useShortVideosModalContext();
  let currencyCode = instasellLiveEmbedConfig.getCurrencyCode?.() || "INR";
  let currencyRate = instasellLiveEmbedConfig.getCurrencyRate?.() || 1;
  const productToDisplay = video.p[0];
  const api = useApi();
  const activeVideo = activeVideoId
    ? shortVideos.find((v) => v.i === activeVideoId) || null
    : null;
  const gaEvents = useGAEvents();
  const caEvents = useCleverTapEvents();
  const fbEvents = useMetaEvents();
  let country = instasellLiveEmbedConfig.getCountry?.() || "IN";
  const shopDomain = instasellLiveEmbedConfig.getShopDomain?.();
  const isDhaaga = shopDomain === "0f0dbc-4b.myshopify.com";

  // Get Convercy currency conversion settings for Dhaaga
  const getConvercySettings = () => {
    if (!isDhaaga || !(window as any)._convercy) {
      return null;
    }

    try {
      const convercy = (window as any)._convercy;
      const currencyCurrent = convercy.currencyCurrent || {};
      return {
        enabled: convercy.isConvertCurrency || false,
        base: convercy.currencyShopify || "AED",
        curr: currencyCurrent.code || convercy.currencyCurrent || "AED",
        rate: convercy.rateCurrencyCurrent || 1,
        round: currencyCurrent.round || 1,
      };
    } catch (error) {
      console.error("Error reading Convercy settings:", error);
      return null;
    }
  };

  const convercySettings = getConvercySettings();

  const pageType = instasellLiveEmbedConfig.getPageType?.();
  const pageId =
    pageType == "home"
      ? ""
      : pageType == "product"
      ? instasellLiveEmbedConfig.currentProductId ?? ""
      : instasellLiveEmbedConfig.currentCollectionId ?? "";

  // Track loading state for each product using their IDs
  const [loadingProducts, setLoadingProducts] = useState<{
    [key: string]: boolean;
  }>({});

  const [addedToCartProducts, setAddedToCartProducts] = useState<{
    [key: string]: boolean;
  }>({});

  const [outOfStockProducts, setOutOfStockProducts] = useState<{
    [key: string]: boolean;
  }>({});

  const showCountrySpecificPricing =
    video.p && video.p[0]?.cp == null ? false : true;

  const calculatePrice = (basePrice: number) => {
    if (isDhaaga && convercySettings?.enabled) {
      const { base, curr, rate } = convercySettings;
      let sourceCurrency: string;
      if (showCountrySpecificPricing && video.p?.[0]?.cp?.[country]?.cc) {
        sourceCurrency = video.p[0].cp[country].cc;
      } else {
        sourceCurrency = base;
      }
      // rateCurrencyCurrent is the rate FROM current currency TO base currency
      // e.g., if rate = 3.67, it means 1 USD = 3.67 AED
      // So to convert FROM AED TO USD, we need to DIVIDE by the rate
      if (sourceCurrency === base && curr !== base && rate && rate !== 1) {
        const convertedPrice = basePrice / rate;
        const roundValue = convercySettings.round || 1;
        const roundedPrice =
          Math.ceil(convertedPrice / roundValue) * roundValue;
        return {
          price: roundedPrice,
          currency: curr,
        };
      }
    }

    return {
      price: basePrice * (currencyRate || 1),
      currency: currencyCode,
    };
  };

  const priceToDisplay = showCountrySpecificPricing
    ? (() => {
        const basePrice = (video.p && video.p[0]?.cp?.[country].pr) || 0;
        const { price, currency } = calculatePrice(basePrice);
        return formatCurrency(price, currency);
      })()
    : (() => {
        const basePrice = (video.p && video.p[0]?.pr) || 0;
        const { price, currency } = calculatePrice(basePrice);
        return formatCurrency(price, currency);
      })();

  const productPrice = (product: Product) => {
    const basePrice = showCountrySpecificPricing
      ? product?.cp?.[country].pr || 0
      : product?.pr || 0;
    const { price, currency } = calculatePrice(basePrice);
    return formatCurrency(price, currency);
  };

  const comparePriceToDisplay = showCountrySpecificPricing
    ? (() => {
        const basePrice = (video.p && video.p[0]?.cp?.[country]?.cs) || 0;
        const { price, currency } = calculatePrice(basePrice);
        return formatCurrency(price, currency);
      })()
    : (() => {
        const basePrice = (video.p && video.p[0]?.c) || 0;
        const { price, currency } = calculatePrice(basePrice);
        return formatCurrency(price, currency);
      })();

  const comparePrice = (product: Product) => {
    const basePrice = showCountrySpecificPricing
      ? product.cp?.[country]?.cs || 0
      : product?.c || 0;
    const { price, currency } = calculatePrice(basePrice);
    return formatCurrency(price, currency);
  };

  // Function to calculate discount percentage
  const calculateDiscountPercentage = (product: Product) => {
    const currentPrice = showCountrySpecificPricing
      ? product?.cp?.[country].pr || 0
      : product?.pr || 0;

    const originalPrice = showCountrySpecificPricing
      ? product.cp?.[country]?.cs || 0
      : product?.c || 0;

    if (originalPrice > 0 && currentPrice > 0 && originalPrice > currentPrice) {
      const discount = ((originalPrice - currentPrice) / originalPrice) * 100;
      return Math.round(discount);
    }
    return 0;
  };

  const regex = /^[^\w\s\d]0$/;

  // TODO: this code should be removed after the following site updates their config
  switch (window.location.hostname) {
    case "instasell-live-commerce.webflow.io":
    case "instasell.io":
    case "www.twoprettygirlz.com":
    case "two-pretty-girlz.myshopify.com":
      currencyCode = "USD";
      break;
  }

  if (!productToDisplay) return null;

  if (!isActive && isDesktop) return null;
  const openProductDetailsModal = (i: number) => {
    if (
      window.location.hostname === "minify.sg" ||
      window.location.hostname === "www.camecompany.com" ||
      window.location.hostname === "pebirds.com" ||
      window.location.hostname === "altaformamilano.com" ||
      window.location.hostname === "theallure.in" ||
      window.location.hostname === "shop.knipex.com.mx" ||
      window.location.hostname === "www.ecofynd.com"
    ) {
      const product = video.p[i];
      window.location.href = product.p;
    } else {
      setActiveProductIndex(i);
      setIsProductDetailsModalOpen(true);
    }
  };

  const handlePurchase = async (product: Product) => {
    // Mute the video when Add to Cart is clicked (always mute, don't toggle)
    if (onMute) {
      onMute(); // Update global state so icon changes
    }
    const videoElements = document.querySelectorAll(
      ".ins-reel-player-modal-reel-video__in-view"
    );
    videoElements.forEach((videoEl) => {
      (videoEl as HTMLVideoElement).muted = true;
    });

    let variantId: string;
    if (shopDomain === "rasayanam.myshopify.com" && product.v?.length > 0) {
      // For rasayanam "Pack of 1" is selected by default
      variantId = product.v[1]?.pi;
    } else {
      variantId = product.vi;
    }

    setLoadingProducts((prev) => ({ ...prev, [product.i]: true }));
    setOutOfStockProducts((prev) => ({ ...prev, [product.i]: false }));

    const orderAttributionToken =
      localStorage?.getItem("__IS_VTOK") + "_" + new Date().toISOString();

    if (storeFrontCartOperation) {
      try {
        // Check stock for buywow.in before proceeding
        if (shopDomain === "buywow.in") {
          try {
            const stockStatus = await api.checkStock({
              productId: product.pi,
              variantId: variantId,
            });

            console.log("Stock status :", stockStatus);

            if (stockStatus !== "in stock") {
              setLoadingProducts((prev) => ({ ...prev, [product.i]: false }));
              setOutOfStockProducts((prev) => ({ ...prev, [product.i]: true }));
              window.setTimeout(() => {
                setOutOfStockProducts((prev) => ({
                  ...prev,
                  [product.i]: false,
                }));
              }, 3000);
              return;
            }
          } catch (error) {
            console.log(`%cStock check failed: ${error}`, "color: red;");
          }
        }

        if (
          "handleEventAfterCartEvent" in window &&
          typeof window.handleEventAfterCartEvent === "function"
        ) {
          window.handleEventAfterCartEvent({
            productId: product.pi,
            variantId,
            orderAttributionToken,
          });
          await api.shortVideosBoron({
            eventType: "addToCart",
            addToCart: {
              shortVideoId: activeVideo?.i!,
              productId: product.i,
              providerCartId: "",
              variantId: variantId,
              quantity: 1,
              orderAttributionToken,
            },
            source: "carousel",
            pageType,
            pageId,
          });
          sessionStorage.setItem("sessionTime", Date.now().toString());
        }

        // Add analytics tracking for storeFrontCartOperation
        if (googleAnalyticsEnabled) {
          gaEvents.trackAddToCart(
            product.i,
            1,
            variantId,
            "video-carousel",
            instasellLiveEmbedConfig.pageType,
            video.m[0].v,
            useGtmForAnalytics
          );
        }
        if (clevertapAnalyticsEnabled) {
          caEvents.trackAddToCart(
            product.i,
            1,
            variantId,
            "video-carousel",
            instasellLiveEmbedConfig.pageType,
            video.m[0].v
          );
        }
        if (metaRetargetingEnabled) {
          fbEvents.trackAddToCart(
            product.i,
            1,
            variantId,
            "video-carousel",
            instasellLiveEmbedConfig.pageType,
            activeVideo?.m[0].v ?? ""
          );
        }

        setAddedToCartProducts((prev) => ({ ...prev, [product.i]: true }));
        setOutOfStockProducts((prev) => ({ ...prev, [product.i]: false }));
        setTimeout(() => {
          setAddedToCartProducts((prev) => ({ ...prev, [product.i]: false }));
        }, 5000);
      } catch (error) {
        console.log(
          `%cError in storefront cart operation: ${error}`,
          "color: red;"
        );
      } finally {
        setLoadingProducts((prev) => ({ ...prev, [product.i]: false }));
        setOutOfStockProducts((prev) => ({ ...prev, [product.i]: false }));
      }
      return;
    }

    try {
      let drawerAddSuccess = false;

      if (
        purchaseFlowAction !== "pdp" ||
        (purchaseFlowAction === "pdp" &&
          window.location.pathname.includes("/products/"))
      ) {
        if (!storeFrontCartOperation) {
          drawerAddSuccess = await addToCartDrawer(variantId, product.pi);
        }
      }

      if (!drawerAddSuccess && !storeFrontCartOperation) {
        await instasellLiveEmbedConfig.addToCart(
          variantId,
          "REELS",
          product.h,
          orderAttributionToken
        );
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      if (storeFrontCartOperation) {
        // Check stock for buywow.in before proceeding
        if (shopDomain === "buywow.in") {
          try {
            const stockStatus = await api.checkStock({
              productId: productToDisplay.pi,
              variantId: variantId,
            });

            console.log("Stock status :", stockStatus);

            if (stockStatus !== "in stock") {
              setLoadingProducts((prev) => ({ ...prev, [product.i]: false }));
              setOutOfStockProducts((prev) => ({ ...prev, [product.i]: true }));
              window.setTimeout(() => {
                setOutOfStockProducts((prev) => ({
                  ...prev,
                  [product.i]: false,
                }));
              }, 3000);
              return;
            }
          } catch (error) {
            console.log(`%cStock check failed: ${error}`, "color: red;");
          }
        }

        if (
          "handleEventAfterCartEvent" in window &&
          typeof window.handleEventAfterCartEvent === "function"
        ) {
          window.handleEventAfterCartEvent({
            productId: productToDisplay.pi,
            variantId,
            orderAttributionToken,
          });
        }
      } else {
        const cart = await instasellLiveEmbedConfig.getCurrentCart();
        if (!cart) {
          throw new Error("Failed to verify cart update");
        }

        try {
          await instasellLiveEmbedConfig.updateCartInfo(orderAttributionToken);
        } catch (error) {
          console.log(`%cFailed to update the cart: ${error}`, "color: red;");
        }

        await api.shortVideosBoron({
          eventType: "addToCart",
          addToCart: {
            shortVideoId: activeVideo?.i!,
            productId: productToDisplay.i,
            providerCartId: cart.token,
            variantId: variantId,
            quantity: 1,
            orderAttributionToken,
          },
          source: "carousel",
          pageType,
          pageId,
        });
        sessionStorage.setItem("sessionTime", Date.now().toString());
      }

      if (googleAnalyticsEnabled) {
        gaEvents.trackAddToCart(
          product.i,
          1,
          variantId,
          "video-carousel",
          instasellLiveEmbedConfig.pageType,
          video.m[0].v,
          useGtmForAnalytics
        );
      }
      if (clevertapAnalyticsEnabled) {
        caEvents.trackAddToCart(
          product.i,
          1,
          variantId,
          "video-carousel",
          instasellLiveEmbedConfig.pageType,
          video.m[0].v
        );
      }
      if (metaRetargetingEnabled) {
        fbEvents.trackAddToCart(
          product.i,
          1,
          variantId,
          "video-carousel",
          instasellLiveEmbedConfig.pageType,
          activeVideo?.m[0].v ?? ""
        );
      }

      setAddedToCartProducts((prev) => ({ ...prev, [product.i]: true }));
      setTimeout(() => {
        setAddedToCartProducts((prev) => ({ ...prev, [product.i]: false }));
      }, 5000);

      if (purchaseFlowAction === "pdp") {
        if (
          (!window.location.pathname.includes("/products/") ||
            !window.location.pathname.includes(product.h)) &&
          !storeFrontCartOperation
        ) {
          window.location.href = "/products/" + product.h;
        }
      } else if (!drawerAddSuccess && !storeFrontCartOperation) {
        if (
          (window as any).Shopify?.shop !== "hyphen-mcaffeine.myshopify.com" &&
          (window as any).Shopify?.shop !== "beyours-india.myshopify.com"
        ) {
          window.location.href = "/cart";
        }
      }
    } catch (error) {
      console.log(`%cError in purchase flow: ${error}`, "color: red;");
    } finally {
      setLoadingProducts((prev) => ({ ...prev, [product.i]: false }));
      setOutOfStockProducts((prev) => ({ ...prev, [product.i]: false }));
    }
  };

  const handleShopNow = async (i: number) => {
    // Mute the video when Shop Now is clicked (always mute, don't toggle)
    if (onMute) {
      onMute(); // Update global state so icon changes
    }
    const videoElements = document.querySelectorAll(
      ".ins-reel-player-modal-reel-video__in-view"
    );
    videoElements.forEach((videoEl) => {
      (videoEl as HTMLVideoElement).muted = true;
    });

    const product = video.p[i];

    try {
      // For multiple variants with purchaseFlowAction === "popUp", open the modal
      if (product.v?.length > 1 && purchaseFlowAction === "popUp") {
        setActiveProductIndex(i);
        setIsProductDetailsModalOpen(true);
      }
      // For multiple variants with purchaseFlowAction === "pdp", handle redirection
      else if (
        product.v?.length > 1 &&
        purchaseFlowAction === "pdp" &&
        !storeFrontCartOperation
      ) {
        if (!window.location.pathname.includes("/products/")) {
          window.location.href = "/products/" + product.h;
        } else {
          setActiveProductIndex(i);
          setIsProductDetailsModalOpen(true);
        }
      } else {
        await handlePurchase(product);
      }
    } catch (err) {
      console.log(`%cFailed to fetch product details: ${err}`, "color: red;");
      await handlePurchase(product);
    }
  };

  const getButtonText = (product: Product) => {
    if (outOfStockProducts[product.i]) {
      return shopDomain === "terredefrance.myshopify.com"
        ? "Rupture de stock"
        : shopDomain === "37f807-2.myshopify.com"
        ? "Agotado"
        : "Out of stock";
    }

    if (addedToCartProducts[product.i]) {
      return shopDomain === "terredefrance.myshopify.com"
        ? "Ajouté au panier"
        : shopDomain === "37f807-2.myshopify.com"
        ? "Añadido al carrito"
        : shopDomain === "0zqhug-ry.myshopify.com"
        ? "Dodano do koszyka"
        : "Added To Cart";
    }

    if (loadingProducts[product.i]) {
      return shopDomain === "terredefrance.myshopify.com"
        ? "Ajout au panier"
        : shopDomain === "37f807-2.myshopify.com"
        ? "comprando"
        : shopDomain === "0zqhug-ry.myshopify.com"
        ? "Dodawanie..."
        : shopDomain == "peepultree.myshopify.com"
        ? product.v?.length > 1
          ? "loading...."
          : "Adding to cart.."
        : "Adding to cart..";
    }

    return shopDomain === "terredefrance.myshopify.com"
      ? "Ajouter au panier"
      : shopDomain === "37f807-2.myshopify.com"
      ? "comprar"
      : shopDomain === "0zqhug-ry.myshopify.com"
      ? "Dodaj do koszyka"
      : shopDomain == "peepultree.myshopify.com"
      ? product.v?.length > 1
        ? "Shop Now"
        : "ADD TO CART"
      : [
          "336df5.myshopify.com",
          "srisritattva-in.myshopify.com",
          "eyewearlabs.myshopify.com",
          "utkarsh-s.myshopify.com",
          "vw-vanity-wagon.myshopify.com",
          "rasayanam.myshopify.com",
        ].includes(shopDomain)
      ? "ADD TO CART"
      : shopNowText
      ? shopNowText
      : "Shop Now";
  };

  return (
    <>
      {isActive ? (
        !isLibrary ? (
          <ProductDetailsModal onMute={onMute} />
        ) : (
          <ProductDetailsModal activeLibraryVideo={video} onMute={onMute} />
        )
      ) : null}
      <div
        className="ins-reel-player-product-panel-2"
        onClick={(e) => e.stopPropagation()}
      >
        {(() => {
          let sortedProducts = [...video.p];

          if (
            instasellLiveEmbedConfig.currentProductId &&
            shopDomain !== "beyours-india.myshopify.com"
          ) {
            const currentIndex = sortedProducts.findIndex(
              (product) =>
                product.pi === instasellLiveEmbedConfig.currentProductId
            );

            if (currentIndex !== -1) {
              const currentProduct = sortedProducts.splice(currentIndex, 1)[0];
              sortedProducts.unshift(currentProduct);
            }
          }

          return sortedProducts.map((product, i) => (
            <div
              className="ins-product-panel-item"
              onClick={() => handleShopNow(i)}
              key={product.pi}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                <div className="ins-product-panel-item-thumbnail">
                  <img
                    src={
                      product.v?.[0]?.im
                        ? `${
                            product.v?.[0]?.im.split("?")[0]
                          }?width=150&height=150&fit=crop&quality=80`
                        : product.v?.[0]?.im || product.im
                    }
                    loading="lazy"
                    alt=""
                    className="ins-product-panel-item-thumbnail-img"
                  />
                </div>
                <div className="ins-product-panel-item-details">
                  <div>
                    <p className="ins-product-panel-item-title">
                      {product.t?.toLowerCase() ?? ""}
                    </p>
                    <div className="ins-product-panel-item-price-container">
                      <p className="ins-product-panel-item-price">
                        {productPrice(product)}
                        {comparePriceEnabled &&
                        product.c &&
                        product.c > product.pr &&
                        !regex.test(comparePrice(product)) ? (
                          <span className="ins-product-panel-item-strikeoff-price">
                            {comparePrice(product)}
                          </span>
                        ) : null}
                        {discountBadgeEnabled &&
                        product.c &&
                        product.c > product.pr &&
                        !regex.test(comparePrice(product)) &&
                        calculateDiscountPercentage(product) > 0 ? (
                          <span className="ins-product-panel-item-discount-badge">
                            Save {calculateDiscountPercentage(product)}%
                          </span>
                        ) : null}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <p className="ins-product-panel-item-buy-now">
                {getButtonText(product)}
              </p>
            </div>
          ));
        })()}
      </div>
    </>
  );
};

export default ProductPane;
