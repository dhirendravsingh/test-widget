import { useEffect, useRef, useState } from "preact/hooks";
import { instasellVideoPopEmbedConfig } from "../../video-pop-index";
import { useVideoPopContext } from "../../context/VideoPopContext";
import { useApi } from "../../lib/api";
import VideoPIP from "./video-pop";
import { ShortVideo } from "../../types/api";
import { FloatingVideoPortal } from "./FloatingVideoPortal";

export const VideoPops = () => {
  const api = useApi();

  const {
    setIsLoadingShortVideos,
    setShortVideo,
    isLoadingShortVideos,
    setIsPipActive,
    setPurchaseFlowAction,
    shortVideo,
    setGoogleAnalyticsEnabled,
    setUseGtmForAnalytics,
    setClevertapAnalyticsEnabled,
    setMetaRetargetingEnabled,
    setCloseVideoPipWhenClosedFromFullScreenMode,
    setShortVideos,
    shortVideos,
    setShowTaggedVideos,
    showTaggedVideos,
    setComparePriceEnabled,
    setDisplayAllProductImagesEnabled,
    setDiscountBadgeEnabled,
    setStoreFrontCartOperation,
    setStoreFrontAccessKey,
    setEnableStoryModeOnClose,
    setVideoBehavior,
  } = useVideoPopContext();
  const [stylesInjected, setStylesInjected] = useState(false);
  const headlessEnv = (window as any).__headless_env__;
  const scrollCleanupRef = useRef<(() => void) | null>(null);

  // Function to inject custom script safely
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
            console.log("%c[Instaell custom script error]", "color: red;");
          }
        })();
      `;

      script.textContent = safeScript;
      document.head.appendChild(script);
    } catch (error) {
      console.log(`%cFailed to inject custom script: ${error}`, "color: red;");
    }
  };

  const injectStyles = (styles: string, id: string) => {
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
    document.head.appendChild(styleTag);
    return styleTag;
  };

  const fetchShortVideos = async () => {
    console.log("LOG 1: Starting fetchShortVideos");

    const pageType = instasellVideoPopEmbedConfig.getPageType?.();
    console.log("LOG 2: Page type:", pageType);

    const domain =
      instasellVideoPopEmbedConfig.getShopDomain?.() != ""
        ? instasellVideoPopEmbedConfig.getShopDomain?.()
        : ["localhost", "192.168.1.33", "127.0.0.1"].includes(
            window.location.hostname
          )
        ? "utkarsh-s.myshopify.com"
        : typeof (window as any).Shopify === "undefined"
        ? window.location.hostname
        : instasellVideoPopEmbedConfig.getShopDomain?.();

    const shortVideosResponse = await api
      .getVideoPop({
        originFqdn: domain,
        pageType: pageType,
        currentProductId: instasellVideoPopEmbedConfig.currentProductId,
        currentCollectionId: instasellVideoPopEmbedConfig.currentCollectionId,
      })
      .catch((e) => {
        setIsLoadingShortVideos(false);

        setShortVideo(null);
        setIsPipActive(false);
        setStylesInjected(false);
      });

    console.log("LOG 4: getVideoPop response:", shortVideosResponse);

    if (shortVideosResponse != null) {
      console.log("LOG 5: Response is not null, processing...");

      if (shortVideosResponse.so) {
        console.log("LOG 6: Response has 'so' property, returning early");
        return;
      }

      if (shortVideosResponse.cp) {
        console.log(
          "LOG 7: Setting closeVideoPipWhenClosedFromFullScreenMode to true"
        );
        setCloseVideoPipWhenClosedFromFullScreenMode(true);
      }

      if (shortVideosResponse.es !== undefined) {
        setEnableStoryModeOnClose(shortVideosResponse.es);
      }

      if (shortVideosResponse.sv) {
        console.log(
          "LOG 8: Response has shortVideo (sv), processing video data"
        );
        setShortVideo(shortVideosResponse.sv);
        setIsPipActive(true);

        // Handle custom CTA and behavior
        if (shortVideosResponse.sv.b !== undefined) {
          setVideoBehavior(shortVideosResponse.sv.b);
        }

        if (shortVideosResponse.pa) {
          setPurchaseFlowAction(shortVideosResponse.pa);
        }

        if (shortVideosResponse.st) {
          setShowTaggedVideos(true);
          if (shortVideosResponse.v && shortVideosResponse.v.length > 0) {
            const videos: ShortVideo[] = [
              shortVideosResponse.sv,
              ...shortVideosResponse.v,
            ];
            setShortVideos(videos);
          }
        }

        if (shortVideosResponse.ga) {
          setGoogleAnalyticsEnabled(shortVideosResponse.ga);
        }

        if (shortVideosResponse.gt !== undefined) {
          setUseGtmForAnalytics(shortVideosResponse.gt);
        }

        if (shortVideosResponse.ca) {
          setClevertapAnalyticsEnabled(shortVideosResponse?.ca);
        }

        if (shortVideosResponse.ck) {
          injectCustomScript(shortVideosResponse.ck);
        }

        if (shortVideosResponse.mr) {
          setMetaRetargetingEnabled(shortVideosResponse.mr);
        }
        if (shortVideosResponse.ce) {
          setComparePriceEnabled(shortVideosResponse.ce);
        }
        if (shortVideosResponse.db) {
          setDiscountBadgeEnabled(shortVideosResponse.db);
        }
        if (shortVideosResponse.da) {
          setDisplayAllProductImagesEnabled(shortVideosResponse.da);
        }

        if (
          "storeFrontApiAccessKey" in window &&
          typeof window.storeFrontApiAccessKey === "string"
        ) {
          setStoreFrontAccessKey(window.storeFrontApiAccessKey);
        } else {
          setStoreFrontAccessKey(shortVideosResponse.sa ?? "");
        }

        const storeFrontCartOperation = (window as any).__headless_env__;

        if (storeFrontCartOperation) {
          setStoreFrontCartOperation(true);
        }

        document.getElementById("instasell-videos-pop-custom-css")?.remove();
        document.getElementById("instasell-video-pop-ai-css")?.remove();

        const stylePromises = [];

        if (shortVideosResponse.cs) {
          console.log("LOG 9: Adding custom styles promise");
          stylePromises.push(
            new Promise((resolve) => {
              const styleTag = document.createElement("style");
              styleTag.id = "instasell-videos-pop-custom-css";
              styleTag.innerHTML = shortVideosResponse.cs;
              styleTag.onload = resolve;
              // Add fallback timeout in case onload doesn't fire
              setTimeout(resolve, 100);
              document.head.appendChild(styleTag);
            })
          );
        }

        if (shortVideosResponse.ac) {
          console.log("LOG 10: Adding AI styles promise");
          stylePromises.push(
            new Promise((resolve) => {
              const styleTag = injectStyles(
                shortVideosResponse.ac,
                "instasell-video-pop-ai-css"
              );
              styleTag.onload = resolve;
              // Add fallback timeout in case onload doesn't fire
              setTimeout(resolve, 100);
            })
          );
        }

        console.log("LOG 11: Style promises count:", stylePromises.length);

        // Wait for all styles to be injected
        if (stylePromises.length > 0) {
          await Promise.all(stylePromises);
          console.log("LOG 12: All style promises resolved");
        } else {
          console.log("LOG 13: No style promises to wait for");
        }

        setStylesInjected(true);
        console.log("LOG 14: stylesInjected set to true");

        // Make sure initializeStoreStylesVideoPop is defined before calling
        if (typeof initializeStoreStylesVideoPop === "function") {
          if (scrollCleanupRef.current) {
            scrollCleanupRef.current();
          }
          scrollCleanupRef.current = initializeStoreStylesVideoPop(pageType);
          console.log("LOG 15: initializeStoreStylesVideoPop called");
        } else {
          console.log(
            "LOG 16: initializeStoreStylesVideoPop function not found"
          );
        }
      } else {
        console.log("LOG 17: Response does not have shortVideo (sv)");

        setShortVideo(null);
        setIsPipActive(false);
        setStylesInjected(false);
      }

      console.log("LOG 18: Setting isLoadingShortVideos to false");
      setIsLoadingShortVideos(false);
    } else {
      console.log("LOG 19: Response is null");
      setIsLoadingShortVideos(false);

      setShortVideo(null);
      setIsPipActive(false);
      setStylesInjected(false);
    }
  };

  useEffect(() => {
    fetchShortVideos();

    // Cleanup function
    return () => {
      document.getElementById("instasell-videos-pop-custom-css")?.remove();
      document.getElementById("instasell-video-pop-ai-css")?.remove();
      document.getElementById("instasell-custom-script")?.remove();

      // Clean up scroll event listeners
      if (scrollCleanupRef.current) {
        scrollCleanupRef.current();
        scrollCleanupRef.current = null;
      }
    };
  }, [
    instasellVideoPopEmbedConfig.currentProductId,
    instasellVideoPopEmbedConfig.currentCollectionId,
    instasellVideoPopEmbedConfig.pageType,
  ]);

  // Add debugging for render conditions
  console.log("RENDER CONDITIONS:", {
    isLoadingShortVideos,
    hasShortVideo: !!shortVideo,
    stylesInjected,
    shouldRender: !isLoadingShortVideos && shortVideo && stylesInjected,
  });

  if (headlessEnv) {
    console.log("RENDERING VIDEO COMPONENT");
    return (
      <div className="ins-video-pip">
        <VideoPIP />
      </div>
    );
  }

  if (!isLoadingShortVideos && shortVideo && stylesInjected) {
    console.log("RENDERING VIDEO COMPONENT");
    return (
      <FloatingVideoPortal>
        <div className="ins-video-pip">
          <VideoPIP />
        </div>
      </FloatingVideoPortal>
    );
  } else {
    console.log("NOT RENDERING - Conditions not met");
    return null;
  }
};

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

const initializeStoreStylesVideoPop = (
  pageType: "home" | "collection" | "product"
): (() => void) | null => {
  const shopName = (window as any).Shopify?.shop;

  switch (shopName) {
    case "attrangi1.myshopify.com": {
      const style = document.createElement("style");

      if (pageType == "home") {
        style.textContent = `
        .ins-video-pip .ins-reel-pop-player-modal-overlay.ins-reel-pop-player-modal-overlay__is-pip-active {
          transition: opacity 0.3s ease !important;
        }
      `;
        document.head.appendChild(style);
        return null;
      } else {
        style.textContent = `
        .ins-video-pip .ins-reel-pop-player-modal-overlay.ins-reel-pop-player-modal-overlay__is-pip-active {
          opacity: 1 !important;
          pointer-events: auto !important;
          transition: opacity 0.3s ease !important;
        }
      `;
        document.head.appendChild(style);

        let scrollHandler: (() => void) | null = null;

        // Wait for element to be ready
        setTimeout(() => {
          const pipElement = document.querySelector(
            ".ins-video-pip .ins-reel-pop-player-modal-overlay.ins-reel-pop-player-modal-overlay__is-pip-active"
          ) as HTMLElement | null;

          if (pipElement) {
            let hasScrolledPastThreshold = false;

            scrollHandler = () => {
              if (
                !hasScrolledPastThreshold &&
                window.scrollY > document.documentElement.scrollHeight * 0.2
              ) {
                hasScrolledPastThreshold = true;
                pipElement.style.setProperty("opacity", "1", "important");
                pipElement.style.setProperty(
                  "pointer-events",
                  "auto",
                  "important"
                );
              }
            };

            window.addEventListener("scroll", scrollHandler);
            scrollHandler(); // Check initial position
          }
        }, 500);

        return () => {
          if (scrollHandler) {
            window.removeEventListener("scroll", scrollHandler);
          }
        };
      }
    }

    case "utkarsh-s.myshopify.com": {
      // Add styles
      const style1 = document.createElement("style");
      style1.textContent = `
        .ins-video-pip .ins-reel-pop-player-modal-overlay.ins-reel-pop-player-modal-overlay__is-pip-active {
          transition: opacity 0.3s ease !important;
        }
      `;
      document.head.appendChild(style1);

      let scrollHandler: (() => void) | null = null;

      setTimeout(() => {
        const pipElement = document.querySelector(
          ".ins-video-pip .ins-reel-pop-player-modal-overlay.ins-reel-pop-player-modal-overlay__is-pip-active"
        ) as HTMLElement | null;

        if (pipElement) {
          let hasScrolledPastThreshold = false;

          scrollHandler = () => {
            if (
              !hasScrolledPastThreshold &&
              window.scrollY > document.documentElement.scrollHeight * 0.2
            ) {
              hasScrolledPastThreshold = true;
              pipElement.style.setProperty("opacity", "1", "important");
              pipElement.style.setProperty(
                "pointer-events",
                "auto",
                "important"
              );
            }
          };

          window.addEventListener("scroll", scrollHandler);
          scrollHandler();
        }
      }, 500);

      return () => {
        if (scrollHandler) {
          window.removeEventListener("scroll", scrollHandler);
        }
      };
    }

    case "rasayanam.myshopify.com": {
      if (pageType === "product") {
        const rasayanamStyle = document.createElement("style");
        rasayanamStyle.textContent = `
      .ins-video-pip .ins-reel-pop-player-modal-overlay.ins-reel-pop-player-modal-overlay__is-pip-active {
        opacity: 0 !important;
        pointer-events: none !important;
        transition: opacity 0.3s ease !important;
      }
    `;
        document.head.appendChild(rasayanamStyle);

        let scrollHandler: (() => void) | null = null;
        let observer: MutationObserver | null = null;
        let fullModalObserver: MutationObserver | null = null;

        setTimeout(() => {
          const pipElement = document.querySelector(
            ".ins-video-pip .ins-reel-pop-player-modal-overlay.ins-reel-pop-player-modal-overlay__is-pip-active"
          ) as HTMLElement | null;

          if (pipElement) {
            scrollHandler = () => {
              // Check if modal is in full screen mode - if so, keep widget visible
              const isFullModalActive = pipElement.classList.contains(
                "ins-reel-pop-player-modal-overlay__is-full-modal"
              ) || 
              document.querySelector(
                ".ins-reel-pop-player-modal-overlay__is-full-modal"
              ) !== null;

              // If full modal is active, keep the widget visible
              if (isFullModalActive) {
                pipElement.style.setProperty("opacity", "1", "important");
                pipElement.style.setProperty(
                  "pointer-events",
                  "auto",
                  "important"
                );
                return;
              }

              // Otherwise, check scroll position for floating widget visibility
              const scrollPosition = window.scrollY;
              const scrollHeight = document.documentElement.scrollHeight;
              const shouldBeVisible =
                scrollPosition > scrollHeight * 0.12 &&
                scrollPosition < scrollHeight * 0.7;

              if (shouldBeVisible) {
                pipElement.style.setProperty("opacity", "1", "important");
                pipElement.style.setProperty(
                  "pointer-events",
                  "auto",
                  "important"
                );
              } else {
                pipElement.style.setProperty("opacity", "0", "important");
                pipElement.style.setProperty(
                  "pointer-events",
                  "none",
                  "important"
                );
              }
            };

            window.addEventListener("scroll", scrollHandler);
            
            // Also listen for class changes on the modal to handle open/close
            observer = new MutationObserver(() => {
              scrollHandler?.();
            });

            // Observe the pipElement for class changes
            observer.observe(pipElement, {
              attributes: true,
              attributeFilter: ["class"],
            });

            // Also observe the document for full modal class changes
            fullModalObserver = new MutationObserver(() => {
              scrollHandler?.();
            });

            if (document.body) {
              fullModalObserver.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ["class"],
              });
            }

            scrollHandler(); // Initial check
          }
        }, 500);

        // Return cleanup function
        return () => {
          if (scrollHandler) {
            window.removeEventListener("scroll", scrollHandler);
          }
          if (observer) {
            observer.disconnect();
          }
          if (fullModalObserver) {
            fullModalObserver.disconnect();
          }
        };
      }
      return null;
    }

    default:
      return null;
  }
};
