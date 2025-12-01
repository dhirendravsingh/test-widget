import React, { useEffect, useRef, useState } from "react";
import { useShortVideosModalContext } from "../../context/ShortVideosModalContext";
import ShoppableReelPreviewCard from "./shoppable-reel-preview-card";
import { ChevronDownIcon } from "../icons";
import { useApi } from "../../lib/api";
import { useGAEvents } from "../../context/GoogleAnalytics";
import { instasellLiveEmbedConfig } from "../..";
import { useCleverTapEvents } from "../../context/ClevertapAnalytics";
import ShoppableReelPreviewCardBase from "./shoppable-reel-preview-card";
import { useMetaEvents } from "../../context/MetaEventsContext";

const ShoppableReelsFeed = ({ cardDesign = "three" }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const feedWrapperRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const {
    shortVideos,
    setActiveVideoId,
    isDesktop,
    setIsPipActive,
    hidePoweredBy,
    noOfVideosInViewPort,
    googleAnalyticsEnabled,
    useGtmForAnalytics,
    clevertapAnalyticsEnabled,
    shortVideoSessionToken,
    carouselTitle,
    showOldVideoPop,
    metaRetargetingEnabled,
    frameDesign,
  } = useShortVideosModalContext();
  const api = useApi();
  const gaEvents = useGAEvents();
  const fbEvents = useMetaEvents();
  const caEvents = useCleverTapEvents();
  const [showPreviousButton, setShowPreviousButton] = useState(false);
  const [showNextButton, setShowNextButton] = useState(false);

  const videosInViewPort = Math.min(Math.max(noOfVideosInViewPort || 6, 4), 7);

  const pageType = instasellLiveEmbedConfig.getPageType?.();
  const pageId =
    pageType == "home"
      ? ""
      : pageType == "product"
      ? instasellLiveEmbedConfig.currentProductId ?? ""
      : instasellLiveEmbedConfig.currentCollectionId ?? "";

  // Update container width and check scroll buttons on mount and resize
  useEffect(() => {
    const updateWidthAndButtons = () => {
      if (feedWrapperRef.current) {
        setContainerWidth(feedWrapperRef.current.offsetWidth);
        // Force a check for scroll buttons after width update
        setTimeout(scrollHandler, 0);
      }
    };

    updateWidthAndButtons();
    window.addEventListener("resize", updateWidthAndButtons);
    return () => window.removeEventListener("resize", updateWidthAndButtons);
  }, []);

  const scrollHandler = () => {
    if (!scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const scrollLeft = container.scrollLeft;
    const scrollWidth = container.scrollWidth;
    const clientWidth = container.clientWidth;

    // Show previous button if we're not at the start
    setShowPreviousButton(scrollLeft > 0);

    // Show next button if there's more content to scroll to
    const remainingScroll = Math.ceil(scrollWidth - (scrollLeft + clientWidth));
    setShowNextButton(remainingScroll > 1); // Using 1px threshold instead of 10px
  };

  // Set up scroll event listener
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    scrollHandler(); // Initial check
    container.addEventListener("scroll", scrollHandler);

    // Additional check after a brief delay to ensure content is properly laid out
    setTimeout(scrollHandler, 100);

    return () => {
      container.removeEventListener("scroll", scrollHandler);
    };
  }, []);

  // Recheck buttons when videos change
  useEffect(() => {
    setTimeout(scrollHandler, 100);
  }, [shortVideos.length]);

  const moveForward = () => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const scrollAmount = container.clientWidth * 0.8; // Scroll 80% of container width
    container.scrollBy({
      left: scrollAmount,
      behavior: "smooth",
    });
  };

  const moveBackward = () => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const scrollAmount = container.clientWidth * 0.8; // Scroll 80% of container width
    container.scrollBy({
      left: -scrollAmount,
      behavior: "smooth",
    });
  };

  const calculateOptimalVideosInView = () => {
    if (!containerWidth) return videosInViewPort;

    const baseCardWidth = 15.5 * 16;
    const totalGapsAndMargins = (0.8 * 2 + 0.3 * 2) * 16;

    // Add frame width if frame design is not NONE (20px left + 20px right = 40px)
    const frameWidth = frameDesign !== "NONE" ? 40 : 0;
    // Add extra gap between cards when frame is enabled (10px)
    const extraGap = frameDesign !== "NONE" ? 10 : 0;

    const totalCardWidth =
      baseCardWidth + totalGapsAndMargins + frameWidth + extraGap;

    const possibleFit = Math.floor(containerWidth / totalCardWidth);

    return Math.min(
      Math.max(Math.min(possibleFit, noOfVideosInViewPort || 6), 4),
      7
    );
  };

  const getTotalWidth = () => {
    const optimal = calculateOptimalVideosInView();
    const cardWidth = 15.5;
    const gapWidth = 0.8;
    const marginWidth = 0.3;

    // Add frame width if frame design is not NONE (20px left + 20px right = 40px = 2.5em)
    const frameWidth = frameDesign !== "NONE" ? 2.5 : 0;
    // Add extra gap between cards when frame is enabled (10px = 0.625em)
    const extraGap = frameDesign !== "NONE" ? 0.625 : 0;

    const totalCardWidth =
      cardWidth + gapWidth * 2 + marginWidth * 2 + frameWidth + extraGap;

    // If we have fewer videos than optimal view, use actual video count
    const videosToShow = Math.min(optimal, shortVideos.length);
    return `${totalCardWidth * videosToShow}em`;
  };

  const shouldCenterAlign = () => {
    const isFeedWiderThanContainer = containerWidth >= 500;
    if (containerWidth <= 600 && shortVideos.length == 1) {
      return true;
    }
    const totalVideosWidth =
      shortVideos.length * (15.5 + 0.8 * 2 + 0.3 * 2) * 16;
    const hasEnoughVideosToScroll = totalVideosWidth > containerWidth;
    if (hasEnoughVideosToScroll) {
      return false;
    }

    return isDesktop && isFeedWiderThanContainer;
  };

  const handleActiveVideoId = async (videoId: string, videoUrl: string) => {
    try {
      await api
        .shortVideosBoron({
          eventType: "shortVideoClick",
          shortVideoView: {
            shortVideoId: videoId,
          },
          source: "carousel",
          pageType,
          pageId,
        })
        .then(() => {
          sessionStorage.setItem("sessionTime", Date.now().toString());
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
        });

      if (googleAnalyticsEnabled) {
        gaEvents.trackClick(
          "video-carousel",
          instasellLiveEmbedConfig.pageType,
          videoUrl,
          useGtmForAnalytics
        );
      }
      if (clevertapAnalyticsEnabled) {
        caEvents.trackClick(
          "video-carousel",
          instasellLiveEmbedConfig.pageType,
          videoUrl
        );
      }
      if (metaRetargetingEnabled) {
        fbEvents.trackClick(
          "video-carousel",
          instasellLiveEmbedConfig.pageType,
          videoUrl
        );
      }
    } catch (error) {
      console.log(`%c${error}`, "color: red;");
    }
  };

  return (
    <div
      ref={feedWrapperRef}
      className="ins-shoppable-video-feed-wrapper"
      style={{
        "--cards-in-view": videosInViewPort,
      }}
    >
      {carouselTitle != "" && (
        <div className="ins-shoppable-video-carousel-title">
          {carouselTitle}
        </div>
      )}
      {showPreviousButton && (
        <button
          className="ins-shoppable-video-feed-nav-button ins-shoppable-video-feed-nav-prev"
          onClick={moveBackward}
        >
          <ChevronDownIcon className="ins-shoppable-video-feed-nav-button-icon" />
        </button>
      )}

      {showNextButton && (
        <button
          className="ins-shoppable-video-feed-nav-button ins-shoppable-video-feed-nav-next"
          onClick={moveForward}
        >
          <ChevronDownIcon className="ins-shoppable-video-feed-nav-button-icon" />
        </button>
      )}

      <div className="videos-preview">
        <div
          className="ins-shoppable-video-feed"
          style={{
            justifyContent: shouldCenterAlign() ? "center" : "start",
            width: "100%",
            overflowX: "auto",
            gap: frameDesign !== "NONE" ? "10px" : undefined,
            "--card-video-size": containerWidth <= 600 ? "14em" : "16em",
            "--card-product-image-size":
              containerWidth <= 600 ? "60px" : "70px",
            "--card-product-title-size":
              containerWidth <= 600 ? "14px" : "15px",
            "--card-product-price-size":
              containerWidth <= 600 ? "12px" : "13px",
          }}
          ref={scrollContainerRef}
        >
          {shortVideos.map((video) => (
            <ShoppableReelPreviewCardBase
              key={video.i}
              video={video}
              setCurrentItemActive={() => {
                setIsPipActive(false);
                setActiveVideoId(video.i);
                handleActiveVideoId(video.i, video.m[0].v);
              }}
              design={cardDesign as "one" | "two" | "three" | "four" | "custom"}
            />
          ))}
        </div>

        {!hidePoweredBy && shortVideos.length > 0 && (
          <a
            style={{ padding: "0 0 3rem 0" }}
            className="ins-shoppable-video-powered-by-text"
            href="https://apps.shopify.com/postship-survey?utm_source=instavid_merchants"
            target="_blank"
            rel="noopener noreferrer"
          >
            Shoppable Videos by Instavid
          </a>
        )}
      </div>
    </div>
  );
};

export default ShoppableReelsFeed;
