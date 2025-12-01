import { useEffect, useRef, useState } from "preact/hooks";
import {
  PauseIcon,
  PlaySolidIcon,
  XIcon,
  SpeakerXMarkIcon,
  SpeakerWaveIcon,
} from "../icons";
import { useVideoPopContext } from "../../context/VideoPopContext";
import { instasellVideoPopEmbedConfig } from "../../video-pop-index";
import { Product, ShortVideo } from "../../types/api";
import { useGAEvents } from "../../context/GoogleAnalytics";
import { useApi } from "../../lib/api";
import { addToCartDrawer } from "../../lib/addToCartDrawer";
import { useCleverTapEvents } from "../../context/ClevertapAnalytics";
import { useMetaEvents } from "../../context/MetaEventsContext";
import DOMPurify from "dompurify";

const sanitizeHTML = (html?: string) =>
  DOMPurify.sanitize(html || "", {
    ALLOWED_TAGS: [
      "b",
      "i",
      "em",
      "strong",
      "a",
      "p",
      "ul",
      "ol",
      "li",
      "br",
      "span",
    ],
    ALLOWED_ATTR: ["href", "target", "rel", "class", "style"],
    FORBID_ATTR: ["onerror", "onclick", "onload"],
  });

const classNames = (classes: Record<string, boolean>) => {
  return Object.keys(classes)
    .filter((className) => classes[className])
    .join(" ");
};

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

