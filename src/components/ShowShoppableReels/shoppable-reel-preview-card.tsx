import { MutableRef, useEffect, useRef, useState } from "preact/hooks";
import handleViewport from "react-in-viewport";
import { instasellLiveEmbedConfig } from "../..";
import { formatCurrency } from "../../lib/utils";
import type { ShortVideo } from "../../types/api";
import { useApi } from "../../lib/api";
import { useShortVideosModalContext } from "../../context/ShortVideosModalContext";
import { useGAEvents } from "../../context/GoogleAnalytics";
import { addToCartDrawer } from "../../lib/addToCartDrawer";
import { useCleverTapEvents } from "../../context/ClevertapAnalytics";
import VariantSelector from "./variant-selector";
import { useMetaEvents } from "../../context/MetaEventsContext";
import { ComponentChildren } from "preact";

// Define the props for the base component
interface ShoppableReelPreviewCardProps {
  video: ShortVideo;
  setCurrentItemActive: () => void;
  design?: "one" | "two" | "three" | "four" | "custom";
}

// Function to fetch collection image
const getCollectionImage = async (
  collectionHandle: string
): Promise<string | null> => {
  try {
    const response = await fetch(`/collections/${collectionHandle}.json`);

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    const data = await response.json();

    // Return the collection image src if it exists
    return data.collection?.image?.src || null;
  } catch (error) {
    console.error("Error fetching collection image:", error);
    return null;
  }
};

