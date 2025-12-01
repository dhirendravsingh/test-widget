import { useEffect, useRef, useState } from "preact/hooks";
import { useStoryVideosModalContext } from "../../context/StoryVideosModalContext";
import {
  XIcon,
  ChevronDownIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
} from "../icons";
import StoryProductPane from "../StoryProductPane";
import { useStoryViews } from "../../context/useStoryViews";
import { useGAEvents } from "../../context/GoogleAnalytics";
import { instasellStoryEmbedConfig } from "../../story-index";
import { useCleverTapEvents } from "../../context/ClevertapAnalytics";
import { useMetaEvents } from "../../context/MetaEventsContext";

export const StoryModal = () => {
  const {
    activeStoryId,
    activeVideoIndex,
    setActiveStoryId,
    setActiveVideoIndex,
    isDesktop,
    stories,
    setActiveVideoId,
    googleAnalyticsEnabled,
    useGtmForAnalytics,
    clevertapAnalyticsEnabled,
    metaRetargetingEnabled,
  } = useStoryVideosModalContext();
  const gaEvents = useGAEvents();
  const caEvents = useCleverTapEvents();
  const fbEvents = useMetaEvents();

  const videoRef = useRef<HTMLVideoElement>(null);
  const [progress, setProgress] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  const activeStory = stories.find((s) => s.i === activeStoryId);
  const activeStoryIndex = stories.findIndex((s) => s.i === activeStoryId);
  const modalContentRef = useRef<HTMLDivElement | null>(null as never);
  const { trackView } = useStoryViews();

  // Handle back button on mobile devices
  useEffect(() => {
    if (!activeStoryId || isDesktop) return;

    const handlePopState = (event: PopStateEvent) => {
      // Prevent default back navigation
      event.preventDefault();

      // Close the modal instead
      setActiveStoryId(null);
      setActiveVideoIndex(0);

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
  }, [activeStoryId, isDesktop]);

  useEffect(() => {
    setActiveVideoIndex(0);
  }, [activeStoryId]);

  useEffect(() => {
    if (activeStoryId) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [activeStoryId]);

  useEffect(() => {
    const playVideo = async () => {
      if (videoRef.current) {
        try {
          // Only reset and play if video is paused or ended
          if (videoRef.current.paused || videoRef.current.ended) {
            videoRef.current.currentTime = 0;
            await videoRef.current.play();
          }
        } catch (error) {
          console.log(`%cFailed to autoplay: ${error}`, "color: red;");
        }
      }
    };
    playVideo();
  }, [activeStoryId, activeVideoIndex]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!activeStoryId) return;

      if (e.key === "ArrowLeft") {
        goToPrevious();
      } else if (e.key === "ArrowRight") {
        goToNext();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [activeStoryId, activeVideoIndex, activeStoryIndex]);

  useEffect(() => {
    if (!videoRef.current) return;

    const id = window.setInterval(() => {
      if (!videoRef.current) return;
      const calculatedProgress =
        Math.round(
          ((videoRef.current?.currentTime || 0) /
            (videoRef.current?.duration || 0)) *
            10000
        ) / 100;
      setProgress(calculatedProgress);
    }, 100);

    return () => {
      window.clearInterval(id);
    };
  }, [activeVideoIndex, activeStoryId]);

  const goToNext = async () => {
    if (!activeStory) return;

    // Pause current video first
    if (videoRef.current) {
      await videoRef.current.pause();
    }

    if (activeVideoIndex < activeStory.sv.length - 1) {
      setActiveVideoIndex(activeVideoIndex + 1);
    } else if (activeStoryIndex < stories.length - 1) {
      setActiveStoryId(stories[activeStoryIndex + 1].i);
      setActiveVideoIndex(0);
    } else {
      setActiveStoryId(null);
      setActiveVideoIndex(0);
    }
  };

  const goToPrevious = async () => {
    // Pause current video first
    if (videoRef.current) {
      await videoRef.current.pause();
    }

    if (activeVideoIndex > 0) {
      setActiveVideoIndex(activeVideoIndex - 1);
    } else if (activeStoryIndex > 0) {
      setActiveStoryId(stories[activeStoryIndex - 1].i);
      setActiveVideoIndex(stories[activeStoryIndex - 1].sv.length - 1);
    }
  };

  const handleContentClick = async (e: MouseEvent) => {
    e.stopPropagation();
    (e as any).stopImmediatePropagation?.();
    e.preventDefault();
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;

    // Only handle navigation clicks on the sides
    if (x < width / 3) {
      // Prevent multiple rapid clicks
      if (!videoRef.current?.paused) {
        await videoRef.current?.pause();
      }
      goToPrevious();
    } else if (x > (2 * width) / 3) {
      if (!videoRef.current?.paused) {
        await videoRef.current?.pause();
      }
      goToNext();
    }
    // Clicking in the middle section (width/3 to 2*width/3) does nothing
  };

  useEffect(() => {
    if (activeStory) {
      setActiveVideoId(activeStory.sv[activeVideoIndex].i);
    }
  }, [activeStory]);

  const handleVideoControl = async (pause: boolean) => {
    if (pause) {
      if (videoRef.current) {
        await videoRef.current.pause();
      }
    } else {
      if (videoRef.current) {
        await videoRef.current.play();
      }
    }
  };

  const renderProgressBars = () => {
    if (!activeStory?.sv) return null;
    return (
      <div className="ins-story-progress-container">
        {activeStory.sv.map((_, i) => (
          <div key={i} className="ins-story-progress-bar-wrapper">
            <div
              className="ins-story-progress-bar"
              style={{
                width:
                  i === activeVideoIndex
                    ? `${progress}%`
                    : i < activeVideoIndex
                    ? "100%"
                    : "0%",
              }}
            >
              .
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (!activeStory) return null;

  const isFirstStory = activeStoryIndex === 0 && activeVideoIndex === 0;
  const isLastStory =
    activeStoryIndex === stories.length - 1 &&
    activeVideoIndex === activeStory.sv.length - 1;

  const handleClick = (e: MouseEvent) => {
    if (!modalContentRef.current?.contains(e.target as HTMLElement)) {
      e.stopPropagation();
      setActiveStoryId(null);
    }
  };

  useEffect(() => {
    trackView(stories[activeStoryIndex].sv[activeVideoIndex].i);
    if (googleAnalyticsEnabled) {
      gaEvents.trackView(
        "video-story",
        instasellStoryEmbedConfig.pageType,
        stories[activeStoryIndex].sv[activeVideoIndex].m[0].v,
        useGtmForAnalytics
      );
    }
    if (clevertapAnalyticsEnabled) {
      caEvents.trackView(
        "video-story",
        instasellStoryEmbedConfig.pageType,
        stories[activeStoryIndex].sv[activeVideoIndex].m[0].v
      );
    }
    if (metaRetargetingEnabled) {
      fbEvents.trackView(
        "video-story",
        instasellStoryEmbedConfig.pageType,
        stories[activeStoryIndex].sv[activeVideoIndex].m[0].v
      );
    }
  }, [activeVideoIndex, activeStoryIndex]);

  return (
    <div className="ins-story-modal-overlay" onClick={handleClick}>
      <div className="ins-story-feed-container">
        {isDesktop && !isFirstStory && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              goToPrevious();
            }}
            style={{
              position: "absolute",
              left: "-50px",
              top: "50%",
              transform: "translateY(-50%)",
              background: "rgba(0, 0, 0, 0.5)",
              border: "none",
              borderRadius: "50%",
              width: "40px",
              height: "40px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              zIndex: 3,
              padding: 0,
            }}
          >
            <ChevronDownIcon className="ins-story-arrow ins-story-left" />
          </button>
        )}

        {isDesktop && !isLastStory && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              goToNext();
            }}
            style={{
              position: "absolute",
              right: "-50px",
              top: "50%",
              transform: "translateY(-50%)",
              background: "rgba(0, 0, 0, 0.5)",
              border: "none",
              borderRadius: "50%",
              width: "40px",
              height: "40px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              zIndex: 3,
              padding: 0,
            }}
          >
            <ChevronDownIcon className="ins-story-arrow ins-story-right" />
          </button>
        )}
        <div ref={modalContentRef} className="ins-story-modal">
          <div
            className="ins-story-modal-content"
            onClick={handleContentClick}
            style={{ position: "relative", width: "100%", height: "100%" }}
          >
            {renderProgressBars()}

            <div
              style={{
                position: "absolute",
                top: "20px",
                left: "12px",
                right: "12px",
                zIndex: 2,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMuted(!isMuted);
                }}
                style={{
                  background: "none",
                  border: "none",
                  padding: "8px",
                  cursor: "pointer",
                }}
              >
                {isMuted ? (
                  <SpeakerXMarkIcon className="ins-reel-modal-player-pause-icon" />
                ) : (
                  <SpeakerWaveIcon className="ins-reel-modal-player-play-icon" />
                )}
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveStoryId(null);
                }}
                style={{
                  background: "none",
                  border: "none",
                  padding: "8px",
                  cursor: "pointer",
                }}
              >
                <XIcon className="ins-story-close-icon" />
              </button>
            </div>

            <div
              style={{ position: "relative", width: "100%", height: "100%" }}
            >
              {/* Navigation overlay */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: "190px", // Leave space for product pane
                  zIndex: 1,
                  display: "flex",
                }}
              >
                <div
                  style={{ width: "33.33%", height: "100%" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    goToPrevious();
                  }}
                />
                <div
                  style={{ width: "33.33%", height: "100%" }}
                  onClick={(e) => e.stopPropagation()}
                />
                <div
                  style={{ width: "33.33%", height: "100%" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    goToNext();
                  }}
                />
              </div>
              <video
                ref={videoRef}
                src={
                  activeStory.sv[activeVideoIndex].m[1]?.v ||
                  activeStory.sv[activeVideoIndex].m[0].v
                }
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                  pointerEvents: "none", // Prevent video element from receiving clicks
                }}
                autoPlay
                playsInline
                muted={isMuted}
                onEnded={goToNext}
              />
            </div>
            {(activeStory.sv[activeVideoIndex] as any)?.b === 2 &&
            (activeStory.sv[activeVideoIndex] as any)?.ct ? (
              <div
                className="ins-reel-player-product-panel-2"
                style={{ bottom: "50px" }}
              >
                <div
                  className="ins-product-panel-item"
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    backgroundColor: "unset",
                    width: "100%",
                  }}
                >
                  <button
                    className="ins-custom-cta-button"
                    onClick={() => {
                      const videoData = activeStory.sv[activeVideoIndex] as any;
                      if (videoData?.ct?.cl) {
                        window.open(videoData.ct.cl, "_blank");
                      }
                    }}
                    title={(activeStory.sv[activeVideoIndex] as any)?.ct?.cn}
                  >
                    <span className="ins-custom-cta-text">
                      {(activeStory.sv[activeVideoIndex] as any)?.ct?.cn ||
                        "Custom Button"}
                    </span>
                  </button>
                </div>
              </div>
            ) : activeStory.sv[activeVideoIndex].p ? (
              <StoryProductPane
                video={activeStory.sv[activeVideoIndex]}
                handleVideoControl={handleVideoControl}
                onMute={() => setIsMuted(true)}
              />
            ) : (
              <div></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StoryModal;
