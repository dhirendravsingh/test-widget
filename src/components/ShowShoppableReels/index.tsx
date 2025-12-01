import { useEffect, useRef, useState } from "preact/hooks";
import VideoModal from "../VideoModal";
import ShoppableReelsFeed from "./shoppable-reels-feed";
import { useApi } from "../../lib/api";
import ShoppableReelsFeedSkeleton from "./shoppable-reels-feed-skeleton";
import { useShortVideosModalContext } from "../../context/ShortVideosModalContext";
import { PreactPortal } from "../Portal";
import { instasellLiveEmbedConfig } from "../..";
import { GetShortVideosRequest } from "../../gen/mapi/v1/v1_pb";
import { MAIN_API_BASE_URL } from "../../lib/constants";
import { GetShortVideosResponse } from "../../types/api";
import { useGAEvents } from "../../context/GoogleAnalytics";
import { useVideoLibraryState, VideoLibrary } from "../VideoLibraryModal";
import { useCleverTapEvents } from "../../context/ClevertapAnalytics";
import { initializeStoreStylesCarousel } from "../../lib/utils";
import { useMetaEvents } from "../../context/MetaEventsContext";

declare global {
  interface Window {
    DoNotShowUnSelectedVariantImages?: boolean;
  }
}

const ShowShoppableReels = ({
  carouselData,
  isNearViewport,
}: {
  carouselData?: {
    carouselName?: string;
    elementId?: string;
    isVideoPop?: boolean;
    isTestimonial?: boolean;
  };
  isNearViewport: boolean;
}) => {
  const api = useApi();
  const {
    setShortVideos,
    isLoadingShortVideos,
    setIsLoadingShortVideos,
    activeVideoId,
    setActiveVideoId,
    setIsPipActive,
    showFeed,
    setShowFeed,
    setPurchaseFlowAction,
    setCustomCode,
    setHidePoweredBy,
    setPipEnabled,
    setProductPageTitle,
    productPageTitle,
    isDesktop,
    setNoOfVideosInViewport,
    setGoogleAnalyticsEnabled,
    googleAnalyticsEnabled,
    useGtmForAnalytics,
    setUseGtmForAnalytics,
    metaRetargetingEnabled,
    shortVideoSessionToken,
    setCanRegisterClickEvent,
    isPipActive,
    canRegisterClickEvent,
    setComparePriceEnabled,
    setDisplayAllProductImagesEnabled,
    setVideoPlayerView,
    clevertapAnalyticsEnabled,
    setClevertapAnalyticsEnabled,
    setCarouselTitle,
    setShowOldVideoPop,
    setShopNowText,
    setCustomScript,
    setAtcButtonText,
    setMetaRetargetingEnabled,
    setDiscountBadgeEnabled,
    setStoreFrontCartOperation,
    setStoreFrontAccessKey,
    setVideoBehavior,
    shortVideos,
    setIsTestimonial,
    setVariantSliderEnabled,
    setFrameDesign,
  } = useShortVideosModalContext();

  const [cardDesign, setCardDesign] = useState<
    "one" | "two" | "three" | "four" | "custom"
  >("one");
  const [showProductPageTitle, setShowProductPageTitle] = useState(false);
  const { isVideoLibraryOpen, openVideoLibrary, closeVideoLibrary } =
    useVideoLibraryState();
  const feedRef = useRef(null);
  const hasTrackedImpression = useRef(false);
  const gaEvents = useGAEvents();
  const caEvents = useCleverTapEvents();
  const fbEvents = useMetaEvents();
  const isCarousel =
    instasellLiveEmbedConfig.getShopDomain?.() ===
      "eyewearlabs.myshopify.com" &&
    instasellLiveEmbedConfig.getPageType?.() === "collection"
      ? false
      : !carouselData?.isVideoPop;
  const [isLoadedShortVideos, setIsLoadedShortVideos] = useState(false);
  const [stylesInjected, setStylesInjected] = useState(false);

  const pageType = instasellLiveEmbedConfig.getPageType?.();
  const pageId =
    pageType == "home"
      ? ""
      : pageType == "product"
      ? instasellLiveEmbedConfig.currentProductId ?? ""
      : instasellLiveEmbedConfig.currentCollectionId ?? "";

  const shopDomain = ["localhost", "192.168.1.33", "127.0.0.1"].includes(
    window.location.hostname
  )
    ? "utkarsh-s.myshopify.com"
    : typeof (window as any).Shopify === "undefined"
    ? window.location.hostname
    : instasellLiveEmbedConfig.getShopDomain?.();

  const injectStyles = (styles: string, id: string): Promise<void> => {
    return new Promise((resolve) => {
      const styleTag = document.createElement("style");
      styleTag.id = id;

      const transformedStyles = styles
        .split("}")
        .filter((rule) => rule.trim())
        .map((rule) => {
          const [selector, styles] = rule.split("{");
          if (!styles) return "";
          const cleanStyles = styles
            .trim()
            .replace(/!important !important/g, "!important")
            .replace(/;$/, "");

          return `.ins-shoppable-videos ${selector.trim()} {
              ${cleanStyles}
            }`;
        })
        .join("\n");

      styleTag.innerHTML = transformedStyles;

      // Resolve promise when style is loaded
      styleTag.onload = () => resolve();
      document.head.appendChild(styleTag);
    });
  };

  const injectCustomScript = (scriptContent: string) => {
    // Remove existing script if it exists
    const existingScript = document.getElementById("instasell-custom-script");
    if (existingScript) {
      existingScript.remove();
    }

    if (!scriptContent || scriptContent.trim() === "") {
      return;
    }

    try {
      // Create new script element
      const script = document.createElement("script");
      script.id = "instasell-custom-script";
      script.type = "text/javascript";

      // Create a safe execution context
      const safeScript = `
        (function() {
          try {
            ${scriptContent}
          } catch (e) {
            console.log(%c[Instasell] Custom script error, "color: red;");
          }
        })();
      `;

      script.textContent = safeScript;
      document.head.appendChild(script);
    } catch (error) {
      console.log(`%cFailed to inject custom script: ${error}`, "color: red;");
    }
  };

  const fetchShortVideos = async () => {
    const pageType = instasellLiveEmbedConfig.getPageType?.();
    let shortVideosResponse;
    if ((window as any).isMockup) {
      shortVideosResponse = await api
        .getShortVideos({
          originFqdn:
            typeof (window as any).Shopify === "undefined"
              ? window.location.hostname
              : instasellLiveEmbedConfig.getShopDomain?.(),
          pageType: "home",
        })
        .catch((e) => {
          document
            .querySelectorAll(
              '[id^="instasell-carousel"], #instasell-live-short-videos'
            )
            .forEach((el) => ((el as HTMLElement).style.height = "0"));
          setIsLoadingShortVideos(false);
          setIsLoadedShortVideos(true);
        });
    } else {
      const domain =
        instasellLiveEmbedConfig.getShopDomain?.() != ""
          ? instasellLiveEmbedConfig.getShopDomain?.()
          : ["localhost", "192.168.1.33", "127.0.0.1"].includes(
              window.location.hostname
            )
          ? "utkarsh-s.myshopify.com"
          : typeof (window as any).Shopify === "undefined"
          ? window.location.hostname
          : instasellLiveEmbedConfig.getShopDomain?.();

      shortVideosResponse = await api
        .getShortVideos({
          originFqdn: domain,
          pageType,
          currentProductId: instasellLiveEmbedConfig.currentProductId,
          currentCollectionId: instasellLiveEmbedConfig.currentCollectionId,
        })
        .catch((e) => {
          document
            .querySelectorAll(
              '[id^="instasell-carousel"], #instasell-live-short-videos'
            )
            .forEach((el) => ((el as HTMLElement).style.height = "0"));
          setIsLoadingShortVideos(false);
          setIsLoadedShortVideos(true);
        });
    }

    if (shortVideosResponse != null) {
      const showOldVideoPop = shortVideosResponse?.so;
      setShowOldVideoPop(shortVideosResponse?.so);

      if (shortVideosResponse.c) {
        const carousels = shortVideosResponse?.c;
        const selectedCarousel = carousels.find(
          (carousel) => carousel.n === carouselData?.carouselName
        );

        if (selectedCarousel) {
          setShortVideos(selectedCarousel.v);
          handleCommonResponseSettings(shortVideosResponse, showOldVideoPop);

          if (selectedCarousel.v.length > 0) {
            const firstVideo = selectedCarousel.v[0];
            if (firstVideo.b !== undefined) {
              setVideoBehavior(firstVideo.b);
            }
          }
          if ((window as any).isMockup && selectedCarousel.v.length === 1) {
            console.log(
              "Mockup mode with single video in carousel - showing PIP"
            );
            setShowFeed(false);
            setActiveVideoId(selectedCarousel.v[0].i);
            setIsPipActive(true);
            setCanRegisterClickEvent(false);
          } else {
            setShowFeed(true);
          }
        } else {
          setShowFeed(false);
          setIsLoadingShortVideos(false);
          setIsLoadedShortVideos(true);
          return;
        }
      }
      // Handle product/collection pages
      else if (shortVideosResponse.v) {
        setShortVideos(shortVideosResponse.v);
        handleCommonResponseSettings(shortVideosResponse, showOldVideoPop);

        if (shortVideosResponse.v.length > 0) {
          const firstVideo = shortVideosResponse.v[0];
          if (firstVideo.b !== undefined) {
            setVideoBehavior(firstVideo.b);
          }
        }

        // Handle single video cases for product/collection pages
        if (
          instasellLiveEmbedConfig.getShopDomain?.() ===
          "eyewearlabs.myshopify.com"
        ) {
          if (pageType === "product" && shortVideosResponse.v.length === 1) {
            document
              .querySelectorAll(
                '[id^="instasell-carousel"], #instasell-live-short-videos'
              )
              .forEach((el) => ((el as HTMLElement).style.height = "0"));
            setShowFeed(false);
          } else if (pageType === "collection") {
            setShowFeed(false);
            if (shortVideosResponse.v.length === 1 && showOldVideoPop) {
              document
                .querySelectorAll(
                  '[id^="instasell-carousel"], #instasell-live-short-videos'
                )
                .forEach((el) => ((el as HTMLElement).style.height = "0"));
              setActiveVideoId(shortVideosResponse.v[0].i);
              setIsPipActive(true);
            }
          }
        } else if (
          (pageType === "product" || pageType === "collection") &&
          shortVideosResponse.v.length === 1 &&
          showOldVideoPop
        ) {
          document
            .querySelectorAll(
              '[id^="instasell-carousel"], #instasell-live-short-videos'
            )
            .forEach((el) => ((el as HTMLElement).style.height = "0"));
          setShowFeed(false);
          setActiveVideoId(shortVideosResponse.v[0].i);
          setIsPipActive(true);
          setCanRegisterClickEvent(false);
        } else {
          setShowFeed(true);
        }

        if (shortVideosResponse.v.length === 0) {
          document
            .querySelectorAll(
              '[id^="instasell-carousel"], #instasell-live-short-videos'
            )
            .forEach((el) => ((el as HTMLElement).style.height = "0"));
          setShowFeed(false);
        }
      }
      setIsLoadingShortVideos(false);
      setIsLoadedShortVideos(true);
      initializeStoreStylesCarousel();
    }
  };

  // function to handle common response settings
  const handleCommonResponseSettings = async (
    response: any,
    showOldVideoPop: boolean
  ) => {
    setCardDesign(response.cd || "four");
    setGoogleAnalyticsEnabled(response.ga);
    setUseGtmForAnalytics(response.gt);
    setClevertapAnalyticsEnabled(response.ca);
    setMetaRetargetingEnabled(response.mr);
    setPurchaseFlowAction(response.pa);
    setCustomCode(response.cc);
    setHidePoweredBy(response.hp);
    setPipEnabled(response.pe);
    setProductPageTitle(response?.pt);
    setNoOfVideosInViewport(response.nv);
    setCarouselTitle(response.ct ?? "");
    setCustomScript(response.ck ?? "");
    setShopNowText(response.st ?? "Shop Now");
    setAtcButtonText(response.at ?? "ADD TO CART");
    setDiscountBadgeEnabled(response.de ?? false);
    setDisplayAllProductImagesEnabled(response.da ?? false);
    setVariantSliderEnabled(response.vs ?? false);
    setFrameDesign(response.fd ?? "NONE");
    if (
      "storeFrontApiAccessKey" in window &&
      typeof window.storeFrontApiAccessKey === "string"
    ) {
      setStoreFrontAccessKey(window.storeFrontApiAccessKey);
    } else {
      setStoreFrontAccessKey(response.sa ?? "");
    }

    const storeFrontCartOperation = (window as any).__headless_env__;

    if (storeFrontCartOperation) {
      setStoreFrontCartOperation(true);
    }

    if (response.ck) {
      injectCustomScript(response.ck);
    }

    if (response.ce) {
      setComparePriceEnabled(true);
    }

    if (response.vp) {
      setVideoPlayerView(response?.vp);
    }

    if (response.pe && !isPipActive) {
      const videos =
        instasellLiveEmbedConfig.getPageType?.() === "home"
          ? response.c[0]?.v
          : response.v;

      if (videos?.length > 0) {
        if (showOldVideoPop) {
          setActiveVideoId(videos[0].i);
          setIsPipActive(true);
        }
      }
    }

    // Handle custom styles
    document.getElementById("instasell-custom-css")?.remove();
    document.getElementById("instasell-ai-css")?.remove();

    const stylePromises = [];

    if (response.cs) {
      stylePromises.push(
        new Promise((resolve) => {
          const styleTag = document.createElement("style");
          styleTag.id = "instasell-custom-css";
          styleTag.innerHTML = response.cs;
          styleTag.onload = resolve;
          document.head.appendChild(styleTag);
        })
      );
    }

    if (response.ac) {
      stylePromises.push(injectStyles(response.ac, "instasell-ai-css"));
    }

    await Promise.all(stylePromises);
    setStylesInjected(true);

    if (showOldVideoPop) {
      if (response.dp && !isPipActive) {
        setActiveVideoId(response.dp);
        setIsPipActive(true);
      }
    }

    const videos =
      instasellLiveEmbedConfig.getPageType?.() === "home"
        ? response.c[0]?.v
        : response.v;

    if (videos?.length == 1 && showOldVideoPop) {
      setActiveVideoId(videos[0].i);
      setIsPipActive(true);
    }
  };

  useEffect(() => {
    return () => {
      document.getElementById("instasell-custom-css")?.remove();
      document.getElementById("instasell-ai-css")?.remove();
      document.getElementById("instasell-custom-script")?.remove();
    };
  }, []);

  useEffect(() => {
    if (isNearViewport) {
      if (
        instasellLiveEmbedConfig.getPageType?.() !== "home" &&
        instasellLiveEmbedConfig.showFeedOnHomePageOnly
      ) {
        setShowFeed(false);
      }
      fetchShortVideos();
    }
  }, [carouselData?.carouselName, isNearViewport]);

  useEffect(() => {
    if (!isDesktop && instasellLiveEmbedConfig.getPageType?.() === "product") {
      setShowProductPageTitle(true);
    }
  }, [productPageTitle]);

  useEffect(() => {
    if (!showFeed || !feedRef.current) {
      return;
    }

    if (hasTrackedImpression.current) {
      return;
    }

    const observerOptions = {
      root: null,
      threshold: 0.1,
    };

    const observer = new IntersectionObserver((entries) => {
      const feedEntry = entries[0];
      if (feedEntry.isIntersecting && !hasTrackedImpression.current) {
        try {
          api
            .shortVideosBoron({
              eventType: "shortVideoImpression",
              source: "carousel",
              pageType,
              pageId,
            })
            .then(() => {
              hasTrackedImpression.current = true;
              setCanRegisterClickEvent(true);
              sessionStorage.setItem("sessionTime", Date.now().toString());
            })
            .catch((error) => {
              console.log(`%cAPI call failed: ${error}`, "color: red;");
            });

          if (googleAnalyticsEnabled) {
            gaEvents.trackImpression(
              "video-carousel",
              instasellLiveEmbedConfig.pageType,
              useGtmForAnalytics
            );
          }
          if (clevertapAnalyticsEnabled) {
            caEvents.trackImpression(
              "video-carousel",
              instasellLiveEmbedConfig.pageType
            );
          }
          if (metaRetargetingEnabled) {
            fbEvents.trackImpression(
              "video-carousel",
              instasellLiveEmbedConfig.pageType
            );
          }
        } catch (error) {
          console.log(
            `%cFailed to track feed impression: ${error}`,
            "color: red;"
          );
        }

        observer.disconnect();
      }
    }, observerOptions);

    observer.observe(feedRef.current);

    return () => {
      observer.disconnect();
    };
  }, [
    showFeed,
    api,
    shortVideoSessionToken,
    googleAnalyticsEnabled,
    clevertapAnalyticsEnabled,
    caEvents,
    gaEvents,
    fbEvents,
  ]);

  useEffect(() => {
    if (instasellLiveEmbedConfig.getShopDomain?.()) {
      if (
        instasellLiveEmbedConfig.getShopDomain?.() === "rasayanam.myshopify.com"
      ) {
        window.DoNotShowUnSelectedVariantImages = true;
      }
    }
  }, []);

  useEffect(() => {
    if (!hasTrackedImpression.current && !canRegisterClickEvent) {
      try {
        api
          .shortVideosBoron({
            eventType: "shortVideoImpression",
            source: "carousel",
            pageType,
            pageId,
          })
          .then(() => {
            hasTrackedImpression.current = true;
            setCanRegisterClickEvent(true);
            sessionStorage.setItem("sessionTime", Date.now().toString());
          })
          .catch((error) => {
            console.log(`%cApI call failed: ${error}`, "color: red;");
          });
        if (googleAnalyticsEnabled) {
          gaEvents.trackImpression(
            "video-carousel",
            instasellLiveEmbedConfig.pageType,
            useGtmForAnalytics
          );
        }
        if (clevertapAnalyticsEnabled) {
          caEvents.trackImpression(
            "video-carousel",
            instasellLiveEmbedConfig.pageType
          );
        }
        if (metaRetargetingEnabled) {
          fbEvents.trackImpression(
            "video-carousel",
            instasellLiveEmbedConfig.pageType
          );
        }
      } catch (error) {
        console.log(`%cFailed to track impression: ${error}`, "color: red;");
      }
    }
  }, [
    showFeed,
    isPipActive,
    googleAnalyticsEnabled,
    clevertapAnalyticsEnabled,
    caEvents,
    gaEvents,
    api,
  ]);

  useEffect(() => {
    (window as any).openVideoLibrary = openVideoLibrary;
    (window as any).closeVideoLibrary = closeVideoLibrary;

    return () => {
      delete (window as any).openVideoLibrary;
      delete (window as any).closeVideoLibrary;
    };
  }, [openVideoLibrary, closeVideoLibrary]);

  useEffect(() => {
    if (isVideoLibraryOpen && shortVideos.length > 0) {
      setActiveVideoId(shortVideos[0].i);
    }
  }, [isVideoLibraryOpen, shortVideos]);

  useEffect(() => {
    if (carouselData?.isTestimonial !== undefined) {
      setIsTestimonial(carouselData.isTestimonial);
    }
  }, [carouselData?.isTestimonial, setIsTestimonial]);

  return (
    <div class="ins-shoppable-videos">
      {((isLoadingShortVideos && isCarousel) ||
        (!isLoadedShortVideos &&
          instasellLiveEmbedConfig.getPageType?.() === "home")) &&
      !stylesInjected ? (
        <ShoppableReelsFeedSkeleton />
      ) : showFeed ? (
        <>
          {showProductPageTitle && (
            <p className="ins-shoppable-video-product-page-text">
              {productPageTitle}
            </p>
          )}
          <div ref={feedRef}>
            <ShoppableReelsFeed cardDesign={cardDesign} />
          </div>
        </>
      ) : null}
      {activeVideoId ? (
        <PreactPortal>
          <div className="ins-shoppable-videos">
            <VideoModal />
          </div>
        </PreactPortal>
      ) : null}
    </div>
  );
};

export default ShowShoppableReels;

const generateUUID = () => {
  try {
    return crypto.randomUUID();
  } catch (e) {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
};