// Base component logic
const ShoppableReelPreviewCardBase = ({
  video,
  setCurrentItemActive,
  design = "one",
}: ShoppableReelPreviewCardProps) => {
  const api = useApi();
  let currencyCode = instasellLiveEmbedConfig.getCurrencyCode?.() || "INR";
  let currencyRate = instasellLiveEmbedConfig.getCurrencyRate?.() || 1;
  let country = instasellLiveEmbedConfig.getCountry?.() || "IN";
  const [loadVideo, setLoadVideo] = useState(true);
  const [addingToCartStatus, setAddingToCartStatus] = useState<
    "add" | "adding" | "added" | "out-of-stock"
  >("add");
  const [collectionImage, setCollectionImage] = useState<string | null>(null);
  const {
    googleAnalyticsEnabled,
    useGtmForAnalytics,
    metaRetargetingEnabled,
    shortVideoSessionToken,
    comparePriceEnabled,
    purchaseFlowAction,
    clevertapAnalyticsEnabled,
    atcButtonText,
    storeFrontCartOperation,
    storeFrontAccessKey,
    discountBadgeEnabled,
    variantSliderEnabled,
  } = useShortVideosModalContext();
  const caEvents = useCleverTapEvents();
  const gaEvents = useGAEvents();
  const fbEvents = useMetaEvents();
  const thumbnailUrl = video.m[0].t || "";
  const showCountrySpecificPricing =
    video.p && video.p[0]?.cp == null ? false : true;
  const regex = /^[^\w\s\d]0$/;
  const isProductPage = window.location.pathname.includes("/products/");
  const currentProductId = (window as any).meta?.page?.resourceId?.toString();
  const shopDomain = instasellLiveEmbedConfig.getShopDomain?.();
  const isBuywowShop =
    shopDomain === "buywow.in" ||
    (typeof window !== "undefined" &&
      (window as any).Shopify?.shop === "buywow.in");
  const shouldSkipLocalInventoryChecks = isBuywowShop;

  // Check if this is Dhaaga store
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
        round: currencyCurrent.round || 1, // Rounding value for the currency (USD: 1, INR: 100)
      };
    } catch (error) {
      console.error("Error reading Convercy settings:", error);
      return null;
    }
  };

  const convercySettings = getConvercySettings();

  const isVariantAvailable = (variant: any) => {
    if (!variant) {
      return false;
    }
    if (variant.ip === "CONTINUE") {
      return true;
    }
    if (variant.ip === "DENY" && variant.s > 0) {
      return true;
    }
    if (variant.ip === "DENY" && variant.s <= 0) {
      return variant.af;
    }
    return true;
  };

  const isVariantMarkedOutOfStock = (variant: any) => {
    if (!variant) {
      return false;
    }
    if (variant.ip === "CONTINUE") {
      return false;
    }
    if (variant.ip === "DENY" && variant.s > 0) {
      return false;
    }
    if (variant.ip === "DENY" && variant.s <= 0) {
      return !variant.af;
    }
    return false;
  };

  if (
    isProductPage &&
    currentProductId &&
    video.p?.length > 1 &&
    shopDomain !== "beyours-india.myshopify.com"
  ) {
    video.p.sort((a, b) => {
      if (a.pi === currentProductId) return -1;
      if (b.pi === currentProductId) return 1;
      return 0;
    });
  }

  const calculatePrice = (basePrice: number, isComparePrice = false) => {
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

  const comparePriceToDisplay = showCountrySpecificPricing
    ? (() => {
        const basePrice = (video.p && video.p[0]?.cp?.[country]?.cs) || 0;
        const { price, currency } = calculatePrice(basePrice, true);
        return formatCurrency(price, currency);
      })()
    : (() => {
        const basePrice = (video.p && video.p[0]?.c) || 0;
        const { price, currency } = calculatePrice(basePrice, true);
        return formatCurrency(price, currency);
      })();

  const previewVideoUrl =
    video.m.find((media) => media.s == "low")?.v ?? video.m[0].v;
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const [isInViewport, setIsInViewport] = useState(false);
  const [shouldLoadVideo, setShouldLoadVideo] = useState(false);

  function getButtonText(
    status: "add" | "adding" | "added" | "out-of-stock"
  ): string {
    const shopDomain = (window as any).Shopify?.shop;
    const isPolish = shopDomain === "0zqhug-ry.myshopify.com";
    const texts = isPolish
      ? {
          add: "Dodaj do koszyka",
          adding: "Dodawanie...",
          added: "Dodano",
          "out-of-stock": "Brak na stanie",
        }
      : {
          add: atcButtonText ? atcButtonText : "ADD TO CART",
          adding: "Adding To Cart...",
          added: "Added",
          "out-of-stock": "Out of stock",
        };
    return texts[status] || texts.add;
  }

  const pageType = instasellLiveEmbedConfig.getPageType?.();
  const pageId =
    pageType == "home"
      ? ""
      : pageType == "product"
      ? instasellLiveEmbedConfig.currentProductId ?? ""
      : instasellLiveEmbedConfig.currentCollectionId ?? "";

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const isVisible = entry.isIntersecting;
          setIsInViewport(isVisible);

          // Load the video if it's visible and not already loaded
          if (isVisible && !shouldLoadVideo) {
            setTimeout(() => {
              setShouldLoadVideo(true);
            }, 200);
          }

          // Try to play immediately when visible
          if (isVisible && videoRef.current && shouldLoadVideo) {
            videoRef.current.play().catch((error) => {
              console.log("Video play error:", error);
            });
          } else if (!isVisible && videoRef.current) {
            videoRef.current.pause();
          }
        });
      },
      { threshold: 0.1 }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, [shouldLoadVideo]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === "visible" &&
        isInViewport &&
        videoRef.current &&
        shouldLoadVideo
      ) {
        videoRef.current.play().catch((error) => {
          console.log("Visibility change play error:", error);
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isInViewport, shouldLoadVideo]);

  useEffect(() => {
    if (shouldLoadVideo && isInViewport && videoRef.current) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        videoRef.current?.play().catch((error) => {
          console.log("Video load effect play error:", error);
        });
      }, 100);
    }
  }, [shouldLoadVideo, isInViewport]);

  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (addingToCartStatus === "added") {
      timer = setTimeout(() => {
        setAddingToCartStatus("add");
        console.log("Status - add");
      }, 5000);
    } else if (addingToCartStatus === "out-of-stock") {
      timer = setTimeout(() => {
        setAddingToCartStatus("add");
        console.log("Status - add");
      }, 3000);
    }

    return () => {
      if (timer) {
        clearTimeout(timer);
        console.log("add timer dont");
      }
    };
  }, [addingToCartStatus]);

  // Fetch collection image when video has custom CTA
  useEffect(() => {
    const fetchCollectionImage = async () => {
      if (video.ct?.cl && design === "four") {
        const collectionMatch = video.ct.cl.match(
          /\/collections\/([^\/\?]+)(?:\/|$|\?)/
        );
        if (collectionMatch) {
          const collectionHandle = collectionMatch[1];
          const imageUrl = await getCollectionImage(collectionHandle);
          setCollectionImage(imageUrl);
        }
      }
    };

    fetchCollectionImage();
  }, [video.ct, design]);

  switch (window.location.hostname) {
    case "instasell-live-commerce.webflow.io":
    case "instasell.io":
    case "www.twoprettygirlz.com":
    case "two-pretty-girlz.myshopify.com":
      currencyCode = "USD";
      break;
  }

  const handlePurchase = async (variant: string) => {
    const product = video.p[0];
    const { product: productDetails } = await api.getProductDetails(product.i);

    const orderAttributionToken =
      localStorage?.getItem("__IS_VTOK") + "_" + new Date().toISOString();

    if (storeFrontCartOperation) {
      const variantId = variant || video.p[0].vi;
      setAddingToCartStatus("adding");
      console.log("Status - adding");

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
              setAddingToCartStatus("out-of-stock");
              console.log("Status - out-of-stock");
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
              shortVideoId: video.i ?? "",
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
        setAddingToCartStatus("added");
        console.log("Status - added");
      } catch (error) {
        console.log(
          `%cError in storefront cart operation: ${error}`,
          "color: red;"
        );
        setAddingToCartStatus("add");
        console.log("Status - add");
      }
      return;
    }

    if (
      productDetails.v?.length > 1 &&
      purchaseFlowAction === "pdp" &&
      (!window.location.pathname.includes("/products/") ||
        !window.location.pathname.includes(video.p[0].h)) &&
      !storeFrontCartOperation
    ) {
      try {
        const productUrl = "/products/" + encodeURIComponent(video.p[0].h);
        window.location.href = productUrl;
      } catch (error) {
        console.log(
          `%cError redirecting to product page: ${error}`,
          "color: red;"
        );
      }
      return;
    } else {
      if (!video.p[0].vi) {
        console.log(
          `%cNo valid variant ID found in video.p[0].vi`,
          "color: red;"
        );
        return;
      }

      setAddingToCartStatus("adding");
      console.log("Status - adding");
      let variantId: string = "";
      if (shopDomain === "rasayanam.myshopify.com") {
        // For rasayanam "Pack of 1" is selected by default
        variantId = productDetails.v[1]?.pi;
      } else {
        variantId = variant || video.p[0].vi;
      }
      console.log("Variant Id :", video);
      console.log("Variant Id :", variantId);
      console.log("Variant Id - first variant :", productDetails.v[0].pi);

      try {
        let drawerAddSuccess = false;

        if (
          purchaseFlowAction !== "pdp" ||
          (purchaseFlowAction === "pdp" &&
            window.location.pathname.includes("/products/"))
        ) {
          if (!storeFrontCartOperation) {
            drawerAddSuccess = await addToCartDrawer(variantId, video.p[0].pi);
          }
        }

        const orderAttributionToken =
          localStorage?.getItem("__IS_VTOK") + "_" + new Date().toISOString();

        if (!drawerAddSuccess && !storeFrontCartOperation) {
          await instasellLiveEmbedConfig.addToCart(
            variantId,
            "REELS",
            video.p[0].h,
            orderAttributionToken
          );
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        if (storeFrontCartOperation) {
          // Check stock for buywow.in before proceeding
          if (shopDomain === "buywow.in") {
            try {
              const stockStatus = await api.checkStock({
                productId: product.pi,
                variantId: variantId,
              });

              if (stockStatus !== "in stock") {
                console.log(`%cProduct is out of stock`, "color: orange;");
                setAddingToCartStatus("add");
                console.log("Status - add");
                return;
              }
            } catch (error) {
              console.log(`%cStock check failed: ${error}`, "color: red;");
              // Proceed anyway if stock check fails
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
          }

          // Add analytics tracking for storeFrontCartOperation
          if (googleAnalyticsEnabled) {
            gaEvents.trackAddToCart(
              video.p[0].i,
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
              video.p[0].i,
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
              video?.m[0].v ?? ""
            );
          }
        } else {
          const cart = await instasellLiveEmbedConfig.getCurrentCart();
          if (!cart) {
            throw new Error("Failed to verify cart update");
          }

          try {
            await instasellLiveEmbedConfig.updateCartInfo(
              orderAttributionToken
            );
          } catch (error) {
            console.log(`%cFailed to update cart: ${error}`, "color: red;");
          }

          await api.shortVideosBoron({
            eventType: "addToCart",
            addToCart: {
              shortVideoId: video.i ?? "",
              productId: product.i,
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
            video.p[0].i,
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
            video.p[0].i,
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
            video?.m[0].v ?? ""
          );
        }

        if (purchaseFlowAction === "pdp") {
          if (
            !window.location.pathname.includes("/products/") &&
            !storeFrontCartOperation
          ) {
            window.location.href = "/products/" + video.p[0].h;
          }
        } else if (!drawerAddSuccess && !storeFrontCartOperation) {
          if (
            (window as any).Shopify?.shop !==
              "hyphen-mcaffeine.myshopify.com" &&
            (window as any).Shopify?.shop !== "beyours-india.myshopify.com"
          ) {
            window.location.href = "/cart";
          }
        }
        setAddingToCartStatus("added");
        console.log("Status - added");
      } catch (error) {
        console.log(`%cError in purchase flow: ${error}`, "color: red;");
        setAddingToCartStatus("add");
        console.log("Status - add");
      }
    }
  };
  const renderVideoContent = () => {
    return (
      <div className="ins-shoppable-video-card-preview-container">
        {discountBadgeEnabled && video?.p?.[0]?.c > video?.p?.[0]?.pr && (
          <div className="ins-shoppable-video-card-discount-badge">
            {Math.round((1 - video.p[0]?.pr / video.p[0]?.c) * 100)}% off
          </div>
        )}
        <div className="ins-shoppable-video-card-thumbnail">
          <img
            src={thumbnailUrl}
            loading="lazy"
            alt=""
            className="ins-shoppable-video-card-thumbnail-img"
          />
          <div className="ins-shoppable-video-card-loader-overlay">
            <div className="ins-shoppable-video-card-spinner" />
          </div>
        </div>

        {shouldLoadVideo && (
          <video
            className="ins-shoppable-video-card-preview"
            autoPlay={true}
            src={previewVideoUrl}
            ref={videoRef}
            loop={true}
            preload="auto"
            controls={false}
            allowFullScreen={false}
            muted={true}
            playsInline={true}
            onTimeUpdate={(e) => {
              if (e.currentTarget.currentTime >= 3) {
                e.currentTarget.currentTime = 0;
              }
            }}
            onPause={(e) => {
              if (isInViewport) {
                e.currentTarget.play().catch((error) => {
                  console.log("Pause handler play error:", error);
                });
              }
            }}
          />
        )}
      </div>
    );
  };
  const renderContentOne = () => (
    <>
      {renderVideoContent()}
      {video.p[0] && (
        <div className="ins-shoppable-video-card-product-info">
          <div className="ins-shoppable-video-card-product-details">
            <div className="ins-shoppable-video-card-product-image-container">
              <img
                className="ins-shoppable-video-card-product-image"
                loading="lazy"
                src={video.p[0].v?.[0]?.im || video.p[0].im}
                alt={video.p[0].t}
              />
            </div>
            <h3 className="ins-shoppable-video-card-product-name">
              {video.p[0].t?.toLowerCase() ?? ""}
            </h3>
            <p className="ins-shoppable-video-card-product-price">
              {priceToDisplay}
              {comparePriceEnabled &&
                video.p[0]?.c > video.p[0]?.pr &&
                !regex.test(comparePriceToDisplay) && (
                  <span className="ins-shoppable-video-card-compare-price">
                    {comparePriceToDisplay}
                  </span>
                )}
            </p>
          </div>
        </div>
      )}
    </>
  );

  const renderContentTwo = () => (
    <>
      {renderVideoContent()}
      {video.p[0] && (
        <div className="ins-shoppable-video-card-product-info">
          <div className="ins-shoppable-video-card-product-image-container">
            <img
              className="ins-shoppable-video-card-product-image"
              loading="lazy"
              src={video.p[0].v?.[0]?.im || video.p[0].im}
              alt={video.p[0].t}
            />
          </div>
          <div className="ins-shoppable-video-card-product-details">
            <h3 className="ins-shoppable-video-card-product-name">
              {video.p[0].t?.toLowerCase() ?? ""}
            </h3>
            <p className="ins-shoppable-video-card-product-price">
              {priceToDisplay}
              {comparePriceEnabled && video.p[0]?.c > video.p[0]?.pr && (
                <span className="ins-shoppable-video-card-compare-price">
                  {comparePriceToDisplay}
                </span>
              )}
            </p>
          </div>
        </div>
      )}
    </>
  );

  const renderContentThree = () => (
    <>
      {renderVideoContent()}
      {video.p[0] && (
        <div className="ins-shoppable-video-card-product-info">
          <div className="ins-shoppable-video-card-product-details">
            <h3 className="ins-shoppable-video-card-product-name">
              {video.p[0].t?.toLowerCase() ?? ""}
            </h3>
            <p className="ins-shoppable-video-card-product-price">
              {priceToDisplay}
              {comparePriceEnabled && video.p[0]?.c > video.p[0]?.pr && (
                <span className="ins-shoppable-video-card-compare-price">
                  {comparePriceToDisplay}
                </span>
              )}
            </p>
          </div>
        </div>
      )}
    </>
  );

  const renderContentFour = () => (
    <>
      {renderVideoContent()}
      {video.p[0] && (
        <div className="ins-shoppable-video-card-product-info">
          <div className="ins-shoppable-video-card-product-details">
            <div className="ins-shoppable-video-card-product-image-container">
              <img
                className="ins-shoppable-video-card-product-image"
                loading="lazy"
                src={video.p[0].v?.[0]?.im || video.p[0].im}
                alt={video.p[0].t}
              />
            </div>
            <h3 className="ins-shoppable-video-card-product-name">
              {video.p[0].t?.toLowerCase() ?? ""}
            </h3>
            <p className="ins-shoppable-video-card-product-price">
              {priceToDisplay}
              {comparePriceEnabled && video.p[0]?.c > video.p[0]?.pr && (
                <span className="ins-shoppable-video-card-compare-price">
                  {comparePriceToDisplay}
                </span>
              )}
            </p>
          </div>
        </div>
      )}
      {video?.p?.[0]?.v?.length > 1 &&
      variantSliderEnabled &&
      purchaseFlowAction !== "pdp" ? (
        <VariantSelector
          options={video.p[0].o}
          variants={video.p[0].v}
          onPurchase={handlePurchase}
          addToCartStatus={addingToCartStatus}
        />
      ) : (
        <button
          className="ins-shoppable-video-card-add-to-cart"
          onClick={(e) => {
            e.stopPropagation();
            if (purchaseFlowAction === "pdp" && !storeFrontCartOperation) {
              window.location.href = "/products/" + video.p[0].h;
              return;
            }
            if (shouldSkipLocalInventoryChecks) {
              handlePurchase(video.p[0].vi);
              return;
            }
            const variant = video?.p?.[0]?.v?.[0];
            if (variant && isVariantAvailable(variant)) {
              handlePurchase(video.p[0].vi);
              return;
            }
            console.log("no stock");
          }}
        >
          {shouldSkipLocalInventoryChecks
            ? getButtonText(addingToCartStatus)
            : video?.p?.[0]?.v?.[0] &&
              isVariantMarkedOutOfStock(video.p[0].v[0])
            ? getButtonText("out-of-stock")
            : getButtonText(addingToCartStatus)}
        </button>
      )}
    </>
  );

  // Card four for videos with custom CTA but no products
  const renderContentFourWithCTA = () => (
    <>
      {renderVideoContent()}
      <div className="ins-shoppable-video-card-product-info">
        <div className="ins-shoppable-video-card-product-details">
          <div className="ins-shoppable-video-card-product-image-container">
            <img
              className="ins-shoppable-video-card-product-image"
              loading="lazy"
              src={collectionImage || thumbnailUrl}
              alt={video.ct?.cn || video.t}
            />
          </div>
          <h3 className="ins-shoppable-video-card-product-name">
            {video.ct?.cn?.toLowerCase() ?? video.t?.toLowerCase() ?? ""}
          </h3>
          <p className="ins-shoppable-video-card-product-price-cta">.</p>
        </div>
      </div>
      <button
        className="ins-shoppable-video-card-add-to-cart"
        onClick={(e) => {
          e.stopPropagation();
          if (video.ct?.cl) {
            window.location.href = video.ct.cl;
          }
        }}
      >
        View Collection
      </button>
    </>
  );

  // Special renderContentFour with frame overlay
  const renderContentFourWithFrame = () => (
    <div className="ins-shoppable-video-card-with-frame">
      {renderVideoContent()}
      {video.p[0] && (
        <div className="ins-shoppable-video-card-product-info">
          <div className="ins-shoppable-video-card-product-details">
            <div className="ins-shoppable-video-card-product-image-container">
              <img
                className="ins-shoppable-video-card-product-image"
                loading="lazy"
                src={video.p[0].v?.[0]?.im || video.p[0].im}
                alt={video.p[0].t}
              />
            </div>
            <h3 className="ins-shoppable-video-card-product-name">
              {video.p[0].t?.toLowerCase() ?? ""}
            </h3>
            <p className="ins-shoppable-video-card-product-price">
              {priceToDisplay}
              {comparePriceEnabled && video.p[0]?.c > video.p[0]?.pr && (
                <span className="ins-shoppable-video-card-compare-price">
                  {comparePriceToDisplay}
                </span>
              )}
            </p>
          </div>
        </div>
      )}
      {video?.p?.[0]?.v?.length > 1 &&
      variantSliderEnabled &&
      purchaseFlowAction !== "pdp" ? (
        <VariantSelector
          options={video.p[0].o}
          variants={video.p[0].v}
          onPurchase={handlePurchase}
          addToCartStatus={addingToCartStatus}
        />
      ) : (
        <button
          className="ins-shoppable-video-card-add-to-cart"
          onClick={(e) => {
            e.stopPropagation();
            if (purchaseFlowAction === "pdp" && !storeFrontCartOperation) {
              window.location.href = "/products/" + video.p[0].h;
              return;
            }
            if (shouldSkipLocalInventoryChecks) {
              handlePurchase(video.p[0].vi);
              return;
            }
            const variant = video?.p?.[0]?.v?.[0];
            if (variant && isVariantAvailable(variant)) {
              handlePurchase(video.p[0].vi);
              return;
            }
            console.log("no stock");
          }}
        >
          {shouldSkipLocalInventoryChecks
            ? getButtonText(addingToCartStatus)
            : video?.p?.[0]?.v?.[0] &&
              isVariantMarkedOutOfStock(video.p[0].v[0])
            ? getButtonText("out-of-stock")
            : getButtonText(addingToCartStatus)}
        </button>
      )}

      {/* Frame overlay using actual PNG images */}
      <div className="ins-shoppable-video-card-frame-overlay">
        <img
          className="ins-shoppable-video-card-frame-desktop"
          src="https://res.cloudinary.com/dzvudjhyh/image/upload/v1758685785/Desktop_1_alfwpy.png"
          alt="Frame"
        />
        <img
          className="ins-shoppable-video-card-frame-mobile"
          src="https://res.cloudinary.com/dzvudjhyh/image/upload/v1758685821/mobile_1_lhdaw2.png"
          alt="Frame"
        />
      </div>
    </div>
  );

  //Custom card style for HealthFab
  const renderContentHfb = () => {
    const isProductPage = window.location.pathname.includes("/products/");
    return (
      <>
        {renderVideoContent()}
        {video.p[0] && (
          <div className="ins-shoppable-video-card-product-info">
            <div className="ins-shoppable-video-card-product-details">
              <div className="ins-shoppable-video-card-product-image-container">
                <img
                  className="ins-shoppable-video-card-product-image"
                  loading="lazy"
                  src={video.p[0].v[0].im}
                  alt={video.p[0].t}
                />
              </div>
            </div>
          </div>
        )}
        <div className="ins-shoppable-video-card-doctor-section">
          <h2 className="ins-shoppable-video-card-doctor-name">
            {isProductPage ? video.s : video.t}
          </h2>
          {/* <button
            className="ins-shoppable-video-card-add-to-cart"
            onClick={(e) => {
              e.stopPropagation();
              handlePurchase();
            }}
          >
            {addingToCartStatus == "add"
              ? "Add To Cart"
              : addingToCartStatus == "adding"
                ? "Adding To Cart..."
                : "Added"}
          </button> */}
        </div>
      </>
    );
  };
  const renderProductPageHfbVideos = () => (
    <>
      {renderVideoContent()}
      <div className="ins-shoppable-video-card-title-overlay">
        <div className="ins-shoppable-video-card-title">{video.s}</div>
      </div>
    </>
  );

  //Custom card style for Dharishah Ayurveda
  const renderContentDha = () => (
    <>
      {renderVideoContent()}
      <div className="ins-shoppable-video-card-title-section">
        <h2
          style={{ color: "white" }}
          className="ins-shoppable-video-card-title"
        >
          {video.t}
        </h2>
        <p
          style={{ color: "rgb(255, 255, 255, 0.8)" }}
          className="ins-shoppable-video-card-subtitle"
        >
          {video.s}
        </p>
      </div>
    </>
  );

  const renderContentWithNoProducts = () => <>{renderVideoContent()}</>;

  // Render different designs based on the 'design' prop
  const renderDesign = () => {
    const shopDomain = (window as any).Shopify?.shop;
    const isProductPage = window.location.pathname.includes("/products/");

    if (
      isProductPage &&
      design === "custom" &&
      (shopDomain === "healthfabindia.myshopify.com" ||
        shopDomain === "dhyanstore.myshopify.com" ||
        shopDomain === "caresmith-india-cd1f.myshopify.com")
    ) {
      return renderProductPageHfbVideos();
    }
    if (design === "custom") {
      // HFB card for healthfab domain
      if (
        shopDomain === "healthfabindia.myshopify.com" ||
        shopDomain === "dhyanstore.myshopify.com" ||
        shopDomain === "caresmith-india-cd1f.myshopify.com"
      ) {
        return renderContentHfb();
      }

      // DHA card for ziolktest and dhyanstore domains, and all other cases
      if (shopDomain === "ziolktest.myshopify.com" || shopDomain) {
        return renderContentDha();
      }
    }
    // Handle other designs
    switch (design) {
      case "one":
        return renderContentOne();
      case "two":
        return renderContentTwo();
      case "three":
        return renderContentThree();
      case "four":
        // Check if video has custom CTA but no products
        if (!video.p && video.ct) {
          return renderContentFourWithCTA();
        }
        // Special frame overlay for utkarsh-s.myshopify.com
        if (
          shopDomain === "utkarsh-s.myshopify.com" ||
          shopDomain === "hoindiacl.myshopify.com"
        ) {
          return renderContentFourWithFrame();
        }
        return renderContentFour();
      default:
        // Check if video has custom CTA but no products
        if (!video.p && video.ct) {
          return renderContentFourWithCTA();
        }
        // Special frame overlay for utkarsh-s.myshopify.com
        if (shopDomain === "utkarsh-s.myshopify.com") {
          return renderContentFourWithFrame();
        }
        return renderContentFour();
    }
  };

  const shouldShowProductless = () => {
    const isProductPage = window.location.pathname.includes("/products/");
    const { isTestimonial } = useShortVideosModalContext();

    if (isTestimonial) {
      return true;
    }

    // if (
    //   design === "custom" &&
    //   (!video.t || video.t === "Untitled") &&
    //   !isProductPage
    // ) {
    //   return true;
    // }

    if (!video.p) {
      // Special case for Dharishah Ayurveda domain - show custom card even without products
      if (
        design === "custom" &&
        (window as any).Shopify?.shop === "dff598-2.myshopify.com"
      ) {
        return false;
      }

      // If no products but has custom CTA, show card four instead of productless
      if (video.ct && design === "four") {
        return false;
      }

      return true;
    }

    return false;
  };

  const getCardClassName = () => {
    const baseClass = "ins-shoppable-video-card";

    if (shouldShowProductless()) {
      return `${baseClass} ins-shoppable-video-card-productless`;
    }

    if (design === "custom") {
      const shopDomain = (window as any).Shopify?.shop;
      const isProductPage = window.location.pathname.includes("/products/");

      if (
        (shopDomain === "healthfabindia.myshopify.com" ||
          shopDomain === "dhyanstore.myshopify.com" ||
          shopDomain === "caresmith-india-cd1f.myshopify.com") &&
        isProductPage
      ) {
        return `${baseClass} ins-shoppable-video-card-hfb-product`;
      }

      if (
        shopDomain === "healthfabindia.myshopify.com" ||
        shopDomain === "dhyanstore.myshopify.com" ||
        shopDomain === "caresmith-india-cd1f.myshopify.com"
      ) {
        return `${baseClass} ins-shoppable-video-card-hfb`;
      }

      return `${baseClass} ins-shoppable-video-card-dha`;
    }

    if (
      shopDomain === "utkarsh-s.myshopify.com" ||
      shopDomain === "hoindiacl.myshopify.com"
    ) {
      return `${baseClass} ins-shoppable-video-card-four-with-frame`;
    }

    return `${baseClass} ins-shoppable-video-card-${design}`;
  };

  const { frameDesign } = useShortVideosModalContext();

  const renderCardWithFrame = () => {
    const cardContent = (
      <div
        key={video.i}
        className={getCardClassName()}
        onClick={setCurrentItemActive}
        ref={cardRef}
      >
        {shouldShowProductless()
          ? renderContentWithNoProducts()
          : renderDesign()}
      </div>
    );

    switch (frameDesign) {
      case "CIRCLE":
        return <FilmStripFrame>{cardContent}</FilmStripFrame>;
      case "DIAMOND":
        return <DiamondFilmStripFrame>{cardContent}</DiamondFilmStripFrame>;
      case "SEMI_CIRCLE":
        return (
          <SemiCircleFilmStripFrame>{cardContent}</SemiCircleFilmStripFrame>
        );
      case "NONE":
      default:
        return (
          <div
            key={video.i}
            className={getCardClassName()}
            onClick={setCurrentItemActive}
            ref={cardRef}
          >
            {shouldShowProductless()
              ? renderContentWithNoProducts()
              : renderDesign()}
          </div>
        );
    }
  };

  return renderCardWithFrame();
};

export default ShoppableReelPreviewCardBase;

const FilmStripFrame = ({ children }: { children: ComponentChildren }) => {
  const frameStyle = {
    backgroundColor: "transparent",
    padding: "0px",
    display: "inline-flex",
    justifyContent: "center",
    alignItems: "center",
    position: "relative" as const,
    borderRadius: "8px",
  };
  const filmStripStyle = {
    position: "absolute" as const,
    top: 0,
    bottom: 0,
    width: "20px",
    backgroundColor: "var(--frame-color, #000000)",
    display: "flex",
    flexDirection: "column" as const,
    justifyContent: "space-around",
    alignItems: "center",
    padding: "2px 0",
    zIndex: 3,
    borderRadius: "10px",
  };
  const topBottomStripStyle = {
    position: "absolute" as const,
    left: 0,
    right: 0,
    height: "20px",
    backgroundColor: "var(--frame-color, #000000)",
    display: "flex",
    justifyContent: "space-around",
    alignItems: "center",
    padding: "0 2px",
    zIndex: 2,
    borderRadius: "10px",
  };
  const sprocketHoleStyle = {
    width: "8px",
    height: "8px",
    backgroundColor: "var(--frame-pattern-color, #FFFFFF)",
    borderRadius: "50%",
  };
  return (
    <div style={frameStyle} className="ins-video-frame-wrapper">
      <div
        style={{ ...filmStripStyle, left: 0 }}
        className="ins-video-frame-left"
      >
        {Array.from({ length: 34 }).map((_, index) => (
          <div
            key={`left-${index}`}
            style={sprocketHoleStyle}
            className="ins-video-frame-pattern"
          />
        ))}
      </div>

      <div
        style={{ ...filmStripStyle, right: 0 }}
        className="ins-video-frame-right"
      >
        {Array.from({ length: 34 }).map((_, index) => (
          <div
            key={`right-${index}`}
            style={sprocketHoleStyle}
            className="ins-video-frame-pattern"
          />
        ))}
      </div>

      <div
        style={{ ...topBottomStripStyle, top: 0 }}
        className="ins-video-frame-top"
      >
        {Array.from({ length: 18 }).map((_, index) => (
          <div
            key={`top-${index}`}
            style={sprocketHoleStyle}
            className="ins-video-frame-pattern"
          />
        ))}
      </div>

      <div
        style={{ ...topBottomStripStyle, bottom: 0 }}
        className="ins-video-frame-bottom"
      >
        {Array.from({ length: 18 }).map((_, index) => (
          <div
            key={`bottom-${index}`}
            style={sprocketHoleStyle}
            className="ins-video-frame-pattern"
          />
        ))}
      </div>

      <div
        style={{ zIndex: 1, padding: "20px" }}
        className="ins-video-frame-content"
      >
        {children}
      </div>
    </div>
  );
};

const DiamondFilmStripFrame = ({
  children,
}: {
  children: ComponentChildren;
}) => {
  const frameStyle = {
    backgroundColor: "transparent",
    padding: "0px",
    display: "inline-flex",
    justifyContent: "center",
    alignItems: "center",
    position: "relative" as const,
    borderRadius: "8px",
  };
  const filmStripStyle = {
    position: "absolute" as const,
    top: 0,
    bottom: 0,
    width: "20px",
    backgroundColor: "var(--frame-color, #000000)",
    display: "flex",
    flexDirection: "column" as const,
    justifyContent: "space-around",
    alignItems: "center",
    padding: "2px 0",
    zIndex: 3,
    borderRadius: "10px",
  };
  const topBottomStripStyle = {
    position: "absolute" as const,
    left: 0,
    right: 0,
    height: "20px",
    backgroundColor: "var(--frame-color, #000000)",
    display: "flex",
    justifyContent: "space-around",
    alignItems: "center",
    padding: "0 2px",
    zIndex: 2,
    borderRadius: "10px",
  };
  const sprocketHoleStyle = {
    width: "8px",
    height: "8px",
    backgroundColor: "var(--frame-pattern-color, #FFFFFF)",
    transform: "rotate(45deg)",
  };
  return (
    <div style={frameStyle} className="ins-video-frame-wrapper">
      <div
        style={{ ...filmStripStyle, left: 0 }}
        className="ins-video-frame-left"
      >
        {Array.from({ length: 34 }).map((_, index) => (
          <div
            key={`left-${index}`}
            style={sprocketHoleStyle}
            className="ins-video-frame-pattern"
          />
        ))}
      </div>

      <div
        style={{ ...filmStripStyle, right: 0 }}
        className="ins-video-frame-right"
      >
        {Array.from({ length: 34 }).map((_, index) => (
          <div
            key={`right-${index}`}
            style={sprocketHoleStyle}
            className="ins-video-frame-pattern"
          />
        ))}
      </div>

      <div
        style={{ ...topBottomStripStyle, top: 0 }}
        className="ins-video-frame-top"
      >
        {Array.from({ length: 18 }).map((_, index) => (
          <div
            key={`top-${index}`}
            style={sprocketHoleStyle}
            className="ins-video-frame-pattern"
          />
        ))}
      </div>

      <div
        style={{ ...topBottomStripStyle, bottom: 0 }}
        className="ins-video-frame-bottom"
      >
        {Array.from({ length: 18 }).map((_, index) => (
          <div
            key={`bottom-${index}`}
            style={sprocketHoleStyle}
            className="ins-video-frame-pattern"
          />
        ))}
      </div>

      <div
        style={{ zIndex: 1, padding: "20px" }}
        className="ins-video-frame-content"
      >
        {children}
      </div>
    </div>
  );
};

const SemiCircleFilmStripFrame = ({
  children,
}: {
  children: ComponentChildren;
}) => {
  const frameStyle = {
    backgroundColor: "transparent",
    padding: "0px",
    display: "inline-flex",
    justifyContent: "center",
    alignItems: "center",
    position: "relative" as const,
    borderRadius: "8px",
  };
  const filmStripStyle = {
    position: "absolute" as const,
    top: 0,
    bottom: 0,
    width: "20px",
    backgroundColor: "var(--frame-color, #000000)",
    display: "flex",
    flexDirection: "column" as const,
    justifyContent: "space-around",
    alignItems: "center",
    padding: "2px 0",
    zIndex: 3,
    borderRadius: "10px",
  };
  const topBottomStripStyle = {
    position: "absolute" as const,
    left: 0,
    right: 0,
    height: "20px",
    backgroundColor: "var(--frame-color, #000000)",
    display: "flex",
    justifyContent: "space-around",
    alignItems: "center",
    padding: "0 2px",
    zIndex: 2,
    borderRadius: "10px",
  };
  const sprocketHoleStyleRight = {
    width: "10px",
    height: "5px",
    backgroundColor: "var(--frame-pattern-color, #FFFFFF)",
    borderRadius: "5px 5px 0 0",
    transform: "rotate(270deg)",
  };

  const sprocketHoleStyleLeft = {
    width: "10px",
    height: "5px",
    backgroundColor: "var(--frame-pattern-color, #FFFFFF)",
    borderRadius: "5px 5px 0 0",
    transform: "rotate(90deg)",
  };

  const sprocketHoleStyleTop = {
    width: "10px",
    height: "5px",
    backgroundColor: "var(--frame-pattern-color, #FFFFFF)",
    borderRadius: "5px 5px 0 0",
    transform: "rotate(180deg)",
  };

  const sprocketHoleStyleBottom = {
    width: "10px",
    height: "5px",
    backgroundColor: "var(--frame-pattern-color, #FFFFFF)",
    borderRadius: "5px 5px 0 0",
  };

  return (
    <div style={frameStyle} className="ins-video-frame-wrapper">
      <div
        style={{ ...filmStripStyle, left: 0 }}
        className="ins-video-frame-left"
      >
        {Array.from({ length: 32 }).map((_, index) => (
          <div
            key={`left-${index}`}
            style={sprocketHoleStyleLeft}
            className="ins-video-frame-pattern"
          />
        ))}
      </div>

      <div
        style={{ ...filmStripStyle, right: 0 }}
        className="ins-video-frame-right"
      >
        {Array.from({ length: 32 }).map((_, index) => (
          <div
            key={`right-${index}`}
            style={sprocketHoleStyleRight}
            className="ins-video-frame-pattern"
          />
        ))}
      </div>

      <div
        style={{ ...topBottomStripStyle, top: 0 }}
        className="ins-video-frame-top"
      >
        {Array.from({ length: 18 }).map((_, index) => (
          <div
            key={`top-${index}`}
            style={sprocketHoleStyleTop}
            className="ins-video-frame-pattern"
          />
        ))}
      </div>

      <div
        style={{ ...topBottomStripStyle, bottom: 0 }}
        className="ins-video-frame-bottom"
      >
        {Array.from({ length: 18 }).map((_, index) => (
          <div
            key={`bottom-${index}`}
            style={sprocketHoleStyleBottom}
            className="ins-video-frame-pattern"
          />
        ))}
      </div>

      <div
        style={{ zIndex: 1, padding: "20px" }}
        className="ins-video-frame-content"
      >
        {children}
      </div>
    </div>
  );
};