const VideoPIP = () => {
  const {
    shortVideo,
    setActiveVideoId,
    isPipActive,
    setIsPipActive,
    isDesktop,
    isProductDetailsModalOpen,
    setIsProductDetailsModalOpen,
    purchaseFlowAction,
    googleAnalyticsEnabled,
    useGtmForAnalytics,
    videoPipSessionToken,
    setVideoPipSessionToken,
    clevertapAnalyticsEnabled,
    closeVideoPipWhenClosedFromFullScreenMode,
    metaRetargetingEnabled,
    shortVideos,
    comparePriceEnabled,
    discountBadgeEnabled,
    displayAllProductImagesEnabled,
    storeFrontCartOperation,
    storeFrontAccessKey,
    enableStoryModeOnClose,
  } = useVideoPopContext();

  const gaEvents = useGAEvents();
  const caEvents = useCleverTapEvents();
  const fbEvents = useMetaEvents();
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isFullModalActive, setIsFullModalActive] = useState(false);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [globalMuteState, setGlobalMuteState] = useState(false); // For full screen mode

  const reelPlayerModalRef = useRef<HTMLDivElement>(null as never);
  const videoPlayer = useRef<HTMLVideoElement | null>(null);
  const modalContentRef = useRef<HTMLDivElement | null>(null as never);
  const touchStartY = useRef<number>(0);
  const touchEndY = useRef<number>(0);
  const isPauseAllowed = useRef<boolean>(true); // Flag to control external pause attempts

  const [isPipVisible, setIsPipVisible] = useState(false);
  const [storyMode, setStoryMode] = useState(false);

  // Handle back button on mobile devices
  useEffect(() => {
    if (!isPipActive || isDesktop) return;

    const handlePopState = (event: PopStateEvent) => {
      // Prevent default back navigation
      event.preventDefault();

      // Close the modal instead
      onClosePip();

      // Push a new state to prevent actual navigation
      window.history.pushState(null, "", window.location.href);
    };

    // Push current state to history stack
    window.history.pushState(null, "", window.location.href);

    // Add event listener for back button
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isPipActive, isDesktop]);

  useEffect(() => {
    if (!isPipActive || !modalContentRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !isPipVisible) {
            setIsPipVisible(true);
          }
        });
      },
      {
        threshold: 0.1, // Trigger when 10% of the element is visible
        rootMargin: "0px",
      }
    );

    observer.observe(modalContentRef.current);

    return () => {
      observer.disconnect();
    };
  }, [isPipActive, isPipVisible]);

  const [activeProduct, setActiveProduct] = useState<{
    product: Product;
    videoUrl?: string;
  } | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    null
  );
  const [selectedOptions, setSelectedOptions] = useState<{
    [key: string]: string;
  }>({});
  const [fullProductData, setFullProductData] = useState<any | null>(null);
  const [fullProductImages, setFullProductImages] = useState<string[]>([]);
  const [loadingFullProduct, setLoadingFullProduct] = useState(false);

  const api = useApi();
  const [loadingProducts, setLoadingProducts] = useState<{
    [key: string]: boolean;
  }>({});

  const [addedToCartProducts, setAddedToCartProducts] = useState<{
    [key: string]: boolean;
  }>({});

  const [outOfStockProducts, setOutOfStockProducts] = useState<{
    [key: string]: boolean;
  }>({});

  const [addedToCart, setAddedToCart] = useState(false);

  const shopDomain = instasellVideoPopEmbedConfig.getShopDomain() || "";
  let currencyRate = instasellVideoPopEmbedConfig.getCurrencyRate?.() || 1;
  let currencyCode = instasellVideoPopEmbedConfig.getCurrencyCode?.() || "INR";
  let country = instasellVideoPopEmbedConfig.getCountry?.() || "IN";
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
  const pageType = instasellVideoPopEmbedConfig.getPageType?.();
  const pageId =
    pageType == "home"
      ? ""
      : pageType == "product"
      ? instasellVideoPopEmbedConfig.currentProductId ?? ""
      : instasellVideoPopEmbedConfig.currentCollectionId ?? "";
  const [addingToCart, setAddingToCart] = useState(false);
  const hasTrackedImpression = useRef(false);

  const [wasFullScreenOpened, setWasFullScreenOpened] = useState(false);

  // Drag state management for PIP and Story mode
  const [isPipDragging, setIsPipDragging] = useState(false);
  const [pipDragStart, setPipDragStart] = useState({ x: 0, y: 0 });
  const [pipPosition, setPipPosition] = useState({ x: 0, y: 0 });
  const [hasPipMoved, setHasPipMoved] = useState(false);
  const pipDragThreshold = 5; // Minimum pixels to consider it a drag vs click

  // Check if we should show multiple videos
  const showTaggedVideos = shortVideos && shortVideos.length > 1;

  // Get current video - use shortVideos if available, otherwise fallback to shortVideo
  const getCurrentVideo = (): ShortVideo | null => {
    if (showTaggedVideos && shortVideos) {
      return shortVideos[currentVideoIndex] || null;
    }
    return shortVideo;
  };

  const currentVideo = getCurrentVideo();

  const showCountrySpecificPricing = activeProduct?.product?.cp != null;

  const calculatePrice = (basePrice: number, product?: Product) => {
    if (isDhaaga && convercySettings?.enabled) {
      const { base, curr, rate } = convercySettings;
      let sourceCurrency: string;
      if (showCountrySpecificPricing && product?.cp?.[country]?.cc) {
        sourceCurrency = product.cp[country].cc;
      } else if (
        showCountrySpecificPricing &&
        activeProduct?.product?.cp?.[country]?.cc
      ) {
        sourceCurrency = activeProduct.product.cp[country].cc;
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

  const calculateDiscountPercentage = (product: Product) => {
    const currentPrice =
      product?.cp != null
        ? product?.cp?.[country].pr ?? product.pr ?? 0
        : product.pr || 0;

    const originalPrice =
      product?.cp != null ? product.cp?.[country]?.cs || 0 : product?.c || 0;

    if (originalPrice > 0 && currentPrice > 0 && originalPrice > currentPrice) {
      const discount = ((originalPrice - currentPrice) / originalPrice) * 100;
      return Math.round(discount);
    }
    return 0;
  };

  // Navigation functions for multiple videos - FIXED: Using simpler logic from working version
  const goToNextVideo = () => {
    if (showTaggedVideos && shortVideos) {
      // Pause current desktop video before switching to avoid audio overlap
      if (isDesktop && isFullModalActive) {
        const currentVideo = document.querySelector(
          ".ins-carousel-video-item--active .ins-carousel-video"
        ) as HTMLVideoElement;
        if (currentVideo) {
          isPauseAllowed.current = true; // Allow our internal pause
          currentVideo.pause();
          currentVideo.muted = true;
        }
      }

      setCurrentVideoIndex((prev) =>
        prev >= shortVideos.length - 1 ? 0 : prev + 1
      );
    }
  };

  const goToPreviousVideo = () => {
    if (showTaggedVideos && shortVideos) {
      // Pause current desktop video before switching to avoid audio overlap
      if (isDesktop && isFullModalActive) {
        const currentVideo = document.querySelector(
          ".ins-carousel-video-item--active .ins-carousel-video"
        ) as HTMLVideoElement;
        if (currentVideo) {
          isPauseAllowed.current = true; // Allow our internal pause
          currentVideo.pause();
          currentVideo.muted = true;
        }
      }

      setCurrentVideoIndex((prev) =>
        prev <= 0 ? shortVideos.length - 1 : prev - 1
      );
    }
  };

  const goToVideo = (index: number) => {
    if (
      showTaggedVideos &&
      shortVideos &&
      index >= 0 &&
      index < shortVideos.length
    ) {
      // Pause current desktop video before switching to avoid audio overlap
      if (isDesktop && isFullModalActive) {
        const currentVideo = document.querySelector(
          ".ins-carousel-video-item--active .ins-carousel-video"
        ) as HTMLVideoElement;
        if (currentVideo) {
          isPauseAllowed.current = true; // Allow our internal pause
          currentVideo.pause();
          currentVideo.muted = true;
        }
      }

      setCurrentVideoIndex(index);
    }
  };

  useEffect(() => {
    if (isFullModalActive && !wasFullScreenOpened) {
      setWasFullScreenOpened(true);
    }
  }, [isFullModalActive, wasFullScreenOpened]);

  // Effect to auto-play when video index changes and ensure proper video management
  useEffect(() => {
    if (isFullModalActive && showTaggedVideos) {
      // Auto-play the current video after a small delay to ensure video is loaded
      setTimeout(() => {
        if (isDesktop) {
          const activeVideo = document.querySelector(
            ".ins-carousel-video-item--active .ins-carousel-video"
          ) as HTMLVideoElement;
          if (activeVideo) {
            activeVideo.muted = globalMuteState;
            activeVideo
              .play()
              .catch((error) => console.log(`%c${error}`, "color: red;"));
            setIsPlaying(true);
          }
        } else {
          // Mobile reel - ensure the video element is updated and plays
          if (videoPlayer.current) {
            videoPlayer.current.muted = globalMuteState;
            videoPlayer.current
              .play()
              .then(() => setIsPlaying(true))
              .catch((error) => console.log(`%c${error}`, "color: red;"));
          }
        }
        const currentVideoData = getCurrentVideo();
        if (currentVideoData) {
          const videoUrl = currentVideoData.m.find(
            (media) => media.s === "high"
          )?.v;
          if (videoUrl) {
            handleRegisterViewEvent(currentVideoData.i, videoUrl);
          }
        }
      }, 100);
    }
  }, [currentVideoIndex, isFullModalActive, showTaggedVideos]);

  const touchStartX = useRef<number>(0);
  const isDragging = useRef<boolean>(false);

  const handleTouchStart = (e: TouchEvent) => {
    if (!isFullModalActive || !showTaggedVideos) return;

    // Allow touches on control buttons and product panel
    const target = e.target as Element;
    if (
      target.closest(".ins-mobile-reel-controls") ||
      target.closest(".ins-reel-pop-player-product-panel") ||
      target.closest("button") ||
      target.closest("[role='button']")
    ) {
      return; // Don't interfere with control interactions
    }

    touchStartY.current = e.touches[0].clientY;
    touchStartX.current = e.touches[0].clientX;
    isDragging.current = false;
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isFullModalActive || !showTaggedVideos) return;

    // Allow touches on control buttons and product panel
    const target = e.target as Element;
    if (
      target.closest(".ins-mobile-reel-controls") ||
      target.closest(".ins-reel-pop-player-product-panel") ||
      target.closest("button") ||
      target.closest("[role='button']")
    ) {
      return; // Don't interfere with control interactions
    }

    const currentY = e.touches[0].clientY;
    const currentX = e.touches[0].clientX;
    const deltaY = Math.abs(currentY - touchStartY.current);
    const deltaX = Math.abs(currentX - touchStartX.current);

    // Only prevent if it's primarily a vertical gesture and moved more than 5px
    if (deltaY > 5 && deltaY > deltaX) {
      isDragging.current = true;
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const handleTouchEnd = (e: TouchEvent) => {
    if (!isFullModalActive || !showTaggedVideos) return;

    // Allow touches on control buttons and product panel
    const target = e.target as Element;
    if (
      target.closest(".ins-mobile-reel-controls") ||
      target.closest(".ins-reel-pop-player-product-panel") ||
      target.closest("button") ||
      target.closest("[role='button']")
    ) {
      return; // Don't interfere with control interactions
    }

    touchEndY.current = e.changedTouches[0].clientY;

    // Only prevent and handle swipe if we were dragging vertically
    if (isDragging.current) {
      e.preventDefault();
      e.stopPropagation();
      handleSwipe();
    }

    isDragging.current = false;
  };

  const handleSwipe = () => {
    if (!showTaggedVideos || !isFullModalActive) return;

    const swipeThreshold = 50;
    const swipeDistance = touchStartY.current - touchEndY.current;

    if (Math.abs(swipeDistance) > swipeThreshold) {
      if (swipeDistance > 0) {
        // Swipe up - next video
        goToNextVideo();
      } else {
        // Swipe down - previous video
        goToPreviousVideo();
      }
    }
  };

  // Helper function to check if target is an interactive element
  const isInteractiveElement = (target: HTMLElement | null): boolean => {
    if (!target) return false;
    return (
      target.tagName === "BUTTON" ||
      target.tagName === "A" ||
      !!target.closest("button") ||
      !!target.closest("a") ||
      !!target.closest(".ins-reel-pop-modal-player-pip-close-button") ||
      !!target.closest(".ins-reel-pop-player-pip-play-controls") ||
      !!target.closest(".ins-reel-pop-modal-player-mute-button") ||
      !!target.closest(".ins-carousel-close-button") ||
      !!target.closest(".ins-carousel-mute-button")
    );
  };

  // Track whether pointer events are active to avoid duplicate touch handlers
  const usingPointerRef = useRef(false);

  // Track whether document-level drag listeners are attached
  const dragListenersAttached = useRef(false);

  // PIP and Story Drag Handlers
  const handleDragStart = (clientX: number, clientY: number) => {
    // Only allow dragging in PIP or Story mode, not in full screen
    if (isFullModalActive) return;

    setIsPipDragging(true);
    setPipDragStart({ x: clientX, y: clientY });
    setHasPipMoved(false);

    // Prevent text selection during drag
    document.body.style.userSelect = "none";
    document.body.style.webkitUserSelect = "none";

    // Attach document listeners immediately for first-move responsiveness
    if (!dragListenersAttached.current) {
      document.addEventListener("mousemove", handleMouseMove as any);
      document.addEventListener("mouseup", handleMouseUp as any);
      document.addEventListener("touchmove", handlePipTouchMove as any, {
        passive: false,
      });
      document.addEventListener("touchend", handlePipTouchEnd as any, {
        passive: false,
      });
      dragListenersAttached.current = true;
    }
  };

  // Unified Pointer events (desktop + mobile) for immediate, smooth drag
  const handlePointerDown = (e: any) => {
    if (isFullModalActive) return;

    const target = e.target as HTMLElement;
    if (isInteractiveElement(target)) return;

    usingPointerRef.current = true;
    try {
      (e.currentTarget as HTMLElement)?.setPointerCapture?.(e.pointerId);
    } catch {}
    e.preventDefault();
    e.stopPropagation();
    handleDragStart(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: any) => {
    if (!isPipDragging) return;
    e.preventDefault();
    requestAnimationFrame(() => {
      handleDragMove(e.clientX, e.clientY);
    });
  };

  const handlePointerUp = (e: any) => {
    if (!isPipDragging) return;
    const target = e.target as HTMLElement;
    if (hasPipMoved) {
      e.preventDefault();
      e.stopPropagation();
    } else {
      // No drag -> synthesize click so desktop video and controls receive it
      const clickEvent = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        clientX: e.clientX,
        clientY: e.clientY,
      });
      setTimeout(() => {
        // If interactive element, let it handle the click
        const interactiveEl =
          target.closest("button") || target.closest("a") || null;
        if (interactiveEl) {
          interactiveEl.dispatchEvent(clickEvent);
          return;
        }
        // Otherwise, forward click to the video element to open full screen
        if (videoPlayer.current) {
          videoPlayer.current.dispatchEvent(clickEvent);
          return;
        }
        // Fallback to original target
        target.dispatchEvent(clickEvent);
      }, 10);
    }
    handleDragEnd();
    usingPointerRef.current = false;
  };

  const handleDragMove = (clientX: number, clientY: number) => {
    if (!isPipDragging || isFullModalActive) return;

    const deltaX = clientX - pipDragStart.x;
    const deltaY = clientY - pipDragStart.y;

    // Check if movement exceeds threshold to consider it a drag
    if (
      !hasPipMoved &&
      (Math.abs(deltaX) > pipDragThreshold ||
        Math.abs(deltaY) > pipDragThreshold)
    ) {
      setHasPipMoved(true);
    }

    // Update position immediately for smooth dragging
    // Always update position during drag for smooth movement
    const newX = pipPosition.x + deltaX;
    const newY = pipPosition.y + deltaY;

    setPipPosition({ x: newX, y: newY });
    setPipDragStart({ x: clientX, y: clientY });
  };

  const handleDragEnd = () => {
    if (!isPipDragging) return;

    setIsPipDragging(false);

    // Restore text selection
    document.body.style.userSelect = "";
    document.body.style.webkitUserSelect = "";

    // Detach document listeners immediately
    if (dragListenersAttached.current) {
      document.removeEventListener("mousemove", handleMouseMove as any);
      document.removeEventListener("mouseup", handleMouseUp as any);
      document.removeEventListener("touchmove", handlePipTouchMove as any);
      document.removeEventListener("touchend", handlePipTouchEnd as any);
      dragListenersAttached.current = false;
    }

    // Reset hasPipMoved after a small delay to allow normal clicks again
    // This prevents accidental clicks immediately after dragging
    if (hasPipMoved) {
      setTimeout(() => {
        setHasPipMoved(false);
      }, 100);
    }
  };

  // Desktop mouse event handlers
  const handleMouseDown = (e: MouseEvent) => {
    if (isFullModalActive) return;

    const target = e.target as HTMLElement;

    // Don't interfere with buttons, links, or interactive elements
    if (isInteractiveElement(target)) {
      // Allow normal click behavior on interactive elements
      return;
    }

    // Don't preventDefault immediately - allow normal clicks if no drag occurs
    e.stopPropagation();
    handleDragStart(e.clientX, e.clientY);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isPipDragging) return;

    const target = e.target as HTMLElement;

    // Don't interfere with buttons, links, or interactive elements
    if (isInteractiveElement(target)) {
      // If we started dragging but moved to an interactive element, cancel drag
      if (hasPipMoved) {
        handleDragEnd();
      }
      return;
    }

    // Once we start dragging, prevent default to allow smooth dragging
    e.preventDefault();

    // Use requestAnimationFrame for smooth updates
    requestAnimationFrame(() => {
      handleDragMove(e.clientX, e.clientY);
    });
  };

  const handleMouseUp = (e: MouseEvent) => {
    if (!isPipDragging) {
      // If we weren't dragging, allow the click to happen naturally
      return;
    }

    // If we were dragging, prevent the click
    if (hasPipMoved) {
      e.preventDefault();
      e.stopPropagation();
    }

    handleDragEnd();
  };

  // Mobile touch event handlers for PIP drag - immediate drag on mobile
  const handlePipTouchStart = (e: TouchEvent) => {
    if (usingPointerRef.current) return;
    if (isFullModalActive) return;

    const target = e.target as HTMLElement;

    // Don't interfere with buttons, links, or interactive elements
    if (isInteractiveElement(target)) {
      // Allow normal click behavior on interactive elements
      return;
    }

    const touch = e.touches[0];
    // Prevent default immediately to stop page scrolling and enable smooth drag
    e.preventDefault();
    e.stopPropagation();
    handleDragStart(touch.clientX, touch.clientY);
  };

  const handlePipTouchMove = (e: TouchEvent) => {
    if (usingPointerRef.current) return;
    if (!isPipDragging || isFullModalActive) return;

    const target = e.target as HTMLElement;

    // Don't interfere with buttons, links, or interactive elements
    if (isInteractiveElement(target)) {
      // If we started dragging but moved to an interactive element, cancel drag
      if (hasPipMoved) {
        handleDragEnd();
      }
      return;
    }

    // Prevent default to allow smooth dragging
    e.preventDefault();
    e.stopPropagation();
    const touch = e.touches[0];

    // Use requestAnimationFrame for smooth updates
    requestAnimationFrame(() => {
      handleDragMove(touch.clientX, touch.clientY);
    });
  };

  const handlePipTouchEnd = (e: TouchEvent) => {
    if (usingPointerRef.current) return;
    const target = e.target as HTMLElement;
    const touch = e.changedTouches[0];
    const isInteractive = isInteractiveElement(target);

    if (!isPipDragging) {
      // If we weren't dragging, manually trigger click for tap
      if (isInteractive && target) {
        // Dispatch click directly to the interactive element
        const clickEvent = new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          clientX: touch.clientX,
          clientY: touch.clientY,
        });
        (
          target.closest("button") ||
          target.closest("a") ||
          target
        ).dispatchEvent(clickEvent);
      } else if (target) {
        // Dispatch click to touched target (e.g., video) for story open
        const clickEvent = new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          clientX: touch.clientX,
          clientY: touch.clientY,
        });
        target.dispatchEvent(clickEvent);
      }
      return;
    }

    // If we were dragging, prevent the click
    if (hasPipMoved) {
      e.preventDefault();
      e.stopPropagation();
    } else {
      // No movement = tap, manually trigger click
      if (isInteractive && target) {
        // Dispatch click directly to the interactive element
        const clickEvent = new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          clientX: touch.clientX,
          clientY: touch.clientY,
        });
        // Small delay to ensure drag end completes first
        setTimeout(() => {
          (
            target.closest("button") ||
            target.closest("a") ||
            target
          ).dispatchEvent(clickEvent);
        }, 10);
      } else if (target) {
        // Dispatch click to touched target (e.g., video)
        const clickEvent = new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          clientX: touch.clientX,
          clientY: touch.clientY,
        });
        // Small delay to ensure drag end completes first
        setTimeout(() => {
          target.dispatchEvent(clickEvent);
        }, 10);
      }
    }

    handleDragEnd();
  };

  useEffect(() => {
    (async () => {
      try {
        if (hasTrackedImpression.current || !isPipVisible) {
          return;
        }
        api
          .shortVideosBoron({
            eventType: "shortVideoImpression",
            source: "videoPop",
            shortVideoView: {
              shortVideoId: currentVideo?.i ?? "",
            },
            pageId,
            pageType,
          })
          .then(() => {
            hasTrackedImpression.current = true;
          })
          .catch((error) =>
            console.log(`%cFailed to call error${error}`, "color: red;")
          );

        if (googleAnalyticsEnabled) {
          gaEvents.trackImpression(
            "video-pop",
            instasellVideoPopEmbedConfig.pageType,
            useGtmForAnalytics
          );
        }
        if (clevertapAnalyticsEnabled) {
          caEvents.trackImpression(
            "video-carousel",
            instasellVideoPopEmbedConfig.pageType
          );
        }
        if (metaRetargetingEnabled) {
          fbEvents.trackImpression(
            "video-carousel",
            instasellVideoPopEmbedConfig.pageType
          );
        }
      } catch (error) {
        console.log(
          `%cFailed to track feed impression ${error}`,
          "color: red;"
        );
      }
    })();
  }, [currentVideo, isPipVisible]);

  useEffect(() => {
    if (activeProduct?.product) {
      const product = activeProduct.product;

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
    }
  }, [activeProduct]);

  // Fetch full product data from Shopify API when displayAllProductImagesEnabled is true
  useEffect(() => {
    const fetchFullProductData = async () => {
      if (
        !displayAllProductImagesEnabled ||
        !activeProduct?.product?.h ||
        fullProductData
      )
        return;

      try {
        setLoadingFullProduct(true);
        const productData =
          await instasellVideoPopEmbedConfig.fetchProductDetails(
            activeProduct.product.h
          );
        if (productData) {
          setFullProductData(productData);
          const images =
            instasellVideoPopEmbedConfig.getProductImages(productData);
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
  }, [
    displayAllProductImagesEnabled,
    activeProduct?.product?.h,
    fullProductData,
  ]);

  // Reset current video index and handle mute state when switching to full modal
  useEffect(() => {
    if (isFullModalActive && showTaggedVideos) {
      setGlobalMuteState(false); // Unmuted by default in full screen

      if (videoPlayer.current) {
        isPauseAllowed.current = true; // Allow our internal pause
        videoPlayer.current.pause();
        videoPlayer.current.muted = true;
      }
    } else if (isFullModalActive && !showTaggedVideos) {
      // NEW: Handle single video mode - unmute when going to full screen
      setIsMuted(false);
      if (videoPlayer.current) {
        videoPlayer.current.muted = false;
      }
    } else if (!isFullModalActive) {
      setIsMuted(true); // Always muted when returning to PIP
      if (videoPlayer.current) {
        isPauseAllowed.current = true; // Allow our internal pause
        videoPlayer.current.muted = true;
      }
    }
  }, [isFullModalActive]);

  // Add touch event listeners for mobile swipe
  useEffect(() => {
    if (
      !isDesktop &&
      isFullModalActive &&
      showTaggedVideos &&
      modalContentRef.current
    ) {
      const element = modalContentRef.current;
      element.addEventListener("touchstart", handleTouchStart, {
        passive: false,
      });
      element.addEventListener("touchmove", handleTouchMove, {
        passive: false,
      });
      element.addEventListener("touchend", handleTouchEnd, { passive: false });

      return () => {
        element.removeEventListener("touchstart", handleTouchStart);
        element.removeEventListener("touchmove", handleTouchMove);
        element.removeEventListener("touchend", handleTouchEnd);
      };
    }
  }, [isDesktop, isFullModalActive, showTaggedVideos]);

  useEffect(() => {
    if (!videoPlayer.current) return;

    const video = videoPlayer.current;
    const originalPause = video.pause.bind(video);

    video.pause = function () {
      const shouldBlockPause = (isPipActive && !storyMode) || isFullModalActive;

      if (shouldBlockPause && !isPauseAllowed.current) {
        return;
      }

      originalPause();
    };
    return () => {
      if (video && video.pause !== originalPause) {
        video.pause = originalPause;
      }
    };
  }, [videoPlayer.current, isPipActive, isFullModalActive, storyMode]);

  useEffect(() => {
    isPauseAllowed.current = false;
  }, [currentVideoIndex, isFullModalActive]);

  // Add touchstart listener with passive: false for immediate preventDefault
  useEffect(() => {
    if (!isPipActive || isFullModalActive || !reelPlayerModalRef.current)
      return;

    const element = reelPlayerModalRef.current;
    const handleTouchStart = (e: TouchEvent) => {
      handlePipTouchStart(e as any);
    };

    // Add touchstart with passive: false to allow immediate preventDefault
    element.addEventListener("touchstart", handleTouchStart, {
      passive: false,
    });

    return () => {
      element.removeEventListener("touchstart", handleTouchStart);
    };
  }, [isPipActive, isFullModalActive]);

  // Global event listeners for PIP drag (desktop and mobile)
  useEffect(() => {
    if (!isPipActive || isFullModalActive || dragListenersAttached.current)
      return;

    const handleGlobalMouseMove = (e: globalThis.MouseEvent) => {
      handleMouseMove(e as any);
    };

    const handleGlobalMouseUp = (e: globalThis.MouseEvent) => {
      handleMouseUp(e as any);
    };

    const handleGlobalTouchMove = (e: globalThis.TouchEvent) => {
      handlePipTouchMove(e as any);
    };

    const handleGlobalTouchEnd = (e: globalThis.TouchEvent) => {
      handlePipTouchEnd(e as any);
    };

    if (isPipDragging) {
      // Add global listeners when dragging starts
      document.addEventListener("mousemove", handleGlobalMouseMove);
      document.addEventListener("mouseup", handleGlobalMouseUp);
      document.addEventListener("touchmove", handleGlobalTouchMove, {
        passive: false,
      });
      document.addEventListener("touchend", handleGlobalTouchEnd, {
        passive: false,
      });

      return () => {
        document.removeEventListener("mousemove", handleGlobalMouseMove);
        document.removeEventListener("mouseup", handleGlobalMouseUp);
        document.removeEventListener("touchmove", handleGlobalTouchMove);
        document.removeEventListener("touchend", handleGlobalTouchEnd);
      };
    }
  }, [isPipDragging, isPipActive, isFullModalActive]);

  useEffect(() => {
    if (isFullModalActive) {
      // Prevent body scroll
      const originalOverflow = document.body.style.overflow;
      const originalPosition = document.body.style.position;
      const originalWidth = document.body.style.width;
      const originalHeight = document.body.style.height;
      const originalTop = document.body.style.top;

      const scrollY = window.scrollY;

      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.width = "100%";
      document.body.style.height = "100%";
      document.body.style.top = `-${scrollY}px`;

      return () => {
        // Restore body scroll
        document.body.style.overflow = originalOverflow;
        document.body.style.position = originalPosition;
        document.body.style.width = originalWidth;
        document.body.style.height = originalHeight;
        document.body.style.top = originalTop;

        // Restore scroll position
        window.scrollTo(0, scrollY);
      };
    }
  }, [isFullModalActive]);

  const handleRegisterViewEvent = async (videoId: string, videoUrl: string) => {
    try {
      await api.shortVideosBoron({
        eventType: "shortVideoView",
        source: "videoPop",
        shortVideoView: {
          shortVideoId: videoId,
        },
        pageId,
        pageType,
      });

      if (googleAnalyticsEnabled) {
        gaEvents.trackView(
          "video-pop",
          instasellVideoPopEmbedConfig.pageType,
          videoUrl,
          useGtmForAnalytics
        );
      }
      if (clevertapAnalyticsEnabled) {
        caEvents.trackView(
          "video-pop",
          instasellVideoPopEmbedConfig.pageType,
          videoUrl
        );
      }
    } catch (error) {
      console.log(`%c${error}`, "color: red;");
    } finally {
      sessionStorage.setItem("sessionTime", Date.now().toString());
    }
  };

  const handleRegisterClickEvent = async (
    videoId: string,
    videoUrl: string
  ) => {
    try {
      await api.shortVideosBoron({
        eventType: "shortVideoClick",
        shortVideoView: {
          shortVideoId: videoId,
        },
        source: "videoPop",
        pageId,
        pageType,
      });
      // Set influenced click attribution for 1 day
      const now = Date.now();
      const attributionData = {
        value: true,
        timestamp: now,
        expiry: now + 24 * 60 * 60 * 1000, // 1 day in milliseconds
      };
      localStorage.setItem(
        "influenced_click_attribute",
        JSON.stringify(attributionData)
      );

      if (googleAnalyticsEnabled) {
        gaEvents.trackClick(
          "video-pop",
          instasellVideoPopEmbedConfig.pageType,
          videoUrl,
          useGtmForAnalytics
        );
      }
      if (clevertapAnalyticsEnabled) {
        caEvents.trackClick(
          "video-pop",
          instasellVideoPopEmbedConfig.pageType,
          videoUrl
        );
      }
    } catch (error) {
      console.log(`%c${error}`, "color: red;");
    } finally {
      sessionStorage.setItem("sessionTime", Date.now().toString());
    }
  };

  const handleRegisterClickAndViewEvent = async (
    videoId: string,
    videoUrl: string
  ) => {
    try {
      await api.shortVideosBoron({
        eventType: "shortVideoClick",
        shortVideoView: {
          shortVideoId: videoId,
        },
        source: "videoPop",
        pageId,
        pageType,
      });
      // Set influenced click attribution for 1 day
      const now = Date.now();
      const attributionData = {
        value: true,
        timestamp: now,
        expiry: now + 24 * 60 * 60 * 1000, // 1 day in milliseconds
      };
      localStorage.setItem(
        "influenced_click_attribute",
        JSON.stringify(attributionData)
      );

      await api.shortVideosBoron({
        eventType: "shortVideoView",
        source: "videoPop",
        shortVideoView: {
          shortVideoId: videoId,
        },
        pageId,
        pageType,
      });

      if (googleAnalyticsEnabled) {
        gaEvents.trackClick(
          "video-pop",
          instasellVideoPopEmbedConfig.pageType,
          videoUrl,
          useGtmForAnalytics
        );
        gaEvents.trackView(
          "video-pop",
          instasellVideoPopEmbedConfig.pageType,
          videoUrl,
          useGtmForAnalytics
        );
      }
      if (clevertapAnalyticsEnabled) {
        caEvents.trackClick(
          "video-pop",
          instasellVideoPopEmbedConfig.pageType,
          videoUrl
        );
        caEvents.trackView(
          "video-pop",
          instasellVideoPopEmbedConfig.pageType,
          videoUrl
        );
      }
      if (metaRetargetingEnabled) {
        fbEvents.trackClick(
          "video-pop",
          instasellVideoPopEmbedConfig.pageType,
          videoUrl
        );
        fbEvents.trackView(
          "video-pop",
          instasellVideoPopEmbedConfig.pageType,
          videoUrl
        );
      }
    } catch (error) {
      console.log(`%c${error}`, "color: red;");
    } finally {
      sessionStorage.setItem("sessionTime", Date.now().toString());
    }
  };

  const handleClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isDesktop) {
      window.scrollTo(0, window.scrollY + 200);
    }

    // In full screen desktop mode, clicking outside videos should close modal
    if (e.target === e.currentTarget && isFullModalActive && isDesktop) {
      setIsFullModalActive(false);
      setIsProductDetailsModalOpen(false);
      return;
    }

    if (e.target === e.currentTarget) {
      setIsFullModalActive(false);
      setIsProductDetailsModalOpen(false);
    }
  };

  const videoUrl = currentVideo?.m.find((media) => media.s === "high")?.v;
  const floatingVideoUrl = currentVideo?.m.find(
    (media) => media.s === "low"
  )?.v;

  const thumbnail = currentVideo?.m.find((media) => media.s === "high")?.t;

  const onClosePip = () => {
    if (!wasFullScreenOpened && currentVideo) {
      api
        .shortVideosBoron({
          eventType: "closePip",
          source: "videoPop",
          shortVideoView: {
            shortVideoId: currentVideo.i,
          },
          pageId,
          pageType,
        })
        .catch((error) => {
          console.log(`%cClose PIP API call failed ${error}`, "color: red;");
        });
    }

    // Check if story mode should be enabled on close
    if (enableStoryModeOnClose) {
      setStoryMode(true);
    } else {
      // Completely close the PIP
      setIsPipActive(false);
      setStoryMode(false);
    }

    // Reset drag position
    setPipPosition({ x: 0, y: 0 });
    setHasPipMoved(false);
    setIsPipDragging(false);

    if (reelPlayerModalRef.current) {
      reelPlayerModalRef.current.style.cssText = "";
    }
  };

  const handleVideoClick = (e: MouseEvent) => {
    e.stopPropagation();

    // Prevent click if we were dragging
    if (hasPipMoved) {
      setHasPipMoved(false);
      return;
    }

    if (storyMode) {
      setStoryMode(false);
    }

    if (!isFullModalActive) {
      setIsFullModalActive(true);

      if (currentVideo && !showTaggedVideos) {
        handleRegisterClickAndViewEvent(currentVideo.i, currentVideo?.m[0]?.v);
      }

      if (currentVideo && showTaggedVideos) {
        handleRegisterClickEvent(currentVideo.i, currentVideo?.m[0]?.v);
      }

      if (reelPlayerModalRef.current) {
        reelPlayerModalRef.current.style.top = "";
        reelPlayerModalRef.current.style.left = "";
        reelPlayerModalRef.current.style.bottom = "";
        reelPlayerModalRef.current.style.right = "";
      }
    }
  };

  const handlePlayPause = (e: MouseEvent) => {
    e.stopPropagation();
    if (!videoPlayer.current) return;

    if (videoPlayer.current.paused) {
      videoPlayer.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((error) => console.log(`%c${error}`, "color: red;"));
    } else {
      isPauseAllowed.current = true; // Allow our internal pause
      videoPlayer.current.pause();
      setIsPlaying(false);
    }
  };

  const handleShopNow = async (productId: string) => {
    // Mute the video when Shop Now is clicked
    if (isFullModalActive && showTaggedVideos) {
      // Multi-video mode - use global mute state
      setGlobalMuteState(true);
      const allVideos = document.querySelectorAll(
        ".ins-carousel-video, .ins-reel-video"
      );
      allVideos.forEach((video: Element) => {
        (video as HTMLVideoElement).muted = true;
      });
    } else {
      // Single video or PIP mode
      setIsMuted(true);
      if (videoPlayer.current) {
        videoPlayer.current.muted = true;
      }
    }

    const product = currentVideo?.p.find((p) => p.i === productId);

    try {
      if (product) {
        if (purchaseFlowAction === "popUp") {
          if (product?.v && product?.v.length > 1) {
            setActiveProduct({
              product: product,
              videoUrl: videoUrl,
            });
            setIsProductDetailsModalOpen(true);
            return;
          }
        } else if (purchaseFlowAction === "pdp") {
          if (
            product?.v &&
            product?.v.length > 1 &&
            !window.location.pathname.includes("/products/") &&
            !storeFrontCartOperation
          ) {
            window.location.href = "/products/" + product.h;
            return;
          }
        }
        await handlePurchase(product);
      }
    } catch (err) {
      console.log(`%cFFailed to fetch product details ${err}`, "color: red;");
    }
  };

  const handlePurchase = async (product: Product) => {
    if (!product.vi) return;

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
              shortVideoId: currentVideo?.i!,
              productId: product.i,
              providerCartId: "",
              variantId: variantId,
              quantity: 1,
              orderAttributionToken,
            },
            source: "videoPop",
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
            instasellVideoPopEmbedConfig.pageType,
            currentVideo?.m[0].v ?? "",
            useGtmForAnalytics
          );
        }
        if (clevertapAnalyticsEnabled) {
          caEvents.trackAddToCart(
            product.i,
            1,
            variantId,
            "video-carousel",
            instasellVideoPopEmbedConfig.pageType,
            currentVideo?.m[0].v ?? ""
          );
        }
        if (metaRetargetingEnabled) {
          fbEvents.trackAddToCart(
            product.i,
            1,
            variantId,
            "video-carousel",
            instasellVideoPopEmbedConfig.pageType,
            currentVideo?.m[0].v ?? ""
          );
        }

        setAddedToCartProducts((prev) => ({ ...prev, [product.i]: true }));
        setTimeout(() => {
          setAddedToCartProducts((prev) => ({ ...prev, [product.i]: false }));
        }, 5000);
        setOutOfStockProducts((prev) => ({
          ...prev,
          [product.i]: false,
        }));
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
        await instasellVideoPopEmbedConfig.addToCart(
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
        const cart = await instasellVideoPopEmbedConfig.getCurrentCart();
        if (!cart) {
          throw new Error("Failed to verify cart update");
        }

        try {
          await instasellVideoPopEmbedConfig.updateCartInfo(
            orderAttributionToken
          );
        } catch (error) {
          console.log(`%cFailed to update cart ${error}`, "color: red;");
        }

        await api.shortVideosBoron({
          eventType: "addToCart",
          addToCart: {
            shortVideoId: currentVideo?.i!,
            productId: product.i,
            providerCartId: cart.token,
            variantId: variantId,
            quantity: 1,
            orderAttributionToken,
          },
          source: "videoPop",
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
          "video-pop",
          instasellVideoPopEmbedConfig.pageType,
          currentVideo?.m[0]?.v ?? "",
          useGtmForAnalytics
        );
      }
      if (clevertapAnalyticsEnabled) {
        caEvents.trackAddToCart(
          product.i,
          1,
          variantId,
          "video-pop",
          instasellVideoPopEmbedConfig.pageType,
          shortVideo?.m[0]?.v ?? ""
        );
      }
      if (metaRetargetingEnabled) {
        fbEvents.trackAddToCart(
          product.i,
          1,
          variantId,
          "video-pop",
          instasellVideoPopEmbedConfig.pageType,
          shortVideo?.m[0]?.v ?? ""
        );
      }

      if (purchaseFlowAction === "pdp") {
        if (
          !window.location.pathname.includes("/products/") &&
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

      setOutOfStockProducts((prev) => ({
        ...prev,
        [product.i]: false,
      }));
    } catch (error) {
      console.log(`%cError in purchase flow ${error}`, "color: red;");
    } finally {
      setLoadingProducts((prev) => ({ ...prev, [product.i]: false }));
      sessionStorage.setItem("sessionTime", Date.now().toString());
    }
  };

  const handleMuteToggle = (e: MouseEvent) => {
    e.stopPropagation();

    if (isFullModalActive && showTaggedVideos) {
      // In full screen multi-video mode, control global mute state
      setGlobalMuteState(!globalMuteState);

      // Update all video elements
      const allVideos = document.querySelectorAll(
        ".ins-carousel-video, .ins-reel-video"
      );
      allVideos.forEach((video: Element) => {
        (video as HTMLVideoElement).muted = !globalMuteState;
      });
    } else {
      // Single video or PIP mode
      if (videoPlayer.current) {
        videoPlayer.current.muted = !videoPlayer.current.muted;
        setIsMuted(videoPlayer.current.muted);
      }
    }
  };

  const getSelectedVariant = () => {
    if (!activeProduct?.product?.v || !selectedVariantId) return null;
    return activeProduct.product.v.find(
      (variant) => variant.pi === selectedVariantId
    );
  };

  const handleOptionSelect = (optionName: string, optionValue: string) => {
    if (!activeProduct?.product) return;

    const newSelectedOptions = {
      ...selectedOptions,
      [optionName]: optionValue,
    };

    setSelectedOptions(newSelectedOptions);

    const selectedValues = activeProduct.product.o
      .map(
        (option) =>
          newSelectedOptions[option.n as keyof typeof newSelectedOptions] ||
          option.v[0]
      )
      .join(" / ");

    const matchingVariant = activeProduct.product.v.find(
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

    const selectedValues = activeProduct?.product?.o
      .map(
        (opt) =>
          tempSelections[opt.n as keyof typeof tempSelections] || opt.v[0]
      )
      .join(" / ");

    const variantForThisOption = activeProduct?.product?.v.find(
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
        ? "ins-pip-product-details-variants-item__active ins-pip-product-details-variants-item__out-of-stock"
        : "ins-pip-product-details-variants-item__active";
    }

    return isOutOfStock
      ? "ins-pip-product-details-variants-item__out-of-stock"
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

  const getButtonText = (product: Product) => {
    if (isSelectedVariantOutOfStock()) {
      return shopDomain === "terredefrance.myshopify.com"
        ? "Rupture de stock"
        : shopDomain === "37f807-2.myshopify.com"
        ? "Agotado"
        : "Out of stock";
    }
    if (shopDomain === "buywow.in" && outOfStockProducts[product.i]) {
      return "Out of stock";
    }
    if (shopDomain === "terredefrance.myshopify.com") {
      return loadingProducts[product.i]
        ? "Ajout au panier"
        : "Ajouter au panier";
    }
    if (shopDomain === "336df5.myshopify.com") {
      return loadingProducts[product.i] ? "Adding to cart.." : "ADD TO CART";
    }
    if (shopDomain === "37f807-2.myshopify.com") {
      return loadingProducts[product.i] ? "comprando" : "comprar";
    }

    if (shopDomain == "") {
      return loadingProducts[product.i]
        ? (activeProduct?.product?.v.length ?? 0) > 1
          ? "Loading..."
          : "Adding to cart.."
        : (activeProduct?.product?.v.length ?? 0) > 1
        ? "Shop now"
        : "ADD TO CART";
    }

    return loadingProducts[product.i] ? "Adding to cart.." : "ADD TO CART";
  };

  const handleAddToCart = async () => {
    if (!activeProduct) return;

    // Mute the video when Add to Cart is clicked
    if (isFullModalActive && showTaggedVideos) {
      // Multi-video mode - use global mute state
      setGlobalMuteState(true);
      const allVideos = document.querySelectorAll(
        ".ins-carousel-video, .ins-reel-video"
      );
      allVideos.forEach((video: Element) => {
        (video as HTMLVideoElement).muted = true;
      });
    } else {
      // Single video or PIP mode
      setIsMuted(true);
      if (videoPlayer.current) {
        videoPlayer.current.muted = true;
      }
    }

    setAddingToCart(true);
    const variantId = selectedVariantId || activeProduct.product?.v[0]?.pi;

    if (!variantId) {
      console.log(`%cNo variant selected`, "color: red;");
      setAddingToCart(false);
      return;
    }

    setOutOfStockProducts((prev) => ({
      ...prev,
      [activeProduct.product.i]: false,
    }));

    const orderAttributionToken =
      localStorage?.getItem("__IS_VTOK") + "_" + new Date().toISOString();

    if (storeFrontCartOperation) {
      try {
        // Check stock for buywow.in before proceeding
        if (shopDomain === "buywow.in") {
          try {
            const stockStatus = await api.checkStock({
              productId: activeProduct.product.pi,
              variantId: variantId,
            });

            console.log("Stock status :", stockStatus);

            if (stockStatus !== "in stock") {
              setOutOfStockProducts((prev) => ({
                ...prev,
                [activeProduct.product.i]: true,
              }));
              setAddingToCart(false);
              return;
            }
            setOutOfStockProducts((prev) => ({
              ...prev,
              [activeProduct.product.i]: false,
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
            productId: activeProduct.product.pi,
            variantId,
            orderAttributionToken,
          });
          await api.shortVideosBoron({
            eventType: "addToCart",
            addToCart: {
              shortVideoId: currentVideo?.i ?? "",
              productId: activeProduct.product.i,
              providerCartId: "",
              variantId: variantId,
              quantity: 1,
              orderAttributionToken,
            },
            source: "videoPop",
            pageId,
            pageType,
          });
        }

        // Add analytics tracking for storeFrontCartOperation
        if (googleAnalyticsEnabled) {
          gaEvents.trackAddToCart(
            activeProduct.product.i,
            1,
            variantId,
            "video-carousel",
            instasellVideoPopEmbedConfig.pageType,
            currentVideo?.m[0].v ?? "",
            useGtmForAnalytics
          );
        }
        if (clevertapAnalyticsEnabled) {
          caEvents.trackAddToCart(
            activeProduct.product.i,
            1,
            variantId,
            "video-carousel",
            instasellVideoPopEmbedConfig.pageType,
            currentVideo?.m[0].v ?? ""
          );
        }
        if (metaRetargetingEnabled) {
          fbEvents.trackAddToCart(
            activeProduct.product.i,
            1,
            variantId,
            "video-carousel",
            instasellVideoPopEmbedConfig.pageType,
            currentVideo?.m[0].v ?? ""
          );
        }

        setAddingToCart(false);
        setAddedToCart(true);
        setTimeout(() => {
          setAddedToCart(false);
        }, 5000);
        setOutOfStockProducts((prev) => ({
          ...prev,
          [activeProduct.product.i]: false,
        }));
      } catch (error) {
        console.log(
          `%cError in storefront cart operation: ${error}`,
          "color: red;"
        );
        setAddingToCart(false);
      }
      return;
    }

    try {
      let drawerAddSuccess: boolean = false;

      if (!storeFrontCartOperation) {
        drawerAddSuccess = await addToCartDrawer(variantId);
      }

      if (!drawerAddSuccess && !storeFrontCartOperation) {
        await instasellVideoPopEmbedConfig.addToCart(
          variantId,
          "REELS",
          activeProduct.product.h,
          orderAttributionToken
        );
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      if (storeFrontCartOperation) {
        // Check stock for buywow.in before proceeding
        if (shopDomain === "buywow.in") {
          try {
            const stockStatus = await api.checkStock({
              productId: activeProduct.product.pi,
              variantId: variantId,
            });

            console.log("Stock status :", stockStatus);

            if (stockStatus !== "in stock") {
              setOutOfStockProducts((prev) => ({
                ...prev,
                [activeProduct.product.i]: true,
              }));
              setAddingToCart(false);
              return;
            }
            setOutOfStockProducts((prev) => ({
              ...prev,
              [activeProduct.product.i]: false,
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
            productId: activeProduct.product.pi,
            variantId,
            orderAttributionToken,
          });
        }
      } else {
        const cart = await instasellVideoPopEmbedConfig.getCurrentCart();
        if (!cart) {
          throw new Error("Failed to verify cart update");
        }

        await api.shortVideosBoron({
          eventType: "addToCart",
          addToCart: {
            shortVideoId: currentVideo?.i ?? "",
            productId: activeProduct.product.i,
            providerCartId: cart.token,
            variantId: variantId,
            quantity: 1,
            orderAttributionToken,
          },
          source: "videoPop",
          pageId,
          pageType,
        });
      }
      if (googleAnalyticsEnabled) {
        gaEvents.trackAddToCart(
          activeProduct.product.i,
          1,
          variantId,
          "video-carousel",
          instasellVideoPopEmbedConfig.pageType,
          currentVideo?.m[0].v ?? "",
          useGtmForAnalytics
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

      setOutOfStockProducts((prev) => ({
        ...prev,
        [activeProduct.product.i]: false,
      }));
      setAddingToCart(false);
    } catch (error) {
      console.log(`%cError in purchase flow ${error}`, "color: red;");
      setAddingToCart(false);
    } finally {
      sessionStorage.setItem("sessionTime", Date.now().toString());
    }
  };

  // Desktop Multi-Video Carousel Component
  const renderDesktopCarousel = () => {
    if (!showTaggedVideos || !shortVideos || !isFullModalActive) return null;

    return (
      <div className="ins-desktop-video-carousel" onClick={handleClick}>
        {shortVideos.map((video, index) => {
          const isActive = index === currentVideoIndex;
          const isPrevious = index === currentVideoIndex - 1;
          const isNext = index === currentVideoIndex + 1;
          const videoUrl = video.m.find((media) => media.s === "high")?.v;

          return (
            <div
              key={video.i}
              className={classNames({
                "ins-carousel-video-item": true,
                "ins-carousel-video-item--active": isActive,
                "ins-carousel-video-item--previous": isPrevious,
                "ins-carousel-video-item--next": isNext,
                "ins-carousel-video-item--hidden":
                  !isActive && !isPrevious && !isNext,
              })}
              onClick={(e) => {
                e.stopPropagation();
                if (!isActive) {
                  goToVideo(index);
                }
              }}
            >
              <video
                className="ins-carousel-video"
                src={videoUrl}
                autoPlay={isActive}
                loop
                muted={globalMuteState}
                controls={false}
                playsInline
                onPlay={() => isActive && setIsPlaying(true)}
                onPause={() => isActive && setIsPlaying(false)}
                onLoadedMetadata={(e) => {
                  if (isActive) {
                    const player = e.currentTarget;
                    player.muted = globalMuteState;
                    player
                      .play()
                      .then(() => setIsPlaying(true))
                      .catch((error) =>
                        console.log(`%c${error}`, "color: red;")
                      );
                  }
                }}
                ref={isActive ? videoPlayer : null}
              />

              {/* Individual video controls - only show on active video */}
              {isActive && (
                <div className="ins-carousel-video-controls">
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setGlobalMuteState(!globalMuteState);
                      // Update all videos
                      const allVideos = document.querySelectorAll(
                        ".ins-carousel-video, .ins-reel-video"
                      );
                      allVideos.forEach((video: Element) => {
                        (video as HTMLVideoElement).muted = !globalMuteState;
                      });
                    }}
                    className="ins-carousel-mute-button"
                  >
                    {globalMuteState ? (
                      <SpeakerXMarkIcon className="ins-carousel-speaker-icon" />
                    ) : (
                      <SpeakerWaveIcon className="ins-carousel-speaker-icon" />
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();

                      if (videoPlayer.current) {
                        isPauseAllowed.current = true; // Allow our internal pause
                        videoPlayer.current.pause();
                        videoPlayer.current.muted = true;
                        videoPlayer.current = null;
                      }

                      if (closeVideoPipWhenClosedFromFullScreenMode) {
                        onClosePip();
                      } else {
                        setIsFullModalActive(false);
                      }
                    }}
                    className="ins-carousel-close-button"
                  >
                    <XIcon className="ins-carousel-close-icon" />
                  </button>
                </div>
              )}

              {isActive && (video as any)?.b === 2 && (video as any)?.ct ? (
                <div
                  className="ins-reel-pop-player-product-panel"
                  style={{ bottom: "50px" }}
                >
                  <div
                    className="ins-pip-product-panel-item"
                    style={{
                      justifyContent: "center",
                      backgroundColor: "unset",
                      width: "100%",
                      margin: "unset",
                      display: "flex",
                    }}
                  >
                    <button
                      className="ins-custom-cta-button"
                      onClick={() => {
                        if ((video as any)?.ct?.cl) {
                          window.open((video as any).ct.cl, "_blank");
                        }
                      }}
                      title={(video as any)?.ct?.cn}
                    >
                      <span className="ins-custom-cta-text">
                        {(video as any)?.ct?.cn || "Custom Button"}
                      </span>
                    </button>
                  </div>
                </div>
              ) : (
                isActive &&
                video.p &&
                video.p.length > 0 && (
                  <div className="ins-reel-pop-player-product-panel">
                    {(() => {
                      // Get products from current video only (video-specific)
                      let sortedProducts = currentVideo?.p
                        ? [...currentVideo.p]
                        : [];

                      // Sort products - prioritize current product if available
                      if (instasellVideoPopEmbedConfig.currentProductId) {
                        const currentIndex = sortedProducts.findIndex(
                          (product) =>
                            product.pi ===
                            instasellVideoPopEmbedConfig.currentProductId
                        );

                        if (currentIndex !== -1) {
                          const currentProduct = sortedProducts.splice(
                            currentIndex,
                            1
                          )[0];
                          sortedProducts.unshift(currentProduct);
                        }
                      }

                      return sortedProducts.map((product, i) => (
                        <div
                          key={product.pi || i}
                          className="ins-pip-product-panel-item"
                          onClick={(e) => handleShopNow(product.i)}
                        >
                          <div className="ins-pip-product-panel-item-inner">
                            <div
                              className="ins-pip-product-panel-item-thumbnail"
                              style={{
                                backgroundImage: `url(${product.im})`,
                              }}
                            ></div>

                            <div className="ins-pip-product-panel-item-details">
                              <div>
                                <p className="ins-pip-product-panel-item-title">
                                  {product.t?.toLowerCase() ?? ""}
                                </p>
                                <p className="ins-pip-product-panel-item-price">
                                  {(() => {
                                    const basePrice =
                                      product?.cp != null
                                        ? product?.cp?.[country].pr ??
                                          product.pr ??
                                          0
                                        : product.pr || 0;
                                    const { price, currency } = calculatePrice(
                                      basePrice,
                                      product
                                    );
                                    return formatCurrency(price, currency);
                                  })()}

                                  {comparePriceEnabled &&
                                  product.c &&
                                  product.c > product.pr ? (
                                    <span className="ins-product-panel-item-strikeoff-price">
                                      {(() => {
                                        const baseComparePrice =
                                          product?.cp != null
                                            ? product.cp?.[country]?.cs || 0
                                            : product?.c || 0;
                                        const { price, currency } =
                                          calculatePrice(
                                            baseComparePrice,
                                            product
                                          );
                                        return formatCurrency(price, currency);
                                      })()}
                                    </span>
                                  ) : null}
                                  {discountBadgeEnabled &&
                                  product.c &&
                                  product.c > product.pr &&
                                  calculateDiscountPercentage(product) > 0 ? (
                                    <span className="ins-pip-product-panel-item-discount-badge">
                                      Save{" "}
                                      {calculateDiscountPercentage(product)}%
                                    </span>
                                  ) : null}
                                </p>
                              </div>
                            </div>
                          </div>
                          <p className="ins-pip-product-panel-item-buy-now">
                            {getButtonText(product)}
                          </p>
                        </div>
                      ));
                    })()}
                  </div>
                )
              )}
            </div>
          );
        })}

        {/* Product Details Modal - Outside video loop so it only renders once, constrained to active video width */}
        {isFullModalActive && activeProduct && showTaggedVideos && (
          <div
            className={`${
              activeProduct
                ? "ins-pip-product-details-modal-overlay__show"
                : "ins-pip-product-details-modal-overlay__hidden"
            } ${
              isDesktop
                ? "ins-pip-product-details-modal-overlay__is-desktop"
                : "ins-pip-product-details-modal-overlay__is-mobile"
            }`}
            onClick={() => setActiveProduct(null)}
            style={
              isDesktop
                ? {
                    position: "absolute",
                    top: 0,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: "calc(100vh * 9 / 16)",
                    maxWidth: "100vw",
                    height: "100vh",
                    zIndex: 1000,
                  }
                : {
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 1000,
                  }
            }
          >
            <div
              className={`ins-pip-product-details-modal ${
                activeProduct
                  ? "ins-pip-product-details-modal__show"
                  : "ins-pip-product-details-modal__hidden"
              } ${
                isDesktop
                  ? "ins-pip-product-details-modal__is-desktop"
                  : "ins-pip-product-details-modal__is-mobile"
              }`}
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <div
                className={`${
                  activeProduct
                    ? "ins-pip-product-details-modal-close-button__show"
                    : "ins-pip-product-details-modal-close-button__hidden"
                }`}
                onClick={() => setActiveProduct(null)}
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
              <div className="ins-pip-product-details-section">
                {activeProduct && (
                  <div className="ins-pip-product-details-container">
                    <header className="ins-pip-product-details-header">
                      {activeProduct?.product?.im != "" && (
                        <div
                          style={{
                            "background-image": `url(${activeProduct?.product?.im})`,
                          }}
                          className="ins-pip-product-details-image"
                        />
                      )}
                      {displayAllProductImagesEnabled &&
                      fullProductImages.length > 0
                        ? // Use full product images from Shopify API
                          fullProductImages
                            .filter((img) => img !== activeProduct?.product?.im)
                            .map((imageUrl, i) => (
                              <div
                                key={i}
                                style={{
                                  "background-image": `url(${imageUrl})`,
                                }}
                                className="ins-pip-product-details-image"
                              />
                            ))
                        : activeProduct
                        ? // Use variant images from our API
                          (() => {
                            const variantImages = [
                              ...new Set(
                                activeProduct.product.v
                                  .filter((variant) => variant.im.length !== 0)
                                  .map((variant) => variant.im)
                                  .filter(
                                    (img) => img !== activeProduct?.product?.im
                                  )
                              ),
                            ];

                            return variantImages.map((imageUrl, i) => (
                              <div
                                key={i}
                                style={{
                                  "background-image": `url(${imageUrl})`,
                                }}
                                className="ins-pip-product-details-image"
                              />
                            ));
                          })()
                        : null}
                    </header>
                    <div className="ins-pip-product-details-info">
                      <h2 className="ins-pip-product-details-name">
                        {activeProduct?.product?.t?.toLowerCase() ?? ""}
                      </h2>
                      <p className="ins-pip-product-details-price">
                        {(() => {
                          const basePrice =
                            getSelectedVariant()?.cp != null
                              ? getSelectedVariant()?.cp?.[country].pr ??
                                activeProduct.product.pr ??
                                0
                              : getSelectedVariant()?.pr ??
                                activeProduct.product.pr ??
                                0;
                          const { price, currency } = calculatePrice(
                            basePrice,
                            activeProduct.product
                          );
                          return formatCurrency(price, currency);
                        })()}
                        {(() => {
                          const { pr = 0, c } =
                            getSelectedVariant() ?? activeProduct.product;
                          const baseComparePrice = getSelectedVariant()?.cp
                            ? getSelectedVariant()?.cp?.[country]?.cs ?? c
                            : c;
                          if (c !== undefined && c > pr && baseComparePrice) {
                            const { price, currency } = calculatePrice(
                              baseComparePrice,
                              activeProduct.product
                            );
                            return (
                              <span className="ins-pip-product-details-strikeoff-price">
                                {formatCurrency(price, currency)}
                              </span>
                            );
                          }
                          return null;
                        })()}
                        {discountBadgeEnabled &&
                          comparePriceEnabled &&
                          (() => {
                            const variant =
                              getSelectedVariant() ?? activeProduct.product;
                            const { pr = 0, c } = variant;
                            const currentPrice =
                              variant?.cp != null
                                ? variant?.cp?.[country].pr ?? pr
                                : pr;
                            const originalPrice =
                              variant?.cp != null
                                ? variant.cp?.[country]?.cs || 0
                                : c || 0;

                            const discountPercentage =
                              originalPrice > 0 &&
                              currentPrice > 0 &&
                              originalPrice > currentPrice
                                ? Math.round(
                                    ((originalPrice - currentPrice) /
                                      originalPrice) *
                                      100
                                  )
                                : 0;

                            return c !== undefined &&
                              c > pr &&
                              discountPercentage > 0 ? (
                              <span className="ins-pip-product-details-discount-badge">
                                Save {discountPercentage}%
                              </span>
                            ) : null;
                          })()}
                      </p>
                    </div>
                    {activeProduct?.product?.o &&
                    activeProduct?.product?.o.length > 0 ? (
                      <div
                        style={{
                          padding: "0px 20px",
                          marginTop: "10px",
                        }}
                      >
                        {activeProduct?.product?.o.map((option) => (
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
                              className="ins-pip-product-details-variants-button"
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
                                  className={`ins-pip-product-details-variants-item ${getOptionButtonClass(
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
                                    getOptionButtonClass(
                                      option,
                                      value
                                    ).includes("out-of-stock")
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
                    ) : activeProduct?.product?.v.length &&
                      activeProduct?.product?.v.length > 1 ? (
                      <div className="ins-pip-product-details-variants-list">
                        {activeProduct?.product?.v.map((variant) => (
                          <button
                            key={variant.pi}
                            className={`ins-pip-product-details-variants-item ${
                              variant.pi === selectedVariantId
                                ? "ins-pip-product-details-variants-item__active"
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
                    {activeProduct && (
                      <div
                        className="ins-pip-product-details-description-container"
                        dangerouslySetInnerHTML={{
                          __html: sanitizeHTML(activeProduct.product.d),
                        }}
                      />
                    )}
                    <div className="ins-pip-product-details-button-container">
                      {activeProduct?.product?.v && (
                        <button
                          className={`ins-pip-product-details-buy-now-button ${
                            isSelectedVariantOutOfStock()
                              ? "ins-pip-product-details-out-of-stock-button"
                              : ""
                          }`}
                          onClick={handleAddToCart}
                          disabled={
                            addingToCart || isSelectedVariantOutOfStock()
                          }
                          style={
                            isSelectedVariantOutOfStock()
                              ? {
                                  backgroundColor: "#f5f5f5",
                                  color: "#999",
                                  cursor: "not-allowed",
                                }
                              : {}
                          }
                        >
                          {getButtonText(activeProduct.product)}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Mobile Multi-Video Reel Component
  const renderMobileReel = () => {
    if (!showTaggedVideos || !shortVideos || !isFullModalActive) return null;

    const currentVideoData = shortVideos[currentVideoIndex];
    const videoUrl = currentVideoData?.m.find((media) => media.s === "high")?.v;

    return (
      <div className="ins-mobile-video-reel">
        <video
          className="ins-reel-video"
          style={{
            background: "#000000",
          }}
          src={videoUrl}
          autoPlay
          loop
          muted={globalMuteState}
          controls={false}
          playsInline
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onLoadedMetadata={(e) => {
            const player = e.currentTarget;
            player.muted = globalMuteState;
            player
              .play()
              .then(() => setIsPlaying(true))
              .catch((error) => console.log(`%c${error}`, "color: red;"));
          }}
          ref={videoPlayer}
          onClick={handleVideoClick}
        />

        {/* Individual mobile video controls */}
        <div className="ins-mobile-reel-controls">
          <div
            onClick={(e) => {
              e.stopPropagation();
              setGlobalMuteState(!globalMuteState);
              if (videoPlayer.current) {
                videoPlayer.current.muted = !globalMuteState;
              }
            }}
            className="ins-mobile-mute-button"
          >
            {globalMuteState ? (
              <SpeakerXMarkIcon className="ins-mobile-speaker-icon" />
            ) : (
              <SpeakerWaveIcon className="ins-mobile-speaker-icon" />
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (closeVideoPipWhenClosedFromFullScreenMode) {
                onClosePip();
              } else {
                setIsFullModalActive(false);
              }
            }}
            className="ins-mobile-close-button"
          >
            <XIcon className="ins-mobile-close-icon" />
          </button>
        </div>

        {/* Mobile video-specific product panel or custom CTA */}
        {(currentVideoData as any)?.b === 2 && (currentVideoData as any)?.ct ? (
          <div
            className="ins-reel-pop-player-product-panel"
            style={{ bottom: "50px" }}
          >
            <div
              className="ins-pip-product-panel-item"
              style={{
                justifyContent: "center",
                backgroundColor: "unset",
                width: "100%",
                margin: "unset",
                display: "flex",
              }}
            >
              <button
                className="ins-custom-cta-button"
                onClick={() => {
                  if ((currentVideoData as any)?.ct?.cl) {
                    window.open((currentVideoData as any).ct.cl, "_blank");
                  }
                }}
                title={(currentVideoData as any)?.ct?.cn}
              >
                <span className="ins-custom-cta-text">
                  {(currentVideoData as any)?.ct?.cn || "Custom Button"}
                </span>
              </button>
            </div>
          </div>
        ) : (
          currentVideoData?.p &&
          currentVideoData.p.length > 0 && (
            <div className="ins-reel-pop-player-product-panel">
              {(() => {
                // Get products from current video only (video-specific)
                let sortedProducts = currentVideo?.p ? [...currentVideo.p] : [];

                // Sort products - prioritize current product if available
                if (instasellVideoPopEmbedConfig.currentProductId) {
                  const currentIndex = sortedProducts.findIndex(
                    (product) =>
                      product.pi ===
                      instasellVideoPopEmbedConfig.currentProductId
                  );

                  if (currentIndex !== -1) {
                    const currentProduct = sortedProducts.splice(
                      currentIndex,
                      1
                    )[0];
                    sortedProducts.unshift(currentProduct);
                  }
                }

                return sortedProducts.map((product, i) => (
                  <div
                    key={product.pi || i}
                    className="ins-pip-product-panel-item"
                    onClick={(e) => handleShopNow(product.i)}
                  >
                    <div className="ins-pip-product-panel-item-inner">
                      <div
                        className="ins-pip-product-panel-item-thumbnail"
                        style={{
                          backgroundImage: `url(${product.im})`,
                        }}
                      ></div>

                      <div className="ins-pip-product-panel-item-details">
                        <div>
                          <p className="ins-pip-product-panel-item-title">
                            {product.t}
                          </p>
                          <p className="ins-pip-product-panel-item-price">
                            {(() => {
                              const basePrice =
                                product?.cp != null
                                  ? product?.cp?.[country].pr ?? product.pr ?? 0
                                  : product.pr || 0;
                              const { price, currency } = calculatePrice(
                                basePrice,
                                product
                              );
                              return formatCurrency(price, currency);
                            })()}
                            {product.c && product.c > product.pr ? (
                              <span className="ins-pip-product-panel-item-strikeoff-price">
                                {(() => {
                                  const baseComparePrice =
                                    product?.cp != null
                                      ? product.cp?.[country]?.cs || 0
                                      : product?.c || 0;
                                  const { price, currency } = calculatePrice(
                                    baseComparePrice,
                                    product
                                  );
                                  return formatCurrency(price, currency);
                                })()}
                              </span>
                            ) : null}
                            {discountBadgeEnabled &&
                            product.c &&
                            product.c > product.pr &&
                            calculateDiscountPercentage(product) > 0 ? (
                              <span className="ins-pip-product-panel-item-discount-badge">
                                Save {calculateDiscountPercentage(product)}%
                              </span>
                            ) : null}
                          </p>
                        </div>
                      </div>
                    </div>
                    <p className="ins-pip-product-panel-item-buy-now">
                      {getButtonText(product)}
                    </p>
                  </div>
                ));
              })()}
            </div>
          )
        )}
      </div>
    );
  };

  const renderSingleVideo = () => {
    // Story mode: Apply inline styles directly to transform into circular 80px display
    // These inline styles override any external CSS and ensure proper story mode appearance
    return (
      <div
        className="ins-video-container-wrapper"
        style={
          storyMode
            ? {
                width: "80px",
                height: "80px",
                borderRadius: "50%",
                overflow: "hidden",
                position: "relative",
              }
            : {}
        }
      >
        {!isVideoLoaded && thumbnail && (
          <div
            className="ins-video-thumbnail-overlay"
            style={{
              backgroundImage: `url(${thumbnail})`,
              ...(storyMode && {
                borderRadius: "50%",
                overflow: "hidden",
                width: "100%",
                height: "100%",
              }),
            }}
          >
            {/* Optional loading spinner */}
            <div className="ins-video-loading-spinner">
              <div className="ins-spinner"></div>
            </div>
          </div>
        )}

        <video
          className={classNames({
            "ins-reel-pop-player-modal-reel-video__in-view": true,
            "ins-reel-pop-player-modal-reel-video__is-desktop": isDesktop,
            "ins-video-hidden": !isVideoLoaded, // Hide video until loaded
          })}
          style={
            storyMode
              ? {
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  borderRadius: "50%",
                  display: "block",
                  position: "absolute",
                  top: "0",
                  left: "0",
                }
              : {}
          }
          autoPlay
          src={
            isProductDetailsModalOpen && activeProduct?.videoUrl
              ? activeProduct.videoUrl
              : !isFullModalActive && !showTaggedVideos
              ? floatingVideoUrl || videoUrl
              : videoUrl
          }
          ref={videoPlayer}
          onLoadedMetadata={(e) => {
            const player = e.currentTarget;
            if (
              player.src ===
              (isProductDetailsModalOpen && activeProduct?.videoUrl
                ? activeProduct.videoUrl
                : videoUrl)
            ) {
              setIsVideoLoaded(true);
              player
                .play()
                .then(() => setIsPlaying(true))
                .catch((error) => console.log(`%c${error}`, "color: red;"));
            }
          }}
          onLoadedData={() => {
            setIsVideoLoaded(true);
          }}
          onCanPlay={() => {
            setIsVideoLoaded(true);
          }}
          loop
          preload="metadata"
          muted={isMuted}
          controls={false}
          playsInline
          onClick={handleVideoClick}
          onPause={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
          poster={thumbnail}
        />
      </div>
    );
  };

  if (!currentVideo || !isPipActive) return null;

  return (
    <div
      ref={reelPlayerModalRef}
      className={classNames({
        "ins-reel-pop-player-modal-overlay": true,
        "ins-reel-pop-player-modal-overlay__is-pip-active": !isFullModalActive,
        "ins-reel-pop-player-modal-overlay__is-full-modal": isFullModalActive,
        "ins-reel-pop-player-modal-overlay__is-multi-video":
          isFullModalActive && showTaggedVideos,
        "ins-reel-pop-player-modal-overlay__is-story-mode": storyMode,
        "ins-reel-pop-player-modal-overlay__is-dragging": isPipDragging,
      })}
      style={{
        ...(storyMode
          ? {
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              overflow: "hidden",
              position: "fixed",
              bottom: "6em",
              right: "1em",
              zIndex: 100,
              transform: `translate3d(${pipPosition.x}px, ${pipPosition.y}px, 0)`,
              cursor: isPipDragging ? "grabbing" : "grab",
              touchAction: "none",
              transition: "none",
              willChange: isPipDragging ? "transform" : "auto",
            }
          : !isFullModalActive
          ? {
              transform: `translate3d(${pipPosition.x}px, ${pipPosition.y}px, 0)`,
              cursor: isPipDragging ? "grabbing" : "grab",
              touchAction: "none",
              transition: "none",
              willChange: isPipDragging ? "transform" : "auto",
            }
          : {}),
      }}
      onPointerDown={!isFullModalActive ? handlePointerDown : undefined}
      onPointerMove={!isFullModalActive ? handlePointerMove : undefined}
      onPointerUp={!isFullModalActive ? handlePointerUp : undefined}
      onClick={handleClick}
      onMouseDown={!isFullModalActive ? handleMouseDown : undefined}
    >
      <div
        ref={modalContentRef}
        className={classNames({
          "ins-reel-pop-player-modal-reel": true,
          "ins-reel-pop-player-modal-reel__is-active": true,
          "ins-reel-pop-player-modal-reel__is-pip-active": !isFullModalActive,
          "ins-reel-pop-player-modal-reel__is-full-modal": isFullModalActive,
          "ins-reel-pop-player-modal-reel__is-desktop": isDesktop,
          "ins-reel-pop-player-modal-reel__is-multi-video":
            isFullModalActive && showTaggedVideos,
          "ins-reel-pop-player-modal-reel__is-story-mode": storyMode,
        })}
        style={
          storyMode
            ? {
                width: "100%",
                height: "100%",
                borderRadius: "50%",
                overflow: "hidden",
                position: "relative",
              }
            : !isFullModalActive
            ? {
                position: "relative",
              }
            : {}
        }
      >
        {/* Render appropriate video component based on mode */}
        {isFullModalActive && showTaggedVideos
          ? isDesktop
            ? renderDesktopCarousel()
            : renderMobileReel()
          : renderSingleVideo()}

        {/* Controls - only show for single video or PIP mode, hide in story mode */}
        {(!isFullModalActive || !showTaggedVideos) &&
          isVideoLoaded &&
          !storyMode && (
            <div className="ins-reel-pop-modal-player-pip-top-controls">
              {isFullModalActive && (
                <div
                  onClick={handleMuteToggle}
                  className="ins-reel-pop-modal-player-mute-button"
                >
                  {isMuted ? (
                    <SpeakerXMarkIcon className="ins-reel-pop-modal-player-speaker-icon" />
                  ) : (
                    <SpeakerWaveIcon className="ins-reel-pop-modal-player-speaker-icon" />
                  )}
                </div>
              )}
              <button
                onClick={() => {
                  if (isFullModalActive) {
                    if (closeVideoPipWhenClosedFromFullScreenMode) {
                      onClosePip();
                    } else {
                      setIsFullModalActive(false);
                    }
                  } else {
                    onClosePip();
                  }
                }}
                className="ins-reel-pop-modal-player-pip-close-button"
              >
                <XIcon className="ins-reel-pop-modal-player-pip-close-button-icon" />
              </button>
            </div>
          )}

        {/* Play/Pause controls - hidden in story mode */}
        {!isFullModalActive && isVideoLoaded && !storyMode && (
          <button
            className="ins-reel-pop-modal-player-pip-play-controls"
            onClick={handlePlayPause}
          >
            {isPlaying ? (
              <PauseIcon className="ins-reel-pop-modal-player-pause-icon" />
            ) : (
              <PlaySolidIcon className="ins-reel-pop-modal-player-play-icon" />
            )}
          </button>
        )}

        {/* Product Details Modal (existing logic) */}
        {isFullModalActive &&
          activeProduct &&
          !showTaggedVideos &&
          !storyMode && (
            <>
              <div
                className={`${
                  activeProduct
                    ? "ins-pip-product-details-modal-overlay__show"
                    : "ins-pip-product-details-modal-overlay__hidden"
                } ${
                  isDesktop
                    ? "ins-pip-product-details-modal-overlay__is-desktop"
                    : "ins-pip-product-details-modal-overlay__is-mobile"
                }`}
                onClick={() => setActiveProduct(null)}
              >
                <div
                  className={`ins-pip-product-details-modal ${
                    activeProduct
                      ? "ins-pip-product-details-modal__show"
                      : "ins-pip-product-details-modal__hidden"
                  } ${
                    isDesktop
                      ? "ins-pip-product-details-modal__is-desktop"
                      : "ins-pip-product-details-modal__is-mobile"
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <div
                    className={`${
                      activeProduct
                        ? "ins-pip-product-details-modal-close-button__show"
                        : "ins-pip-product-details-modal-close-button__hidden"
                    }`}
                    onClick={() => setActiveProduct(null)}
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
                  <div className="ins-pip-product-details-section">
                    {activeProduct && (
                      <div className="ins-pip-product-details-container">
                        <header className="ins-pip-product-details-header">
                          {activeProduct?.product?.im != "" && (
                            <div
                              style={{
                                "background-image": `url(${activeProduct?.product?.im})`,
                              }}
                              className="ins-pip-product-details-image"
                            />
                          )}
                          {displayAllProductImagesEnabled &&
                          fullProductImages.length > 0
                            ? // Use full product images from Shopify API
                              fullProductImages
                                .filter(
                                  (img) => img !== activeProduct?.product?.im
                                )
                                .map((imageUrl, i) => (
                                  <div
                                    key={i}
                                    style={{
                                      "background-image": `url(${imageUrl})`,
                                    }}
                                    className="ins-pip-product-details-image"
                                  />
                                ))
                            : activeProduct
                            ? // Use variant images from our API
                              (() => {
                                const variantImages = [
                                  ...new Set(
                                    activeProduct.product.v
                                      .filter(
                                        (variant) => variant.im.length !== 0
                                      )
                                      .map((variant) => variant.im)
                                      .filter(
                                        (img) =>
                                          img !== activeProduct?.product?.im
                                      )
                                  ),
                                ];

                                return variantImages.map((imageUrl, i) => (
                                  <div
                                    key={i}
                                    style={{
                                      "background-image": `url(${imageUrl})`,
                                    }}
                                    className="ins-pip-product-details-image"
                                  />
                                ));
                              })()
                            : null}
                        </header>
                        <div className="ins-pip-product-details-info">
                          <h2 className="ins-pip-product-details-name">
                            {activeProduct?.product?.t}
                          </h2>
                          <p className="ins-pip-product-details-price">
                            {(() => {
                              const basePrice =
                                getSelectedVariant()?.cp != null
                                  ? getSelectedVariant()?.cp?.[country].pr ??
                                    activeProduct.product.pr ??
                                    0
                                  : getSelectedVariant()?.pr ??
                                    activeProduct.product.pr ??
                                    0;
                              const { price, currency } = calculatePrice(
                                basePrice,
                                activeProduct.product
                              );
                              return formatCurrency(price, currency);
                            })()}

                            {comparePriceEnabled &&
                              (() => {
                                const { pr = 0, c } =
                                  getSelectedVariant() ?? activeProduct.product;
                                const baseComparePrice = getSelectedVariant()
                                  ?.cp
                                  ? getSelectedVariant()?.cp?.[country].cs || c
                                  : c;
                                if (
                                  c !== undefined &&
                                  c > pr &&
                                  baseComparePrice
                                ) {
                                  const { price, currency } = calculatePrice(
                                    baseComparePrice,
                                    activeProduct.product
                                  );
                                  return (
                                    <span className="ins-pip-product-details-strikeoff-price">
                                      {formatCurrency(price, currency)}
                                    </span>
                                  );
                                }
                                return null;
                              })()}
                            {discountBadgeEnabled &&
                              comparePriceEnabled &&
                              (() => {
                                const variant =
                                  getSelectedVariant() ?? activeProduct.product;
                                const { pr = 0, c } = variant;
                                const currentPrice =
                                  variant?.cp != null
                                    ? variant?.cp?.[country].pr ?? pr
                                    : pr;
                                const originalPrice =
                                  variant?.cp != null
                                    ? variant.cp?.[country]?.cs || 0
                                    : c || 0;

                                const discountPercentage =
                                  originalPrice > 0 &&
                                  currentPrice > 0 &&
                                  originalPrice > currentPrice
                                    ? Math.round(
                                        ((originalPrice - currentPrice) /
                                          originalPrice) *
                                          100
                                      )
                                    : 0;

                                return c !== undefined &&
                                  c > pr &&
                                  discountPercentage > 0 ? (
                                  <span className="ins-pip-product-details-discount-badge">
                                    Save {discountPercentage}%
                                  </span>
                                ) : null;
                              })()}
                          </p>
                        </div>
                        {activeProduct?.product?.o &&
                        activeProduct?.product?.o.length > 0 ? (
                          <div
                            style={{
                              padding: "0px 20px",
                              marginTop: "10px",
                            }}
                          >
                            {activeProduct?.product?.o.map((option) => (
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
                                  className="ins-pip-product-details-variants-button"
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
                                      className={`ins-pip-product-details-variants-item ${getOptionButtonClass(
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
                                        getOptionButtonClass(
                                          option,
                                          value
                                        ).includes("out-of-stock")
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
                        ) : activeProduct?.product?.v.length &&
                          activeProduct?.product?.v.length > 1 ? (
                          <div className="ins-pip-product-details-variants-list">
                            {activeProduct?.product?.v.map((variant) => (
                              <button
                                key={variant.pi}
                                className={`ins-pip-product-details-variants-item ${
                                  variant.pi === selectedVariantId
                                    ? "ins-pip-product-details-variants-item__active"
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
                                    if (
                                      variant.ip === "DENY" &&
                                      variant.s > 0
                                    ) {
                                      return false;
                                    }

                                    // If policy is DENY and stock is 0 or negative, use availableForSale
                                    if (
                                      variant.ip === "DENY" &&
                                      variant.s <= 0
                                    ) {
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
                        {activeProduct && (
                          <div
                            className="ins-pip-product-details-description-container"
                            dangerouslySetInnerHTML={{
                              __html: activeProduct.product.d,
                            }}
                          />
                        )}
                        <div className="ins-pip-product-details-button-container">
                          {activeProduct?.product?.v && (
                            <button
                              className={`ins-pip-product-details-buy-now-button ${
                                isSelectedVariantOutOfStock()
                                  ? "ins-pip-product-details-out-of-stock-button"
                                  : ""
                              }`}
                              onClick={handleAddToCart}
                              disabled={
                                addingToCart || isSelectedVariantOutOfStock()
                              }
                              style={
                                isSelectedVariantOutOfStock()
                                  ? {
                                      backgroundColor: "#f5f5f5",
                                      color: "#999",
                                      cursor: "not-allowed",
                                    }
                                  : {}
                              }
                            >
                              {getButtonText(activeProduct.product)}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

        {/* Product Panel or Custom CTA - Only for single video mode */}
        {isFullModalActive &&
          !showTaggedVideos &&
          (currentVideo as any)?.b === 2 &&
          (currentVideo as any)?.ct && (
            <div
              className="ins-reel-pop-player-product-panel"
              style={{ bottom: "50px" }}
            >
              <div
                className="ins-pip-product-panel-item"
                style={{
                  justifyContent: "center",
                  backgroundColor: "unset",
                  width: "100%",
                  margin: "unset",
                  display: "flex",
                }}
              >
                <button
                  className="ins-custom-cta-button"
                  onClick={() => {
                    if ((currentVideo as any)?.ct?.cl) {
                      window.open((currentVideo as any).ct.cl, "_blank");
                    }
                  }}
                  title={(currentVideo as any)?.ct?.cn}
                >
                  <span className="ins-custom-cta-text">
                    {(currentVideo as any)?.ct?.cn || "Custom Button"}
                  </span>
                </button>
              </div>
            </div>
          )}
        {isFullModalActive &&
          !showTaggedVideos &&
          !((currentVideo as any)?.b === 2 && (currentVideo as any)?.ct) && (
            <div className="ins-reel-pop-player-product-panel">
              {(() => {
                // Get products from current video only (video-specific)
                let sortedProducts = currentVideo?.p ? [...currentVideo.p] : [];

                // Sort products - prioritize current product if available
                if (instasellVideoPopEmbedConfig.currentProductId) {
                  const currentIndex = sortedProducts.findIndex(
                    (product) =>
                      product.pi ===
                      instasellVideoPopEmbedConfig.currentProductId
                  );

                  if (currentIndex !== -1) {
                    const currentProduct = sortedProducts.splice(
                      currentIndex,
                      1
                    )[0];
                    sortedProducts.unshift(currentProduct);
                  }
                }

                return sortedProducts.map((product, i) => (
                  <div
                    key={product.pi || i}
                    className="ins-pip-product-panel-item"
                    onClick={(e) => handleShopNow(product.i)}
                  >
                    <div className="ins-pip-product-panel-item-inner">
                      <div
                        className="ins-pip-product-panel-item-thumbnail"
                        style={{
                          backgroundImage: `url(${product.im})`,
                        }}
                      ></div>

                      <div className="ins-pip-product-panel-item-details">
                        <div>
                          <p className="ins-pip-product-panel-item-title">
                            {product.t?.toLowerCase() ?? ""}
                          </p>
                          <p className="ins-pip-product-panel-item-price">
                            {(() => {
                              const basePrice =
                                product?.cp != null
                                  ? product?.cp?.[country].pr ?? product.pr ?? 0
                                  : product.pr || 0;
                              const { price, currency } = calculatePrice(
                                basePrice,
                                product
                              );
                              return formatCurrency(price, currency);
                            })()}
                            {product.c && product.c > product.pr ? (
                              <span className="ins-pip-product-panel-item-strikeoff-price">
                                {(() => {
                                  const baseComparePrice =
                                    product?.cp != null
                                      ? product.cp?.[country]?.cs || 0
                                      : product?.c || 0;
                                  const { price, currency } = calculatePrice(
                                    baseComparePrice,
                                    product
                                  );
                                  return formatCurrency(price, currency);
                                })()}
                              </span>
                            ) : null}
                            {discountBadgeEnabled &&
                            product.c &&
                            product.c > product.pr &&
                            calculateDiscountPercentage(product) > 0 ? (
                              <span className="ins-pip-product-panel-item-discount-badge">
                                Save {calculateDiscountPercentage(product)}%
                              </span>
                            ) : null}
                          </p>
                        </div>
                      </div>
                    </div>
                    <p className="ins-pip-product-panel-item-buy-now">
                      {getButtonText(product)}
                    </p>
                  </div>
                ));
              })()}
            </div>
          )}
      </div>
    </div>
  );
};

export default VideoPIP;
