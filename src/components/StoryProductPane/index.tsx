import type { Product, ShortVideo } from "../../types/api";
import "../../styles/story-reels.scss";
import StoryProductDetailsModal from "../StoryProductDetailsModal";
import { useEffect, useState } from "preact/hooks";
import { useStoryVideosModalContext } from "../../context/StoryVideosModalContext";
import { instasellStoryEmbedConfig } from "../../story-index";
import { useApi } from "../../lib/api";
import { addToCartDrawer } from "../../lib/addToCartDrawer";
import { useGAEvents } from "../../context/GoogleAnalytics";
import { useCleverTapEvents } from "../../context/ClevertapAnalytics";
import { useMetaEvents } from "../../context/MetaEventsContext";

export const formatCurrency = (amount: number, currency: string = "INR") => {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(amount);
  } catch (err) {
    return `₹${amount}`;
  }
};

const StoryProductPane = ({
  video,
  handleVideoControl,
  onMute,
}: {
  video: ShortVideo;
  handleVideoControl: (pause: boolean) => void;
  onMute?: () => void;
}) => {
  let currencyCode = instasellStoryEmbedConfig.getCurrencyCode?.() || "INR";
  let currencyRate = instasellStoryEmbedConfig.getCurrencyRate?.() || 1;
  let country = instasellStoryEmbedConfig.getCountry?.() || "IN";
  const {
    setIsProductDetailsModalOpen,
    setActiveProductIndex,
    isProductDetailsModalOpen,
    purchaseFlowAction,
    storySessionToken,
    googleAnalyticsEnabled,
    useGtmForAnalytics,
    clevertapAnalyticsEnabled,
    metaRetargetingEnabled,
    shopNowText,
    comparePriceEnabled,
    discountBadgeEnabled,
    storeFrontCartOperation,
    storeFrontAccessKey,
  } = useStoryVideosModalContext();
  const [activeProduct, setProductPane] = useState<Product | null>(null);
  const [loadingProducts, setLoadingProducts] = useState<{
    [key: string]: boolean;
  }>({});
  const api = useApi();
  const gaEvents = useGAEvents();
  const caEvents = useCleverTapEvents();
  const fbEvents = useMetaEvents();

  const [addedToCartProducts, setAddedToCartProducts] = useState<{
    [key: string]: boolean;
  }>({});
  const [outOfStockProducts, setOutOfStockProducts] = useState<{
    [key: string]: boolean;
  }>({});

  const pageType = instasellStoryEmbedConfig.getPageType?.();
  const pageId =
    pageType == "home"
      ? ""
      : pageType == "product"
      ? instasellStoryEmbedConfig.currentProductId ?? ""
      : instasellStoryEmbedConfig.currentCollectionId ?? "";

  // Function to calculate discount percentage
  const calculateDiscountPercentage = (product: Product) => {
    const currentPrice =
      product.cp != null ? product.cp?.[country].pr || 0 : product.pr || 0;

    const originalPrice =
      product.cp != null ? product.cp?.[country].cs || 0 : product.c || 0;

    if (originalPrice > 0 && currentPrice > 0 && originalPrice > currentPrice) {
      const discount = ((originalPrice - currentPrice) / originalPrice) * 100;
      return Math.round(discount);
    }
    return 0;
  };

  const regex = /^[^\w\s\d]0$/;

  const comparePrice = (product: Product) => {
    return product.cp != null
      ? formatCurrency(
          (product.cp?.[country].cs || 0) * (currencyRate || 1),
          currencyCode
        )
      : formatCurrency((product.c || 0) * (currencyRate || 1), currencyCode);
  };

  useEffect(() => {
    if (isProductDetailsModalOpen) {
      handleVideoControl(true);
    } else {
      handleVideoControl(false);
    }
  }, [isProductDetailsModalOpen]);

  const handlePurchase = async (product: Product) => {
    if (!product.vi) return;

    // Mute the video when Add to Cart is clicked (always mute, don't toggle)
    if (onMute) {
      onMute(); // Update global state so icon changes
    }
    // Also mute the video element directly
    const videoElement = document.querySelector("video");
    if (videoElement) {
      (videoElement as HTMLVideoElement).muted = true;
    }

    const variantId = product.vi;
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
              setOutOfStockProducts((prev) => ({
                ...prev,
                [product.i]: true,
              }));
              setLoadingProducts((prev) => ({ ...prev, [product.i]: false }));
              return;
            }
            setOutOfStockProducts((prev) => ({
              ...prev,
              [product.i]: false,
            }));
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
            source: "story",
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
            instasellStoryEmbedConfig.pageType,
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
            instasellStoryEmbedConfig.pageType,
            video.m[0].v
          );
        }
        if (metaRetargetingEnabled) {
          fbEvents.trackAddToCart(
            product.i,
            1,
            variantId,
            "video-carousel",
            instasellStoryEmbedConfig.pageType,
            video.m[0].v ?? ""
          );
        }

        setAddedToCartProducts((prev) => ({ ...prev, [product.i]: true }));
        setOutOfStockProducts((prev) => ({
          ...prev,
          [product.i]: false,
        }));
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
      }
      return;
    }

    try {
      let drawerAddSuccess = false;

      if (!storeFrontCartOperation) {
        drawerAddSuccess = await addToCartDrawer(variantId, product.pi);
      }

      if (!drawerAddSuccess && !storeFrontCartOperation) {
        await instasellStoryEmbedConfig.addToCart(
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
              productId: product.pi,
              variantId: variantId,
            });

            console.log("Stock status :", stockStatus);

            if (stockStatus !== "in stock") {
              setOutOfStockProducts((prev) => ({
                ...prev,
                [product.i]: true,
              }));
              setLoadingProducts((prev) => ({ ...prev, [product.i]: false }));
              return;
            }
            setOutOfStockProducts((prev) => ({
              ...prev,
              [product.i]: false,
            }));
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
        }
      } else {
        const cart = await instasellStoryEmbedConfig.getCurrentCart();
        if (!cart) {
          throw new Error("Failed to verify cart update");
        }

        try {
          await instasellStoryEmbedConfig.updateCartInfo(orderAttributionToken);
        } catch (error) {
          console.log(`%cFailed to update cart: ${error}`, "color: red;");
        }
        await api.shortVideosBoron({
          eventType: "addToCart",
          addToCart: {
            shortVideoId: video.i,
            productId: product.i,
            providerCartId: cart.token,
            variantId: variantId,
            quantity: 1,
            orderAttributionToken,
          },
          source: "story",
          pageType,
          pageId,
        });
        sessionStorage.setItem("sessionTime", Date.now().toString());
      }

      setOutOfStockProducts((prev) => ({
        ...prev,
        [product.i]: false,
      }));

      if (googleAnalyticsEnabled) {
        gaEvents.trackAddToCart(
          product.i,
          1,
          variantId,
          "video-story",
          instasellStoryEmbedConfig.pageType,
          video.i ?? "",
          useGtmForAnalytics
        );
      }
      if (clevertapAnalyticsEnabled) {
        caEvents.trackAddToCart(
          product.i,
          1,
          variantId,
          "video-carousel",
          instasellStoryEmbedConfig.pageType,
          video.i ?? ""
        );
      }
      if (metaRetargetingEnabled) {
        fbEvents.trackAddToCart(
          product.i,
          1,
          variantId,
          "video-carousel",
          instasellStoryEmbedConfig.pageType,
          video.i ?? ""
        );
      }

      if (!drawerAddSuccess && !storeFrontCartOperation) {
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
    }
  };

  const handleShopNow = async (product: Product, i: number) => {
    // Mute the video when Shop Now is clicked (always mute, don't toggle)
    if (onMute) {
      onMute(); // Update global state so icon changes
    }
    // Also mute the video element directly
    const videoElement = document.querySelector("video");
    if (videoElement) {
      (videoElement as HTMLVideoElement).muted = true;
    }

    try {
      if (product.v?.length > 1 && purchaseFlowAction === "popUp") {
        setProductPane(product);
        setIsProductDetailsModalOpen(true);
        setActiveProductIndex(i);
      } else if (purchaseFlowAction === "pdp" && !storeFrontCartOperation) {
        window.location.href = "/products/" + product.h;
      } else {
        await handlePurchase(product);
      }
    } catch (err) {
      console.log(`%cFailed to fetch product details: ${err}`, "color: red;");
      await handlePurchase(product);
    }
  };

  const shopDomain = instasellStoryEmbedConfig.getShopDomain?.() || "";

  const getButtonText = (product: Product) => {
    if (shopDomain === "buywow.in" && outOfStockProducts[product.i]) {
      return "Out of stock";
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
        ].includes(shopDomain)
      ? "ADD TO CART"
      : shopNowText
      ? shopNowText
      : "Shop Now";
  };

  return (
    <>
      {activeProduct != null ? (
        <StoryProductDetailsModal
          activeProduct={activeProduct}
          onMute={onMute}
        />
      ) : null}
      <div
        className="ins-reel-player-product-panel-2"
        style={{
          justifyContent: video.p.length == 1 ? "center" : "start",
          gap: "20px",
          padding: video.p.length == 1 ? "0px" : "0 40px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {video.p.map((product, i) => (
          <div
            className="ins-product-panel-item"
            onClick={(e) => {
              e.stopPropagation();
              handleShopNow(product, i);
            }}
            style={{
              marginRight:
                i == video.p.length - 1 && video.p.length != 1 ? "80px" : "0px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                className="ins-product-panel-item-thumbnail"
                style={{
                  backgroundImage: `url(${product.im})`,
                }}
              ></div>
              <div className="ins-product-panel-item-details">
                <div>
                  <p className="ins-product-panel-item-title">
                    {product.t?.toLowerCase() ?? ""}
                  </p>
                  <div className="ins-product-panel-item-price-container">
                    <p className="ins-product-panel-item-price">
                      {product.cp != null
                        ? formatCurrency(
                            (product.cp?.[country].pr || 0) *
                              (currencyRate || 1),
                            currencyCode
                          )
                        : formatCurrency(
                            (product.pr || 0) * (currencyRate || 1),
                            currencyCode
                          )}
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
        ))}
      </div>
    </>
  );
};

export default StoryProductPane;
