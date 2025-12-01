import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { classNames } from "../../lib/utils";
import { useApi } from "../../lib/api";
import { useShortVideosModalContext } from "../../context/ShortVideosModalContext";
import Reel from "../VideoModalReel";
import { useVideoViews } from "../../context/useVideoViews";
import { useGAEvents } from "../../context/GoogleAnalytics";
import { instasellLiveEmbedConfig } from "../..";
import { ChevronDownIcon } from "../icons";
import { useCleverTapEvents } from "../../context/ClevertapAnalytics";
import { useMetaEvents } from "../../context/MetaEventsContext";

export const VideoModal = ({}: {}) => {
  const api = useApi();
  const {
    shortVideos,
    activeVideoId,
    setActiveVideoId,
    setIsProductDetailsModalOpen,
    isPipActive,
    setIsPipActive,
    showOldVideoPop,
    isProductDetailsModalOpen,
    googleAnalyticsEnabled,
    useGtmForAnalytics,
    clevertapAnalyticsEnabled,
    canRegisterClickEvent,
    shortVideoSessionToken,
    metaRetargetingEnabled,
    videoPlayerView,
  } = useShortVideosModalContext();
  const isDesktop = window.innerWidth > 600;
  const modalContentRef = useRef<HTMLDivElement | null>(null as never);
  const activeVideo = shortVideos.find((video) => video.i === activeVideoId);
  const reelPlayerModalRef = useRef<HTMLDivElement>(null as never);

  const pageType = instasellLiveEmbedConfig.getPageType?.();
  const pageId =
    pageType == "home"
      ? ""
      : pageType == "product"
      ? instasellLiveEmbedConfig.currentProductId ?? ""
      : instasellLiveEmbedConfig.currentCollectionId ?? "";

  const { trackView } = useVideoViews();
  const [globalMuted, setGlobalMuted] = useState(false);
  const gaEvents = useGAEvents();
  const caEvents = useCleverTapEvents();
  const fbEvents = useMetaEvents();
  const hasTrackedClick = useRef(false);
  const isTrackingInProgress = useRef(false);

  const activeIndex = shortVideos.findIndex((v) => v.i === activeVideoId);

  // Handle back button on mobile devices
  useEffect(() => {
    if (!activeVideoId || isPipActive || isDesktop) return;

    // Track clicks to detect programmatic history navigation
    let lastClickTime = 0;
    let lastClickTarget: EventTarget | null = null;

    const handleClick = (e: MouseEvent | TouchEvent) => {
      lastClickTime = Date.now();
      lastClickTarget = e.target;
    };

    // Add click/touch listeners on document to detect ANY clicks
    document.addEventListener("click", handleClick, true);
    document.addEventListener("touchstart", handleClick, true);

    const handlePopState = (event: PopStateEvent) => {
      const timeSinceClick = Date.now() - lastClickTime;

      // STRICT CHECK: If popstate happens within 300ms of a click/touch,
      // it's likely triggered by a button/element, NOT the back button
      if (timeSinceClick < 300 && lastClickTarget) {
        // Check if the click was NOT on our modal
        const modalElement = modalContentRef.current;
        if (modalElement && !modalElement.contains(lastClickTarget as Node)) {
          // Click was outside our modal and popstate happened quickly after
          // This is from a website button, ignore it
          return;
        }
      }

      // Prevent default back navigation
      event.preventDefault();
      event.stopPropagation();

      // Close the modal instead
      if (showOldVideoPop) {
        setIsPipActive(true);
      } else {
        setActiveVideoId(null);
        setIsPipActive(false);
      }

      // Push a new state to prevent actual navigation
      window.history.pushState(null, "", window.location.href);
    };

    // Push current state to history stack
    window.history.pushState(null, "", window.location.href);

    // Add event listener for back button
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("touchstart", handleClick, true);
    };
  }, [activeVideoId, isPipActive, isDesktop, showOldVideoPop]);

  useEffect(() => {
    if (!activeVideoId || isPipActive) return;

    // Robust background scroll prevention (same as video-pop.tsx)
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
  }, [activeVideoId, isPipActive]);

  const handleModalClose = () => {
    setActiveVideoId(null);
    setIsProductDetailsModalOpen(false);
  };

  const handleClick = (e: MouseEvent) => {
    if (!modalContentRef.current?.contains(e.target as HTMLElement)) {
      setIsProductDetailsModalOpen(false);
      if (showOldVideoPop) {
        setIsPipActive(true);
        return;
      }
      setActiveVideoId(null);
      setIsPipActive(false);
    }
  };

  const handleActiveVideoId = useCallback(
    async (videoId: string) => {
      // Return early if already tracked or tracking is in progress
      if (hasTrackedClick.current || isTrackingInProgress.current) {
        return;
      }

      const video = shortVideos.find((video) => video.i === videoId);
      if (!video || !videoId) return;

      try {
        isTrackingInProgress.current = true; // Set flag before starting API call

        await api.shortVideosBoron({
          eventType: "shortVideoClick",
          shortVideoView: {
            shortVideoId: videoId,
          },
          source: "carousel",
          pageType,
          pageId,
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

        hasTrackedClick.current = true; // Only set after successful API call

        if (googleAnalyticsEnabled) {
          gaEvents.trackClick(
            "video-carousel",
            instasellLiveEmbedConfig.pageType,
            video.m[0].v ?? "",
            useGtmForAnalytics
          );
        }
        if (clevertapAnalyticsEnabled) {
          caEvents.trackClick(
            "video-carousel",
            instasellLiveEmbedConfig.pageType,
            video.m[0].v ?? ""
          );
        }
        if (metaRetargetingEnabled) {
          fbEvents.trackClick(
            "video-carousel",
            instasellLiveEmbedConfig.pageType,
            video.m[0].v ?? ""
          );
        }
      } catch (error) {
        console.log(`%c${error}`, "color: red;");
      } finally {
        isTrackingInProgress.current = false; // Reset flag regardless of success/failure
        sessionStorage.setItem("sessionTime", Date.now().toString());
      }
    },
    [
      shortVideos,
      googleAnalyticsEnabled,
      clevertapAnalyticsEnabled,
      shortVideoSessionToken,
    ]
  );

  const onClosePip = () => {
    setIsPipActive(false);
    if (!canRegisterClickEvent && activeVideoId) {
      handleActiveVideoId(activeVideoId);
    }

    if (reelPlayerModalRef.current) {
      reelPlayerModalRef.current.style.bottom = "";
      reelPlayerModalRef.current.style.right = "";
      reelPlayerModalRef.current.style.top = "";
      reelPlayerModalRef.current.style.left = "";
    }
  };

  const handleVideoNavigation = (videoId: string | null) => {
    if (isProductDetailsModalOpen) {
      setIsProductDetailsModalOpen(false);
    }
    // Then change the video
    setActiveVideoId(videoId);
  };

  useEffect(() => {
    if (isPipActive) {
      let x = 0;
      let y = 0;
      let disableClick = false;

      // Handle the mousedown event
      // that's triggered when user drags the element
      const mouseDownHandler = function (e: MouseEvent) {
        // Get the current mouse position
        x = e.clientX;
        y = e.clientY;
        disableClick = false;

        // Attach the listeners to `document`
        document.addEventListener("mousemove", mouseMoveHandler);
        document.addEventListener("mouseup", mouseUpHandler);
      };
      const mouseMoveHandler = function (e: MouseEvent) {
        // How far the mouse has been moved
        const dx = e.clientX - x;
        const dy = e.clientY - y;

        const reelPlayerModal = reelPlayerModalRef.current;
        // Set the position of element
        reelPlayerModal.style.top = `${Math.min(
          window.innerHeight - reelPlayerModal.offsetHeight,
          Math.max(0, reelPlayerModal.offsetTop + dy)
        )}px`;
        reelPlayerModal.style.left = `${Math.min(
          window.innerWidth - reelPlayerModal.offsetWidth,
          Math.max(0, reelPlayerModal.offsetLeft + dx)
        )}px`;
        reelPlayerModal.style.bottom = "";
        reelPlayerModal.style.right = "";

        // Reassign the position of mouse
        x = e.clientX;
        y = e.clientY;
        disableClick = true;
      };

      const mouseUpHandler = function () {
        // Remove the handlers of `mousemove` and `mouseup`
        document.removeEventListener("mousemove", mouseMoveHandler);
        document.removeEventListener("mouseup", mouseUpHandler);
      };

      const touchStartHandler = function (e: TouchEvent) {
        // How far the mouse has been moved
        const touchLocation = e.targetTouches[0];

        x = touchLocation.clientX;
        y = touchLocation.clientY;
        disableClick = false;

        reelPlayerModalRef.current.addEventListener(
          "touchmove",
          touchMoveHandler
        );
        document.addEventListener("touchend", touchEndHandler);
      };
      const touchMoveHandler = function (e: TouchEvent) {
        // How far the mouse has been moved
        e.preventDefault();
        e.stopPropagation();
        const touchLocation = e.targetTouches[0];
        const reelPlayerModal = reelPlayerModalRef.current;
        const dx = touchLocation.clientX - x;
        const dy = touchLocation.clientY - y;
        // Set the position of element
        reelPlayerModal.style.top = `${Math.min(
          window.innerHeight - reelPlayerModal.offsetHeight,
          Math.max(0, reelPlayerModal.offsetTop + dy)
        )}px`;
        reelPlayerModal.style.left = `${Math.min(
          window.innerWidth - reelPlayerModal.offsetWidth,
          Math.max(0, reelPlayerModal.offsetLeft + dx)
        )}px`;
        reelPlayerModal.style.bottom = "";
        reelPlayerModal.style.right = "";

        // Reassign the position of mouse
        x = touchLocation.clientX;
        y = touchLocation.clientY;
        disableClick = true;
        return false;
      };

      const touchEndHandler = function () {
        // Remove the handlers of `touchmove` and `touchend`
        reelPlayerModalRef.current.removeEventListener(
          "touchmove",
          touchMoveHandler
        );
        document.removeEventListener("touchend", touchEndHandler);

        if (!disableClick) {
          onClosePip();
        } else {
          disableClick = false;
        }
      };

      const videoContainerClickHandler = () => {
        if (!disableClick) {
          onClosePip();
        } else {
          disableClick = false;
        }
      };

      const videoContainerWheelHandler = (e: WheelEvent) => {
        e.preventDefault();
        e.stopPropagation();
        return false;
      };

      reelPlayerModalRef.current.addEventListener(
        "mousedown",
        mouseDownHandler
      );
      reelPlayerModalRef.current.addEventListener(
        "click",
        videoContainerClickHandler
      );
      reelPlayerModalRef.current.addEventListener(
        "touchstart",
        touchStartHandler
      );
      reelPlayerModalRef.current.addEventListener(
        "wheel",
        videoContainerWheelHandler,
        {
          passive: false,
        }
      );

      return () => {
        onClosePip();
        if (reelPlayerModalRef.current) {
          reelPlayerModalRef.current.removeEventListener(
            "mousedown",
            mouseDownHandler
          );
          reelPlayerModalRef.current.removeEventListener(
            "click",
            videoContainerClickHandler
          );
          reelPlayerModalRef.current.removeEventListener(
            "wheel",
            videoContainerWheelHandler
          );
          reelPlayerModalRef.current.removeEventListener(
            "touchstart",
            touchStartHandler
          );
        }
      };
    }
  }, [isPipActive]);

  const NavigationArrows = () => {
    if (!isDesktop || videoPlayerView !== "SINGLE" || isPipActive) return null;

    const activeIndex = shortVideos.findIndex((v) => v.i === activeVideoId);

    return (
      <>
        {activeIndex > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleVideoNavigation(shortVideos[activeIndex - 1].i);
            }}
            className="ins-video-nav-arrow ins-video-nav-arrow-left"
            aria-label="Previous video"
          >
            <ChevronDownIcon className="ins-story-arrow ins-story-left" />
          </button>
        )}
        {activeIndex < shortVideos.length - 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleVideoNavigation(shortVideos[activeIndex + 1].i);
            }}
            className="ins-video-nav-arrow ins-video-nav-arrow-right"
            aria-label="Next video"
          >
            <ChevronDownIcon className="ins-story-arrow ins-story-right" />
          </button>
        )}
      </>
    );
  };

  if (!activeVideo) return null;

  return (
    <>
      <div
        ref={reelPlayerModalRef}
        className={classNames({
          "ins-reel-player-modal-overlay": true,
          "ins-reel-player-modal-overlay__is-mobile": !isDesktop,
          "ins-reel-player-modal-overlay__is-desktop": isDesktop,
          "ins-reel-player-modal-overlay__is-pip-active": isPipActive,
        })}
        onClick={handleClick}
      >
        <div
          ref={modalContentRef}
          className={classNames({
            "ins-reel-player-modal": true,
            "ins-reel-player-modal__is-mobile": !isDesktop,
            "ins-reel-player-modal__is-desktop": isDesktop,
            "ins-reel-player-modal__is-pip-active": isPipActive,
            "ins-reel-player-modal__is-pip-inactive": !isPipActive,
            "ins-reel-player-modal__single-view": videoPlayerView === "SINGLE",
          })}
        >
          {videoPlayerView == "STACKED" || !isDesktop ? (
            shortVideos
              // .slice(
              //   Math.max(0, activeIndex - 1),
              //   Math.min(shortVideos.length, activeIndex + 2)
              // )
              .map((video, i, arr) => {
                const indexInSlicedArray = arr.findIndex(
                  (v) => v.i === activeVideo.i
                );
                const originalIndex = shortVideos.findIndex(
                  (v) => v.i === video.i
                );
                const isInView = true; // All sliced videos should be in view

                return (
                  <Reel
                    isDesktop={isDesktop}
                    isInView={isInView}
                    globalMuted={globalMuted}
                    onToggleMute={() => setGlobalMuted((p) => !p)}
                    onMute={() => setGlobalMuted(true)}
                    key={video.i}
                    isActive={video.i === activeVideo.i}
                    onView={() => {
                      if (video.i === activeVideo?.i) {
                        trackView(video.i);
                        if (googleAnalyticsEnabled) {
                          gaEvents.trackView(
                            "video-carousel",
                            instasellLiveEmbedConfig.pageType,
                            video.m[0].v,
                            useGtmForAnalytics
                          );
                        }
                        if (clevertapAnalyticsEnabled) {
                          caEvents.trackView(
                            "video-carousel",
                            instasellLiveEmbedConfig.pageType,
                            video.m[0].v
                          );
                        }
                        if (metaRetargetingEnabled) {
                          fbEvents.trackView(
                            "video-carousel",
                            instasellLiveEmbedConfig.pageType,
                            video.m[0].v
                          );
                        }
                      }
                    }}
                    video={video}
                    stackIndex={i < indexInSlicedArray ? i : arr.length - i - 1}
                    sizeMultiplier={
                      i < indexInSlicedArray
                        ? indexInSlicedArray - i
                        : i - indexInSlicedArray
                    }
                    isPrevious={i < indexInSlicedArray}
                    onClick={() => handleVideoNavigation(video.i)}
                    onClose={handleModalClose}
                    goToNextVideo={() => {
                      const nextVideo = shortVideos[originalIndex + 1];
                      return nextVideo
                        ? handleVideoNavigation(nextVideo.i)
                        : null;
                    }}
                    goToPreviousVideo={() => {
                      const prevVideo = shortVideos[originalIndex - 1];
                      return prevVideo
                        ? handleVideoNavigation(prevVideo.i)
                        : null;
                    }}
                  />
                );
              })
          ) : (
            <div className="ins-reel-player-content">
              <Reel
                key={activeVideo.i}
                isDesktop={isDesktop}
                isInView={true}
                globalMuted={globalMuted}
                onToggleMute={() => setGlobalMuted((p) => !p)}
                onMute={() => setGlobalMuted(true)}
                isActive={true}
                video={activeVideo}
                stackIndex={0}
                sizeMultiplier={1}
                isPrevious={false}
                onClick={() => {}}
                onClose={handleModalClose}
                onView={() => {
                  const video = shortVideos.filter(
                    (video) => video.i == activeVideo.i
                  );
                  if (video[0].i === activeVideo?.i) {
                    trackView(video[0].i);
                    if (googleAnalyticsEnabled) {
                      gaEvents.trackView(
                        "video-carousel",
                        instasellLiveEmbedConfig.pageType,
                        video[0].m[0].v,
                        useGtmForAnalytics
                      );
                    }
                    if (clevertapAnalyticsEnabled) {
                      caEvents.trackView(
                        "video-carousel",
                        instasellLiveEmbedConfig.pageType,
                        video[0].m[0].v
                      );
                    }
                  }
                }}
                goToNextVideo={() => {
                  const nextVideo =
                    shortVideos[shortVideos.indexOf(activeVideo) + 1];
                  if (nextVideo) handleVideoNavigation(nextVideo.i);
                }}
                goToPreviousVideo={() => {
                  const prevVideo =
                    shortVideos[shortVideos.indexOf(activeVideo) - 1];
                  if (prevVideo) handleVideoNavigation(prevVideo.i);
                }}
              />
              <NavigationArrows />
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default VideoModal;
