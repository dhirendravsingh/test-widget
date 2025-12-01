import { useState, useEffect } from "preact/hooks";
import { instasellLiveEmbedConfig } from "../..";
import { useShortVideosModalContext } from "../../context/ShortVideosModalContext";
import { useApi } from "../../lib/api";
import { formatCurrency } from "../../lib/utils";
import type {
  Product,
  ProductOption,
  ProductVariant,
  ShortVideo,
} from "../../types/api";
import { MAIN_API_BASE_URL } from "../../lib/constants";
import { useGAEvents } from "../../context/GoogleAnalytics";
import { addToCartDrawer } from "../../lib/addToCartDrawer";
import { useCleverTapEvents } from "../../context/ClevertapAnalytics";
import { useMetaEvents } from "../../context/MetaEventsContext";

type ProductDetailsModalProps = {
  activeLibraryVideo?: ShortVideo;
  onMute?: () => void;
};

const ProductDetailsModal = ({
  activeLibraryVideo,
  onMute,
}: ProductDetailsModalProps) => {
  let currencyCode = instasellLiveEmbedConfig.getCurrencyCode?.() || "INR";
  let currencyRate = instasellLiveEmbedConfig.getCurrencyRate?.() || 1;
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
  const api = useApi();
  const {
    shortVideos,
    activeVideoId,
    activeProductIndex,
    isDesktop,
    isProductDetailsModalOpen,
    setIsProductDetailsModalOpen,
    googleAnalyticsEnabled,
    useGtmForAnalytics,
    clevertapAnalyticsEnabled,
    shortVideoSessionToken,
    metaRetargetingEnabled,
    comparePriceEnabled,
    discountBadgeEnabled,
    displayAllProductImagesEnabled,
    storeFrontCartOperation,
    storeFrontAccessKey,
  } = useShortVideosModalContext();
  const [fetchedProduct, setFetchedProduct] = useState<Product | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    null
  );
  const [addingToCart, setAddingToCart] = useState<boolean>(false);
  const [addedToCart, setAddedToCart] = useState(false);
  const [outOfStockError, setOutOfStockError] = useState(false);
  const [fullProductData, setFullProductData] = useState<any | null>(null);
  const [fullProductImages, setFullProductImages] = useState<string[]>([]);
  const [loadingFullProduct, setLoadingFullProduct] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<{
    [key: string]: string;
  }>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const gaEvents = useGAEvents();
  const caEvents = useCleverTapEvents();
  const fbEvents = useMetaEvents();

  const pageType = instasellLiveEmbedConfig.getPageType?.();
  const pageId =
    pageType == "home"
      ? ""
      : pageType == "product"
      ? instasellLiveEmbedConfig.currentProductId ?? ""
      : instasellLiveEmbedConfig.currentCollectionId ?? "";

  const activeVideo = activeVideoId
    ? shortVideos.find((v) => v.i === activeVideoId) || null
    : activeLibraryVideo;
  const minimalProduct = activeVideo ? activeVideo.p[activeProductIndex] : null;
  const product = fetchedProduct || minimalProduct;

  const showCountrySpecificPricing = product?.cp == null ? false : true;

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

  const regex = /^[^\w\s\d]0$/;

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
      if (!isProductDetailsModalOpen || !minimalProduct || fetchedProduct)
        return;

      setIsLoading(true);

      try {
        const { product } = await api.getProductDetails(minimalProduct.i);
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
        console.error("Failed to fetch product details:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProductDetails();
  }, [isProductDetailsModalOpen, minimalProduct?.i]);

  useEffect(() => {
    if (!isProductDetailsModalOpen) {
      setFetchedProduct(null);
      setAddedToCart(false);
      setSelectedOptions({});
      setAddedToCart(false);
      setIsLoading(false);
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
        !minimalProduct?.h ||
        fullProductData
      )
        return;

      try {
        setLoadingFullProduct(true);
        const productData = await instasellLiveEmbedConfig.fetchProductDetails(
          minimalProduct.h
        );
        if (productData) {
          setFullProductData(productData);
          const images = instasellLiveEmbedConfig.getProductImages(productData);
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
  }, [displayAllProductImagesEnabled, minimalProduct?.h, fullProductData]);

  useEffect(() => {
    if (!product?.v || !product?.o) return;

    // Find first in-stock variant
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
    if (firstInStockVariant) {
      setSelectedVariantId(firstInStockVariant.pi);
    } else {
      setSelectedVariantId(product.v[0]?.pi ?? null);
    }
  }, [product?.v, product?.o]);
  const handleOptionSelect = (optionName: string, optionValue: string) => {
    if (!fetchedProduct) return;

    const newSelectedOptions = {
      ...selectedOptions,
      [optionName]: optionValue,
    };

    setSelectedOptions(newSelectedOptions);

    const selectedValues = fetchedProduct.o
      .map((option) => newSelectedOptions[option.n] || option.v[0])
      .join(" / ");

    const matchingVariant = fetchedProduct.v.find(
      (variant) => variant.v === selectedValues
    );

    if (matchingVariant) {
      setSelectedVariantId(matchingVariant.pi);
    }
  };

  const handleAddToCart = async () => {
    if (!product) return;

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

    setAddingToCart(true);
    setOutOfStockError(false);
    const variantId = selectedVariantId || product.v[0]?.pi;

    if (!variantId) {
      console.error("No variant selected");
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
            instasellLiveEmbedConfig.pageType,
            activeVideo?.m[0].v ?? ""
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

        setAddingToCart(false);
        setAddedToCart(true);
        setOutOfStockError(false);
        setTimeout(() => {
          setAddedToCart(false);
        }, 5000);
      } catch (error) {
        console.error("Error in storefront cart operation:", error);
        setAddingToCart(false);
        setOutOfStockError(false);
      }
      return;
    }

    try {
      const drawerAddSuccess = await addToCartDrawer(variantId, product.pi);

      if (!drawerAddSuccess) {
        await instasellLiveEmbedConfig.addToCart(
          variantId,
          "REELS",
          product.h,
          orderAttributionToken
        );
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      const cart = await instasellLiveEmbedConfig.getCurrentCart();
      if (!cart) {
        throw new Error("Failed to verify cart update");
      }

      try {
        await instasellLiveEmbedConfig.updateCartInfo(orderAttributionToken);
      } catch (error) {
        console.error("something sent wrong and could not update cart ", error);
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
        source: "carousel",
        pageType,
        pageId,
      });
      sessionStorage.setItem("sessionTime", Date.now().toString());

      if (googleAnalyticsEnabled) {
        gaEvents.trackAddToCart(
          product.i,
          1,
          variantId,
          "video-carousel",
          instasellLiveEmbedConfig.pageType,
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
          instasellLiveEmbedConfig.pageType,
          activeVideo?.m[0].v ?? ""
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

      setAddingToCart(false);
      setAddedToCart(true);
      setOutOfStockError(false);

      setTimeout(() => {
        setAddedToCart(false);
      }, 5000);

      if (!drawerAddSuccess) {
        if (
          (window as any).Shopify?.shop !== "hyphen-mcaffeine.myshopify.com" &&
          (window as any).Shopify?.shop !== "beyours-india.myshopify.com"
        ) {
          window.location.href = "/cart";
        }
      }
    } catch (error) {
      console.error("Error in purchase flow:", error);
      setAddingToCart(false);
      setOutOfStockError(false);
    }
  };

  const closeModal = () => {
    setIsProductDetailsModalOpen(false);
  };

  const isVariantOutOfStock = (variant: ProductVariant): boolean => {
    return variant.s <= 0;
  };

  const getOptionButtonClass = (
    option: ProductOption,
    value: string
  ): string => {
    if (!selectedOptions[option.n]) return "";

    const isSelected = selectedOptions[option.n] === value;

    const tempSelections = {
      ...selectedOptions,
      [option.n]: value,
    };

    const selectedValues = fetchedProduct?.o
      .map((opt) => tempSelections[opt.n] || opt.v[0])
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
    if (addedToCart)
      return shopDomain === "terredefrance.myshopify.com"
        ? "Ajouté au panier"
        : shopDomain === "37f807-2.myshopify.com"
        ? "Añadido al carrito"
        : shopDomain === "0zqhug-ry.myshopify.com"
        ? "Dodano do koszyka"
        : "Added To Cart";

    if (addingToCart)
      return shopDomain === "terredefrance.myshopify.com"
        ? "Ajout au panier"
        : shopDomain === "37f807-2.myshopify.com"
        ? "comprando"
        : shopDomain === "0zqhug-ry.myshopify.com"
        ? "Dodawanie..."
        : "Adding to cart...";

    return shopDomain === "terredefrance.myshopify.com"
      ? "Ajouter au panier"
      : shopDomain === "37f807-2.myshopify.com"
      ? "comprar"
      : shopDomain === "0zqhug-ry.myshopify.com"
      ? "Dodaj do koszyka"
      : "Add to cart";
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
        onClick={closeModal}
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
                    "background-image": `url(${
                      getSelectedVariant()?.im || product?.im
                    })`,
                  }}
                  class="ins-product-details-image"
                />
                {displayAllProductImagesEnabled && fullProductImages.length > 0
                  ? // Use full product images from Shopify API
                    (() => {
                      let filteredImages = fullProductImages.filter(
                        (img) =>
                          img !== (getSelectedVariant()?.im || product?.im)
                      );

                      // If DoNotShowUnSelectedVariantImages is true, filter out other variant images
                      if (
                        window.DoNotShowUnSelectedVariantImages &&
                        fetchedProduct?.v
                      ) {
                        const selectedVariantImage =
                          getSelectedVariant()?.im || product?.im;
                        const otherVariantImages = fetchedProduct.v
                          .filter((variant) => variant.im.length !== 0)
                          .map((variant) => variant.im);

                        filteredImages = filteredImages.filter(
                          (img) => !otherVariantImages.includes(img)
                        );
                      }

                      return filteredImages.map((imageUrl, i) => (
                        <div
                          key={i}
                          style={{
                            "background-image": `url(${imageUrl})`,
                          }}
                          class="ins-product-details-image"
                        />
                      ));
                    })()
                  : fetchedProduct
                  ? // Use variant images from our API
                    (() => {
                      const variantImages = [
                        ...new Set(
                          fetchedProduct.v
                            .filter((variant) => variant.im.length !== 0)
                            .map((variant) => variant.im)
                            .filter(
                              (img) =>
                                img !==
                                (getSelectedVariant()?.im || product?.im)
                            )
                        ),
                      ];

                      return variantImages.map((imageUrl, i) => (
                        <div
                          key={i}
                          style={{
                            "background-image": `url(${imageUrl})`,
                          }}
                          class="ins-product-details-image"
                        />
                      ));
                    })()
                  : null}
              </header>
              <div class="ins-product-details-info">
                <h2 class="ins-product-details-name">{product?.t}</h2>
                <p className="ins-product-details-price">
                  {priceToDisplay}
                  {(() => {
                    const { pr = 0, c } = getSelectedVariant() ?? product;
                    const baseComparePrice = !showCountrySpecificPricing
                      ? c
                      : getSelectedVariant()?.cp?.[country]?.cs ??
                        product?.cp?.[country]?.cs ??
                        c;
                    if (c !== undefined && c > pr && baseComparePrice) {
                      const { price, currency } =
                        calculatePrice(baseComparePrice);
                      return (
                        <span className="ins-product-details-strikeoff-price">
                          {formatCurrency(price, currency)}
                        </span>
                      );
                    }
                    return null;
                  })()}
                </p>
              </div>

              {isLoading ? (
                <div
                  className="ins-product-details-loading-spinner"
                  style={{
                    width: "100%",
                    height: "50%",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <circle
                      className="ins-product-details-spinner"
                      cx="12"
                      cy="12"
                      r="10"
                      fill="none"
                      stroke="#000000"
                      strokeWidth="2"
                      strokeDasharray="30 60"
                    />
                  </svg>
                </div>
              ) : (
                <>
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
                                onClick={() =>
                                  handleOptionSelect(option.n, value)
                                }
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
                  ) : fetchedProduct?.v.length &&
                    fetchedProduct?.v.length > 1 ? (
                    <div class="ins-product-details-variants-list">
                      {fetchedProduct.v.map((variant) => (
                        <button
                          class={`ins-product-details-variants-item ${
                            variant.pi == selectedVariantId
                              ? "ins-product-details-variants-item__active"
                              : ""
                          }`}
                          onClick={() => {
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
                      style={{
                        "margin-bottom": "30px",
                      }}
                      class="ins-product-details-description-container"
                      dangerouslySetInnerHTML={{
                        __html: fetchedProduct.d,
                      }}
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
                        onClick={handleAddToCart}
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
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
};

export default ProductDetailsModal;
