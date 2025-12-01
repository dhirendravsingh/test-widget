import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import Reel from "./LibraryReel";
import { useApi } from "../../lib/api";
import { ShortVideo } from "../../types/api";
import { useShortVideosModalContext } from "../../context/ShortVideosModalContext";
import { useVideoViews } from "../../context/useVideoViews";
import { useGAEvents } from "../../context/GoogleAnalytics";
import { instasellLiveEmbedConfig } from "../..";
import { ChevronDownIcon } from "../icons";
import { classNames } from "../../lib/utils";
import { useCleverTapEvents } from "../../context/ClevertapAnalytics";
import { useMetaEvents } from "../../context/MetaEventsContext";

export const useVideoLibraryState = () => {
  const [isVideoLibraryOpen, setIsVideoLibraryOpen] = useState(false);

  const openVideoLibrary = () => {
    setIsVideoLibraryOpen(true);
  };

  const closeVideoLibrary = () => {
    setIsVideoLibraryOpen(false);
  };

  return { isVideoLibraryOpen, openVideoLibrary, closeVideoLibrary };
};

export const VideoLibrary = () => {
  const api = useApi();
  const {
    setIsProductDetailsModalOpen,
    isPipActive,
    setIsPipActive,
    isProductDetailsModalOpen,
    googleAnalyticsEnabled,
    useGtmForAnalytics,
    clevertapAnalyticsEnabled,
    canRegisterClickEvent,
    shortVideoSessionToken,
    videoPlayerView,
    shortVideos,
    isLoadingShortVideos,
    metaRetargetingEnabled,
  } = useShortVideosModalContext();
  const isDesktop = window.innerWidth > 600;
  const modalContentRef = useRef<HTMLDivElement | null>(null);
  const reelPlayerModalRef = useRef<HTMLDivElement | null>(null);
  const [allVideos, setAllVideos] = useState<ShortVideo[]>(shortVideos);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);

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
  const [isLoading, setIsLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});
  const [isFirstVideoLoaded, setIsFirstVideoLoaded] = useState(false);
  const [playButton, setPlayButton] = useState(true);

  // useEffect(() => {
  //   const fetchLibraryVideos = async () => {
  //     if (!initialLoading) return;

  //     setIsLoading(true);
  //     setError(null);
  //     setIsFirstVideoLoaded(false);

  //     try {
  //       const videos = await api.getLibraryVideos({
  //         originFqdn: window.location.hostname,
  //         viewerToken: localStorage?.getItem("__IS_VTOK") ?? "",
  //       });

  //       setAllVideos(videos);

  //       if (videos.length > 0) {
  //         setActiveVideoId(videos[0].i);
  //       }
  //     } catch (err) {
  //       console.error("Error fetching videos:", err);
  //       setError(err as Error);
  //     } finally {
  //       setIsLoading(false);
  //       setInitialLoading(false);
  //     }
  //   };

  //   fetchLibraryVideos();
  // }, [api, setActiveVideoId, initialLoading]);

  const activeIndex = allVideos.findIndex((v) => v.i === activeVideoId);

  const canScrollUp = activeIndex > 0;
  const canScrollDown = activeIndex < allVideos.length - 1;

  useEffect(() => {
    if (!activeVideoId || isPipActive) return;
    const previousValue = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousValue ? previousValue : "";
    };
  }, [activeVideoId, isPipActive]);

  const handleVideoNavigation = useCallback(
    (videoId: string | null) => {
      if (isProductDetailsModalOpen) {
        setIsProductDetailsModalOpen(false);
      }
      if (videoId) {
        setActiveVideoId(videoId);
      }
    },
    [isProductDetailsModalOpen, setActiveVideoId, setIsProductDetailsModalOpen]
  );

  useEffect(() => {
    if (isPipActive && reelPlayerModalRef.current) {
      let x = 0;
      let y = 0;
      let disableClick = false;

      const mouseDownHandler = function (e: MouseEvent) {
        x = e.clientX;
        y = e.clientY;
        disableClick = false;

        document.addEventListener("mousemove", mouseMoveHandler);
        document.addEventListener("mouseup", mouseUpHandler);
      };

      const mouseMoveHandler = function (e: MouseEvent) {
        const dx = e.clientX - x;
        const dy = e.clientY - y;

        const reelPlayerModal = reelPlayerModalRef.current;
        if (reelPlayerModal) {
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
        }

        x = e.clientX;
        y = e.clientY;
        disableClick = true;
      };

      const mouseUpHandler = function () {
        document.removeEventListener("mousemove", mouseMoveHandler);
        document.removeEventListener("mouseup", mouseUpHandler);
      };

      const touchStartHandler = function (e: TouchEvent) {
        const touchLocation = e.targetTouches[0];

        x = touchLocation.clientX;
        y = touchLocation.clientY;
        disableClick = false;

        const reelPlayerModal = reelPlayerModalRef.current;
        if (reelPlayerModal) {
          reelPlayerModal.addEventListener("touchmove", touchMoveHandler);
          document.addEventListener("touchend", touchEndHandler);
        }
      };

      const touchMoveHandler = function (e: TouchEvent) {
        e.preventDefault();
        e.stopPropagation();
        const touchLocation = e.targetTouches[0];
        const reelPlayerModal = reelPlayerModalRef.current;
        if (reelPlayerModal) {
          const dx = touchLocation.clientX - x;
          const dy = touchLocation.clientY - y;
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
        }

        x = touchLocation.clientX;
        y = touchLocation.clientY;
        disableClick = true;
        return false;
      };

      const touchEndHandler = function () {
        const reelPlayerModal = reelPlayerModalRef.current;
        if (reelPlayerModal) {
          reelPlayerModal.removeEventListener("touchmove", touchMoveHandler);
          document.removeEventListener("touchend", touchEndHandler);
        }

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

      const currentReelPlayerModal = reelPlayerModalRef.current;
      if (currentReelPlayerModal) {
        currentReelPlayerModal.addEventListener("mousedown", mouseDownHandler);
        currentReelPlayerModal.addEventListener(
          "click",
          videoContainerClickHandler
        );
        currentReelPlayerModal.addEventListener(
          "touchstart",
          touchStartHandler
        );
        currentReelPlayerModal.addEventListener(
          "wheel",
          videoContainerWheelHandler,
          { passive: false }
        );
      }

      return () => {
        onClosePip();
        if (currentReelPlayerModal) {
          currentReelPlayerModal.removeEventListener(
            "mousedown",
            mouseDownHandler
          );
          currentReelPlayerModal.removeEventListener(
            "click",
            videoContainerClickHandler
          );
          currentReelPlayerModal.removeEventListener(
            "wheel",
            videoContainerWheelHandler
          );
          currentReelPlayerModal.removeEventListener(
            "touchstart",
            touchStartHandler
          );
        }
      };
    }
  }, [isPipActive]);

  const handleActiveVideoId = useCallback(
    async (videoId: string) => {
      // Return early if already tracked or tracking is in progress
      if (hasTrackedClick.current || isTrackingInProgress.current) {
        return;
      }

      const video = allVideos.find((video) => video.i === videoId);
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
    [allVideos, googleAnalyticsEnabled, shortVideoSessionToken]
  );

  const handleClick = (e: MouseEvent) => {
    if (!modalContentRef.current?.contains(e.target as HTMLElement)) {
      setIsProductDetailsModalOpen(false);
      setIsPipActive(true);
    }
  };

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

  const NavigationArrows = () => {
    if (!isDesktop || videoPlayerView !== "SINGLE" || isPipActive) return null;

    const activeIndex = allVideos.findIndex((v) => v.i === activeVideoId);

    return (
      <>
        {activeIndex > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleVideoNavigation(allVideos[activeIndex - 1].i);
            }}
            className="ins-video-nav-arrow ins-video-nav-arrow-left"
            aria-label="Previous video"
          >
            <ChevronDownIcon className="ins-story-arrow ins-story-left" />
          </button>
        )}
        {activeIndex < allVideos.length - 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleVideoNavigation(allVideos[activeIndex + 1].i);
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

  const handleModalClose = useCallback(() => {
    // Reset all states
    setIsProductDetailsModalOpen(false);
    setIsPipActive(false);
    setActiveVideoId(null);
    setGlobalMuted(false);
    setIsLoading(true);
    setInitialLoading(true);
    setError(null);
    setAllVideos([]);
    hasTrackedClick.current = false;
    isTrackingInProgress.current = false;

    Object.values(videoRefs.current).forEach((video) => {
      if (video) {
        video.pause();
        video.currentTime = 0;
        video.load();
      }
    });
    videoRefs.current = {};

    if (reelPlayerModalRef.current) {
      reelPlayerModalRef.current.style.bottom = "";
      reelPlayerModalRef.current.style.right = "";
      reelPlayerModalRef.current.style.top = "";
      reelPlayerModalRef.current.style.left = "";
    }

    (window as any).closeVideoLibrary();
  }, [
    setIsProductDetailsModalOpen,
    setIsPipActive,
    setActiveVideoId,
    setGlobalMuted,
    setIsLoading,
    setInitialLoading,
    setError,
    setAllVideos,
  ]);

  if (error) {
    return <div></div>;
  }

  if (allVideos.length === 0) {
    return null;
  }

  const activeVideo = activeIndex >= 0 ? allVideos[activeIndex] : allVideos[0];

  return (
    <>
      {(isLoadingShortVideos || !isFirstVideoLoaded) && (
        <div className="ins-reel-loading-overlay">
          <div
            className="loader"
            style={{
              width: "190px",
              height: "5px",
              background: "linear-gradient(#fff 0 0) 0/0% no-repeat #5b5a5a",
              animation: "l1 6s infinite linear",
              display: "block",
            }}
          ></div>
          <style jsx>{`
            @keyframes l1 {
              100% {
                background-size: 100%;
              }
            }
          `}</style>
        </div>
      )}

      <div
        ref={reelPlayerModalRef}
        className={classNames({
          "ins-reel-player-modal-overlay": true,
          "ins-reel-player-modal-overlay__is-mobile": !isDesktop,
          "ins-reel-player-modal-overlay__is-desktop": isDesktop,
        })}
        onClick={handleClick}
      >
        <div
          ref={modalContentRef}
          className={classNames({
            "ins-reel-player-modal": true,
            "ins-reel-player-modal__is-mobile": !isDesktop,
            "ins-reel-player-modal__is-pip-inactive": !isPipActive,
            "ins-reel-player-modal__single-view": videoPlayerView === "SINGLE",
          })}
        >
          {videoPlayerView == "STACKED" || !isDesktop ? (
            allVideos
              // .slice(Math.max(0, indexOfActiveVideo - 2), Math.min(videos.length, indexOfActiveVideo + 3))
              .map((video, i, arr) => {
                const indexOfActiveVideo = arr.indexOf(activeVideo);
                const firstInViewVideoIndex = isDesktop
                  ? Math.max(0, indexOfActiveVideo - 2)
                  : Math.max(0, indexOfActiveVideo - 1);
                const lastInViewVideoIndex = isDesktop
                  ? Math.min(allVideos.length, indexOfActiveVideo + 3)
                  : Math.min(allVideos.length, indexOfActiveVideo + 2);
                const numberOfActiveVideos =
                  lastInViewVideoIndex - firstInViewVideoIndex;
                const isInView =
                  firstInViewVideoIndex <= i && lastInViewVideoIndex > i;

                return (
                  <Reel
                    isDesktop={isDesktop}
                    isInView={isInView}
                    globalMuted={globalMuted}
                    onToggleMute={() => setGlobalMuted((p) => !p)}
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
                    stackIndex={
                      i < indexOfActiveVideo
                        ? i - firstInViewVideoIndex
                        : lastInViewVideoIndex - i - 1
                    }
                    sizeMultiplier={
                      i < indexOfActiveVideo
                        ? indexOfActiveVideo - i
                        : i - indexOfActiveVideo
                    }
                    isPrevious={i < indexOfActiveVideo}
                    onClick={() => handleVideoNavigation(video.i)}
                    onClose={handleModalClose}
                    goToNextVideo={() =>
                      arr[i + 1] ? handleVideoNavigation(arr[i + 1].i) : null
                    }
                    goToPreviousVideo={() =>
                      arr[i - 1] ? handleVideoNavigation(arr[i - 1].i) : null
                    }
                    videoRef={(el: HTMLVideoElement | null) => {
                      if (el) {
                        el.setAttribute("data-video-id", video.i);
                        videoRefs.current[video.i] = el;
                      }
                    }}
                    forceVideoReset={video.i !== activeVideo?.i}
                    onVideoLoaded={
                      i === 0 ? () => setIsFirstVideoLoaded(true) : undefined
                    } // Only notify for the first video
                    playButton={playButton}
                    setPlayButton={setPlayButton}
                    refs={videoRefs}
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
                isActive={true}
                video={activeVideo}
                stackIndex={0}
                sizeMultiplier={1}
                isPrevious={false}
                onClick={() => {}}
                onClose={handleModalClose}
                onView={() => {
                  const video = allVideos.filter(
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
                    allVideos[allVideos.indexOf(activeVideo) + 1];
                  if (nextVideo) handleVideoNavigation(nextVideo.i);
                }}
                goToPreviousVideo={() => {
                  const prevVideo =
                    allVideos[allVideos.indexOf(activeVideo) - 1];
                  if (prevVideo) handleVideoNavigation(prevVideo.i);
                }}
                videoRef={(el: HTMLVideoElement | null) => {
                  if (el) {
                    el.setAttribute("data-video-id", activeVideo.i);
                    videoRefs.current[activeVideo.i] = el;
                  }
                }}
                forceVideoReset={activeVideo.i !== activeVideo?.i}
                onVideoLoaded={
                  activeIndex === 0
                    ? () => setIsFirstVideoLoaded(true)
                    : undefined
                } // Only notify for the first video
                playButton={playButton}
                setPlayButton={setPlayButton}
                refs={videoRefs}
              />
              <NavigationArrows />
            </div>
          )}
        </div>
      </div>
    </>
  );
};
