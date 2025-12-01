import { useEffect, useState } from "preact/hooks";
import { useApi } from "../../lib/api";
import { Product } from "../../types/api";
import { useStoryVideosModalContext } from "../../context/StoryVideosModalContext";
import "../../styles/story-reels.scss";
import { formatCurrency } from "../StoryProductPane";
import { instasellStoryEmbedConfig } from "../../story-index";
import { addToCartDrawer } from "../../lib/addToCartDrawer";
import { useGAEvents } from "../../context/GoogleAnalytics";
import { useMetaEvents } from "../../context/MetaEventsContext";
import { useCleverTapEvents } from "../../context/ClevertapAnalytics";

type StoryProductDetailsModalProps = {
  activeProduct: Product | null;
  onMute?: () => void;
};

const StoryProductDetailsModal = ({
  activeProduct,
  onMute,
}: StoryProductDetailsModalProps) => {
  let currencyCode = instasellStoryEmbedConfig.getCurrencyCode?.() || "INR";
  let currencyRate = instasellStoryEmbedConfig.getCurrencyRate?.() || 1;
  let country = instasellStoryEmbedConfig.getCountry?.() || "IN";
  const shopDomain = instasellStoryEmbedConfig.getShopDomain?.();
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
  const api = useApi();
  const {
    isProductDetailsModalOpen,
    isDesktop,
    setIsProductDetailsModalOpen,
    activeVideoId,
    storySessionToken,
    googleAnalyticsEnabled,
    useGtmForAnalytics,
    clevertapAnalyticsEnabled,
    metaRetargetingEnabled,
    comparePriceEnabled,
    discountBadgeEnabled,
    displayAllProductImagesEnabled,
    storeFrontCartOperation,
    storeFrontAccessKey,
    shortVideos,
  } = useStoryVideosModalContext();

  const activeVideo = activeVideoId
    ? shortVideos.find((v) => v.i === activeVideoId) || null
    : null;

  const [fetchedProduct, setFetchedProduct] = useState<Product | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    null
  );
  const [addingToCart, setAddingToCart] = useState<boolean>(false);
  const [addedToCart, setAddedToCart] = useState(false);
  const [outOfStockError, setOutOfStockError] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<{
    [key: string]: string;
  }>({});
  const [fullProductData, setFullProductData] = useState<any | null>(null);
  const [fullProductImages, setFullProductImages] = useState<string[]>([]);
  const [loadingFullProduct, setLoadingFullProduct] = useState(false);
  const gaEvents = useGAEvents();
  const caEvents = useCleverTapEvents();
  const fbEvents = useMetaEvents();
  const pageType = instasellStoryEmbedConfig.getPageType?.();
  const pageId =
    pageType == "home"
      ? ""
      : pageType == "product"
      ? instasellStoryEmbedConfig.currentProductId ?? ""
      : instasellStoryEmbedConfig.currentCollectionId ?? "";

  const product = fetchedProduct || activeProduct;

  const showCountrySpecificPricing = product?.cp != null;

  const getSelectedVariant = () => {
    if (!product?.v || !selectedVariantId) return null;
    return product.v.find((variant) => variant.pi === selectedVariantId);
  };

  const calculatePrice = (basePrice: number) => {
    if (isDhaaga && convercySettings?.enabled) {
      const { base, curr, rate } = convercySettings;
      let sourceCurrency: string;
      if (showCountrySpecificPricing && product?.cp?.[country]?.cc) {
        sourceCurrency = product.cp[country].cc;
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

  const handleOptionSelect = (optionName: string, optionValue: string) => {
    if (!fetchedProduct) return;

    const newSelectedOptions = {
      ...selectedOptions,
      [optionName]: optionValue,
    };

    setSelectedOptions(newSelectedOptions);

    const selectedValues = fetchedProduct.o
      .map(
        (option) =>
          newSelectedOptions[option.n as keyof typeof newSelectedOptions] ||
          option.v[0]
      )
      .join(" / ");

    const matchingVariant = fetchedProduct.v.find(
      (variant) => variant.v === selectedValues
    );

    if (matchingVariant) {
      setSelectedVariantId(matchingVariant.pi);
    }
  };

  const getOptionButtonClass = (option: any, value: string): string => {
    if (!selectedOptions[option.n as keyof typeof selectedOptions]) return "";

    const isSelected =
      selectedOptions[option.n as keyof typeof selectedOptions] === value;

    const tempSelections = {
      ...selectedOptions,
      [option.n]: value,
    };

    const selectedValues = fetchedProduct?.o
      .map(
        (opt) =>
          tempSelections[opt.n as keyof typeof tempSelections] || opt.v[0]
      )
      .join(" / ");

    const variantForThisOption = fetchedProduct?.v.find(
      (v) => v.v === selectedValues
    );

    // Check if variant is out of stock using the same logic as shoppable-reel-preview-card
    const isOutOfStock = variantForThisOption
      ? (() => {
          // If policy is CONTINUE, always allow (backorders enabled)
          if (variantForThisOption.ip === "CONTINUE") {
            return false;
          }

          // If policy is DENY but stock is positive, allow
          if (
            variantForThisOption.ip === "DENY" &&
            variantForThisOption.s > 0
          ) {
            return false;
          }

          // If policy is DENY and stock is 0 or negative, use availableForSale
          if (
            variantForThisOption.ip === "DENY" &&
            variantForThisOption.s <= 0
          ) {
            return !variantForThisOption.af;
          }

          return false; // fallback - not out of stock
        })()
      : true;

    if (isSelected) {
      return isOutOfStock
        ? "ins-product-details-variants-item__active ins-product-details-variants-item__out-of-stock"
        : "ins-product-details-variants-item__active";
    }

    return isOutOfStock
      ? "ins-product-details-variants-item__out-of-stock"
      : "";
  };

  const priceToDisplay = showCountrySpecificPricing
    ? (() => {
        const basePrice =
          getSelectedVariant()?.cp?.[country].pr ?? product?.pr ?? 0;
        const { price, currency } = calculatePrice(basePrice);
        return formatCurrency(price, currency);
      })()
    : (() => {
        const basePrice = getSelectedVariant()?.pr ?? product?.pr ?? 0;
        const { price, currency } = calculatePrice(basePrice);
        return formatCurrency(price, currency);
      })();

  const shouldShowComparePrice = () => {
    if (!comparePriceEnabled || !product) return false;

    const selectedVariant = getSelectedVariant();
    const comparePriceValue = showCountrySpecificPricing
      ? selectedVariant?.cp?.[country]?.cs ??
        product?.cp?.[country]?.cs ??
        product?.c ??
        0
      : product?.c ?? 0;

    const currentPrice = showCountrySpecificPricing
      ? selectedVariant?.cp?.[country]?.pr ??
        product?.cp?.[country]?.pr ??
        product?.pr ??
        0
      : selectedVariant?.pr ?? product?.pr ?? 0;

    return comparePriceValue > 0 && comparePriceValue > currentPrice;
  };

  const calculateDiscountPercentage = () => {
    if (!product) return 0;

    const selectedVariant = getSelectedVariant();
    const currentPrice = showCountrySpecificPricing
      ? selectedVariant?.cp?.[country]?.pr ??
        product?.cp?.[country]?.pr ??
        product?.pr ??
        0
      : selectedVariant?.pr ?? product?.pr ?? 0;

    const originalPrice = showCountrySpecificPricing
      ? selectedVariant?.cp?.[country]?.cs ??
        product?.cp?.[country]?.cs ??
        product?.c ??
        0
      : product?.c ?? 0;

    if (originalPrice > 0 && currentPrice > 0 && originalPrice > currentPrice) {
      const discount = ((originalPrice - currentPrice) / originalPrice) * 100;
      return Math.round(discount);
    }
    return 0;
  };

  const comparePrice = () => {
    if (!product) return formatCurrency(0, currencyCode);

    const selectedVariant = getSelectedVariant();
    const basePrice = showCountrySpecificPricing
      ? selectedVariant?.cp?.[country]?.cs ?? product.cp?.[country]?.cs ?? 0
      : product?.c || 0;
    const { price, currency } = calculatePrice(basePrice);
    return formatCurrency(price, currency);
  };

  // Handle currency code based on hostname
  switch (window.location.hostname) {
    case "instasell-live-commerce.webflow.io":
    case "instasell.io":
    case "www.twoprettygirlz.com":
    case "two-pretty-girlz.myshopify.com":
      currencyCode = "USD";
      break;
  }

  useEffect(() => {
    const fetchProductDetails = async () => {
      if (!isProductDetailsModalOpen || !activeProduct || fetchedProduct)
        return;

      try {
        const { product } = await api.getProductDetails(activeProduct.i);
        setFetchedProduct(product);

        // Find first in-stock variant to set as default
        const firstInStockVariant = product.v.find((variant) => {
          // If policy is CONTINUE, always allow (backorders enabled)
          if (variant.ip === "CONTINUE") {
            return true;
          }

          // If policy is DENY but stock is positive, allow
          if (variant.ip === "DENY" && variant.s > 0) {
            return true;
          }

          // If policy is DENY and stock is 0 or negative, use availableForSale
          if (variant.ip === "DENY" && variant.s <= 0) {
            return variant.af;
          }

          return true; // fallback
        });

        if (product.o && product.o.length > 0) {
          // If we found an in-stock variant, use its options as defaults
          if (firstInStockVariant) {
            const variantValues = firstInStockVariant.v.split(" / ");
            const defaultSelections = product.o.reduce((acc, option, index) => {
              acc[option.n] = variantValues[index];
              return acc;
            }, {} as { [key: string]: string });

            setSelectedOptions(defaultSelections);
            setSelectedVariantId(firstInStockVariant.pi);
          } else {
            // Fallback to first variant's options if none in stock
            const defaultSelections = product.o.reduce((acc, option) => {
              acc[option.n] = option.v[0];
              return acc;
            }, {} as { [key: string]: string });

            setSelectedOptions(defaultSelections);
            setSelectedVariantId(product.v[0]?.pi || null);
          }
        } else {
          // If no options, select first in stock variant or first variant
          setSelectedVariantId(
            firstInStockVariant?.pi || product.v[0]?.pi || null
          );
        }
      } catch (err) {
        console.log(`%cFailed ot fetch product details: ${err}`, "color: red;");
      }
    };

    fetchProductDetails();
  }, [isProductDetailsModalOpen, activeProduct?.i]);

  useEffect(() => {
    if (!isProductDetailsModalOpen) {
      setFetchedProduct(null);
      setAddedToCart(false);
      setSelectedOptions({});
      setOutOfStockError(false);
    }
  }, [isProductDetailsModalOpen]);

  useEffect(() => {
    let timeoutId: number | undefined;

    if (outOfStockError) {
      timeoutId = window.setTimeout(() => {
        setOutOfStockError(false);
      }, 3000);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [outOfStockError]);

  // Fetch full product data from Shopify API when displayAllProductImagesEnabled is true
  useEffect(() => {
    const fetchFullProductData = async () => {
      if (
        !displayAllProductImagesEnabled ||
        !activeProduct?.h ||
        fullProductData
      )
        return;

      try {
        setLoadingFullProduct(true);
        const productData = await instasellStoryEmbedConfig.fetchProductDetails(
          activeProduct.h
        );
        if (productData) {
          setFullProductData(productData);
          const images =
            instasellStoryEmbedConfig.getProductImages(productData);
          setFullProductImages(images);
        }
      } catch (err) {
        console.log(
          `%cFailed to fetch full product data: ${err}`,
          "color: red;"
        );
      } finally {
        setLoadingFullProduct(false);
      }
    };

    fetchFullProductData();
  }, [displayAllProductImagesEnabled, activeProduct?.h, fullProductData]);

  const closeModal = () => {
    setIsProductDetailsModalOpen(false);
  };

  const openPdpPage = () => {
    window.location.href =
      "/products/" +
      product?.h +
      (selectedVariantId ? `?variant=${selectedVariantId}` : "");
  };

  const handlePurchase = async () => {
    if (!product) return;

    // Mute the video when Add to Cart is clicked (always mute, don't toggle)
    if (onMute) {
      onMute(); // Update global state so icon changes
    }
    // Also mute the video element directly
    const videoElement = document.querySelector("video");
    if (videoElement) {
      (videoElement as HTMLVideoElement).muted = true;
    }

    setAddingToCart(true);
    setOutOfStockError(false);
    const variantId = selectedVariantId || product.v[0]?.pi;

    if (!variantId) {
      console.log(`%cNo variant selected`, "color: red;");
      setAddingToCart(false);
      return;
    }

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
              setAddingToCart(false);
              setOutOfStockError(true);
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
              shortVideoId: activeVideoId ?? "",
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
            activeVideo?.m[0].v ?? "",
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
            activeVideo?.m[0].v ?? ""
          );
        }
        if (metaRetargetingEnabled) {
          fbEvents.trackAddToCart(
            product.i,
            1,
            variantId,
            "video-carousel",
            instasellStoryEmbedConfig.pageType,
            activeVideo?.m[0].v ?? ""
          );
        }

        setAddingToCart(false);
        setAddedToCart(true);
        setOutOfStockError(false);
        setTimeout(() => {
          setAddedToCart(false);
        }, 5000);
      } catch (error) {
        console.log(
          `%cError in storefront cart operation: ${error}`,
          "color: red;"
        );
        setAddingToCart(false);
        setOutOfStockError(false);
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
              setAddingToCart(false);
              setOutOfStockError(true);
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
            shortVideoId: activeVideoId ?? "",
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

      if (googleAnalyticsEnabled) {
        gaEvents.trackAddToCart(
          product.i,
          1,
          variantId,
          "video-story",
          instasellStoryEmbedConfig.pageType,
          activeVideoId ?? "",
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
          activeVideoId ?? ""
        );
      }
      if (metaRetargetingEnabled) {
        fbEvents.trackAddToCart(
          product.i,
          1,
          variantId,
          "video-carousel",
          instasellStoryEmbedConfig.pageType,
          activeVideoId ?? ""
        );
      }

      setAddedToCart(true);
      setOutOfStockError(false);
      setTimeout(() => setAddedToCart(false), 3000);

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
      setAddingToCart(false);
    }
  };

  const isSelectedVariantOutOfStock = (): boolean => {
    const selectedVariant = getSelectedVariant();
    if (!selectedVariant) return false;

    // If policy is CONTINUE, always allow (backorders enabled)
    if (selectedVariant.ip === "CONTINUE") {
      return false;
    }

    // If policy is DENY but stock is positive, allow
    if (selectedVariant.ip === "DENY" && selectedVariant.s > 0) {
      return false;
    }

    // If policy is DENY and stock is 0 or negative, use availableForSale
    if (selectedVariant.ip === "DENY" && selectedVariant.s <= 0) {
      return !selectedVariant.af;
    }

    return false; // fallback
  };

  const getButtonText = () => {
    if (outOfStockError || isSelectedVariantOutOfStock()) {
      return shopDomain === "terredefrance.myshopify.com"
        ? "Rupture de stock"
        : shopDomain === "37f807-2.myshopify.com"
        ? "Agotado"
        : "Out of stock";
    }
    if (addedToCart) {
      return shopDomain === "terredefrance.myshopify.com"
        ? "Ajouté au panier"
        : shopDomain === "37f807-2.myshopify.com"
        ? "Añadido al carrito"
        : shopDomain === "0zqhug-ry.myshopify.com"
        ? "Dodano do koszyka"
        : "Added To Cart";
    }

    if (addingToCart) {
      return shopDomain === "terredefrance.myshopify.com"
        ? "Ajout au panier"
        : shopDomain === "37f807-2.myshopify.com"
        ? "comprando"
        : shopDomain === "0zqhug-ry.myshopify.com"
        ? "Dodawanie..."
        : "Adding to cart...";
    }

    return shopDomain === "terredefrance.myshopify.com"
      ? "Ajouter au panier"
      : shopDomain === "37f807-2.myshopify.com"
      ? "comprar"
      : shopDomain === "0zqhug-ry.myshopify.com"
      ? "Dodaj do koszyka"
      : "ADD TO CART";
  };

  return (
    <>
      <div
        className={`${
          isProductDetailsModalOpen
            ? "ins-product-details-modal-overlay__show"
            : "ins-product-details-modal-overlay__hidden"
        } ${
          isDesktop
            ? "ins-product-details-modal-overlay__is-desktop"
            : "ins-product-details-modal-overlay__is-mobile"
        }`}
        onClick={(e) => {
          e.stopPropagation();
          closeModal();
        }}
      />
      <div
        className={`ins-product-details-modal ${
          isProductDetailsModalOpen
            ? "ins-product-details-modal__show"
            : "ins-product-details-modal__hidden"
        } ${
          isDesktop
            ? "ins-product-details-modal__is-desktop"
            : "ins-product-details-modal__is-mobile"
        }`}
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <div
          className={`${
            isProductDetailsModalOpen
              ? "ins-product-details-modal-close-button__show"
              : "ins-product-details-modal-close-button__hidden"
          }`}
          onClick={closeModal}
        >
          <svg
            width="40"
            height="40"
            viewBox="0 0 28 28"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M14 25.6667C10.905 25.6695 7.93587 24.4412 5.74735 22.2527C3.55882 20.0642 2.33055 17.0951 2.33333 14.0001V13.7667C2.42875 9.09098 5.30577 4.92357 9.64409 3.17696C13.9824 1.43035 18.9444 2.44177 22.253 5.74706C25.5925 9.08382 26.592 14.1043 24.7851 18.4656C22.9781 22.827 18.7209 25.6695 14 25.6667ZM14 15.6451L17.0217 18.6667L18.6667 17.0217L15.645 14.0001L18.6667 10.9784L17.0217 9.33339L14 12.3551L10.9783 9.33339L9.33334 10.9784L12.355 14.0001L9.33334 17.0217L10.9783 18.6667L14 15.6462V15.6451Z"
              fill="white"
            ></path>
          </svg>
        </div>
        <div class="ins-product-details-section">
          {product ? (
            <div class="ins-product-details-container">
              <header class="ins-product-details-header">
                <div
                  style={{
                    "background-image": `url(${product?.im})`,
                  }}
                  class="ins-product-details-image"
                />
                {displayAllProductImagesEnabled && fullProductImages.length > 0
                  ? // Use full product images from Shopify API
                    fullProductImages
                      .filter((img) => img !== product?.im)
                      .map((imageUrl, i) => (
                        <div
                          key={i}
                          style={{
                            "background-image": `url(${imageUrl})`,
                          }}
                          class="ins-product-details-image"
                        />
                      ))
                  : fetchedProduct?.v.map(
                      (variant, i) =>
                        variant.im.length != 0 && (
                          <div
                            key={i}
                            style={{
                              "background-image": `url(${variant?.im})`,
                            }}
                            class="ins-product-details-image"
                          />
                        )
                    )}
              </header>
              <div class="ins-product-details-info">
                <h2 class="ins-product-details-name">
                  {product?.t?.toLowerCase() ?? ""}
                </h2>
                <p class="ins-product-details-price">
                  {priceToDisplay}
                  {shouldShowComparePrice() && (
                    <span className="ins-product-details-strikeoff-price">
                      {comparePrice()}
                    </span>
                  )}
                  {discountBadgeEnabled &&
                    calculateDiscountPercentage() > 0 && (
                      <span className="ins-product-details-discount-badge">
                        Save {calculateDiscountPercentage()}%
                      </span>
                    )}
                </p>
              </div>
              {fetchedProduct?.o && fetchedProduct.o.length > 0 ? (
                <div
                  style={{
                    padding: "0px 20px",
                    marginTop: "10px",
                  }}
                >
                  {fetchedProduct.o.map((option) => (
                    <div
                      key={option.n}
                      style={{
                        "margin-bottom": "14px",
                      }}
                    >
                      <label
                        style={{
                          "font-size": "15px",
                          "margin-bottom": "8px",
                        }}
                      >
                        {option.n}
                      </label>
                      <div
                        className="ins-product-details-variants-button"
                        style={{
                          "margin-top": "4px",
                          whiteSpace: "nowrap",
                          overflowX: "auto",
                          display: "flex",
                          gap: "10px",
                        }}
                      >
                        {option.v.map((value) => (
                          <button
                            key={value}
                            className={`ins-product-details-variants-item ${getOptionButtonClass(
                              option,
                              value
                            )}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOptionSelect(option.n, value);
                            }}
                            disabled={getOptionButtonClass(
                              option,
                              value
                            ).includes("out-of-stock")}
                            style={
                              getOptionButtonClass(option, value).includes(
                                "out-of-stock"
                              )
                                ? {
                                    backgroundColor: "#f5f5f5",
                                    color: "#999",
                                    textDecoration: "line-through",
                                  }
                                : {}
                            }
                          >
                            {value}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : fetchedProduct?.v.length && fetchedProduct?.v.length > 1 ? (
                <div class="ins-product-details-variants-list">
                  {product?.v.map((variant) => (
                    <button
                      class={`ins-product-details-variants-item ${
                        variant.pi == selectedVariantId
                          ? "ins-product-details-variants-item__active"
                          : ""
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        // Check if variant is out of stock using the same logic as shoppable-reel-preview-card
                        const isOutOfStock = (() => {
                          // If policy is CONTINUE, always allow (backorders enabled)
                          if (variant.ip === "CONTINUE") {
                            return false;
                          }

                          // If policy is DENY but stock is positive, allow
                          if (variant.ip === "DENY" && variant.s > 0) {
                            return false;
                          }

                          // If policy is DENY and stock is 0 or negative, use availableForSale
                          if (variant.ip === "DENY" && variant.s <= 0) {
                            return !variant.af;
                          }

                          return false; // fallback - not out of stock
                        })();
                        if (!isOutOfStock) {
                          setSelectedVariantId(variant.pi);
                        }
                      }}
                      disabled={(() => {
                        // If policy is CONTINUE, always allow (backorders enabled)
                        if (variant.ip === "CONTINUE") {
                          return false;
                        }

                        // If policy is DENY but stock is positive, allow
                        if (variant.ip === "DENY" && variant.s > 0) {
                          return false;
                        }

                        // If policy is DENY and stock is 0 or negative, use availableForSale
                        if (variant.ip === "DENY" && variant.s <= 0) {
                          return !variant.af;
                        }

                        return false; // fallback - not out of stock
                      })()}
                      style={(() => {
                        // If policy is CONTINUE, always allow (backorders enabled)
                        if (variant.ip === "CONTINUE") {
                          return {};
                        }

                        // If policy is DENY but stock is positive, allow
                        if (variant.ip === "DENY" && variant.s > 0) {
                          return {};
                        }

                        // If policy is DENY and stock is 0 or negative, use availableForSale
                        if (variant.ip === "DENY" && variant.s <= 0) {
                          return !variant.af
                            ? {
                                backgroundColor: "#f5f5f5",
                                color: "#999",
                                textDecoration: "line-through",
                              }
                            : {};
                        }

                        return {}; // fallback - not out of stock
                      })()}
                    >
                      {variant.v}
                    </button>
                  ))}
                </div>
              ) : null}
              {fetchedProduct && (
                <div
                  class="ins-product-details-description-container"
                  dangerouslySetInnerHTML={{ __html: fetchedProduct.d }}
                />
              )}

              <div className="ins-product-details-button-container">
                {fetchedProduct?.v && (
                  <button
                    className={`ins-product-details-buy-now-button ${
                      isSelectedVariantOutOfStock() || outOfStockError
                        ? "ins-product-details-out-of-stock-button"
                        : ""
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePurchase();
                    }}
                    disabled={
                      addingToCart ||
                      isSelectedVariantOutOfStock() ||
                      outOfStockError
                    }
                    style={
                      isSelectedVariantOutOfStock() || outOfStockError
                        ? {
                            backgroundColor: "#f5f5f5",
                            color: "#999",
                            cursor: "not-allowed",
                          }
                        : {}
                    }
                  >
                    {getButtonText()}
                  </button>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
};

export default StoryProductDetailsModal;
