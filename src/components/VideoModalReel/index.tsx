import { useEffect, useRef, useState } from "preact/hooks";
import { classNames } from "../../lib/utils";
import ProductPane from "../ProductPane";
import {
  PauseIcon,
  PlaySolidIcon,
  XIcon,
  SpeakerXMarkIcon,
  SpeakerWaveIcon,
} from "../icons";
import { useShortVideosModalContext } from "../../context/ShortVideosModalContext";

import type { ShortVideo } from "../../types/api";

const Reel = ({
  isActive,
  video,
  sizeMultiplier,
  stackIndex,
  isPrevious,
  onClick,
  isInView,
  isDesktop,
  onClose,
  onView,
  goToNextVideo,
  goToPreviousVideo,
  globalMuted,
  onToggleMute,
  onMute,
}: {
  isInView: boolean;
  isActive: boolean;
  video: ShortVideo;
  sizeMultiplier: number;
  stackIndex: number;
  isPrevious: boolean;
  isDesktop: boolean;
  onClick: () => void;
  goToNextVideo: () => void;
  goToPreviousVideo: () => void;
  onClose: () => void;
  onView: (shortVideoId: string) => void;
  globalMuted: boolean;
  onToggleMute: () => void;
  onMute: () => void;
}) => {
  const [isFullyLoaded, setIsFullyLoaded] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isMuted, setIsMuted] = useState(true); // Keep this for local control

  const { isPipActive, isProductDetailsModalOpen, videoPlayerView } =
    useShortVideosModalContext();
  const [isPlaying, setIsPlaying] = useState(false);
  const reelPlayer = useRef<HTMLDivElement>(null as never);
  const videoPlayer = useRef<HTMLVideoElement | null>(null);
  const thumbnailRef = useRef<HTMLDivElement>(null);

  const requiredWidth = Math.min(
    (window.innerHeight * 9) / 16,
    window.innerWidth
  );
  const dimensionsMultiplier = isActive ? 1 : Math.pow(0.8, sizeMultiplier);
  const videoProgressBarRef = useRef<HTMLDivElement>(null);

  const videoUrl = isPipActive
    ? video.m.find((media) => media.s === "low")?.v ||
      video.m.find((media) => media.s === "high")?.v
    : video.m.find((media) => media.s === "high")?.v;

  useEffect(() => {
    if (isPipActive && isActive) {
      if (videoPlayer.current) {
        // For PiP, use local mute state
        videoPlayer.current.muted = isMuted;
        videoPlayer.current
          .play()
          .then(() => {
            setIsFullyLoaded(true);
            setIsPlaying(true);
            setIsMuted(true);
          })
          .catch((error) => console.log(`%c${error}`, "color: red;"));
      }
    }
    if (isActive && !isPipActive) {
      if (videoPlayer.current) {
        // For fullscreen, respect global mute
        videoPlayer.current.muted = true; // Start muted
        videoPlayer.current
          .play()
          .then(() => {
            console.log("playing the video");
            setIsFullyLoaded(true);
            setIsPlaying(true);
            videoPlayer.current!.muted = globalMuted; // Then follow global state
            setIsMuted(globalMuted);
          })
          .catch((error) => console.log(`%c${error}`, "color: red;"));
      }
    }
    if (!isActive) {
      if (videoPlayer.current) {
        videoPlayer.current.muted = true;
        videoPlayer.current?.pause();
        setIsMuted(true);
        setIsPlaying(false);
      }
    }
  }, [isPipActive, isActive]);

  useEffect(() => {
    if (!isInView && isVideoLoaded) {
      setIsVideoLoaded(false);
      setIsFullyLoaded(false);
    }
    if (isInView) {
      window.setTimeout(() => {
        if (isVideoLoaded) {
          if (videoPlayer.current) {
            videoPlayer.current?.pause();
            videoPlayer.current.currentTime = 0;
            try {
              videoPlayer.current?.play().then(() => {
                setIsFullyLoaded(true);
              });
            } catch (error) {
              window.setTimeout(() => {
                videoPlayer.current?.play().then(() => {
                  setIsFullyLoaded(true);
                });
              }, 1000);
            }
          }
        }
      }, 1000);
    }
  }, [isInView]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    var yDown: number | null = null;
    var xDown: number | null = null;
    const VERTICAL_THRESHOLD = 50;
    const DIRECTION_RATIO = 2;

    function handleTouchStart(e: TouchEvent) {
      if (isProductDetailsModalOpen) return;
      const firstTouch = e.touches[0];
      yDown = firstTouch.clientY;
      xDown = firstTouch.clientX;
      reelPlayer.current.style.transition = "none";

      const nextSibling = reelPlayer.current?.nextSibling as HTMLDivElement;
      const previousSibling = reelPlayer.current
        ?.previousSibling as HTMLDivElement;

      if (nextSibling?.style) {
        nextSibling.style.transition = "none";
      }
      if (previousSibling?.style) {
        previousSibling.style.transition = "none";
      }
    }

    function handleTouchMove(e: TouchEvent) {
      if (isProductDetailsModalOpen || !yDown || !xDown) return;

      const touch = e.changedTouches[0];
      const yDiff = touch.clientY - yDown;
      const xDiff = touch.clientX - xDown;

      // Calculate absolute differences
      const absX = Math.abs(xDiff);
      const absY = Math.abs(yDiff);

      // If horizontal scrolling is dominant, don't move the video
      if (absX > absY) {
        return;
      }

      // Only apply visual movement if vertical movement is significant
      if (absY > 10) {
        reelPlayer.current.style.top = `${Math.floor(yDiff)}px`;

        if (yDiff > 0) {
          const previousSibling = reelPlayer.current
            ?.previousSibling as HTMLDivElement;
          if (previousSibling?.style) {
            previousSibling.style.top = `calc(-100% + ${yDiff}px)`;
          }
        } else {
          const nextSibling = reelPlayer.current?.nextSibling as HTMLDivElement;
          if (nextSibling?.style) {
            nextSibling.style.top = `calc(100% + ${yDiff}px)`;
          }
        }
      }
    }

    function handleTouchEnd(e: TouchEvent) {
      if (isProductDetailsModalOpen || !yDown || !xDown) return;

      const touch = e.changedTouches[0];
      const yDiff = touch.clientY - yDown;
      const xDiff = touch.clientX - xDown;
      const absX = Math.abs(xDiff);
      const absY = Math.abs(yDiff);

      // Reset styles
      reelPlayer.current.style.transition = "";
      reelPlayer.current.style.top = "0";
      const nextSibling = reelPlayer.current?.nextSibling as HTMLDivElement;
      const previousSibling = reelPlayer.current
        ?.previousSibling as HTMLDivElement;

      if (nextSibling?.style) nextSibling.style.transition = "";
      if (previousSibling?.style) previousSibling.style.transition = "";

      // Only trigger video change if:
      // 1. Vertical movement exceeds threshold
      // 2. Vertical movement is significantly more than horizontal
      // 3. Not currently scrolling products horizontally
      if (absY > VERTICAL_THRESHOLD && absY > absX * DIRECTION_RATIO) {
        if (yDiff > 0) {
          goToPreviousVideo();
        } else {
          goToNextVideo();
        }
      }

      yDown = null;
      xDown = null;
    }

    reelPlayer.current.addEventListener("touchstart", handleTouchStart);
    reelPlayer.current.addEventListener("touchmove", handleTouchMove);
    reelPlayer.current.addEventListener("touchend", handleTouchEnd);

    return () => {
      reelPlayer.current.removeEventListener("touchstart", handleTouchStart);
      reelPlayer.current.removeEventListener("touchmove", handleTouchMove);
      reelPlayer.current.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isActive, isProductDetailsModalOpen]);

  useEffect(() => {
    onView(video.i);

    window.setTimeout(() => {
      if (isVideoLoaded) {
        if (videoPlayer.current) {
          videoPlayer.current.currentTime = 0;
          videoPlayer.current?.play().then(() => {
            setIsFullyLoaded(true);
          });
        }
      }
    }, 0);

    const id = window.setInterval(() => {
      if (!videoProgressBarRef.current) return;
      videoProgressBarRef.current.style.width = `${
        Math.round(
          ((videoPlayer.current?.currentTime || 0) /
            (videoPlayer.current?.duration || 0)) *
            10000
        ) / 100
      }%`;
    }, 100);

    return () => {
      window.clearInterval(id);
    };
  }, [isActive]);

  useEffect(() => {
    if (!isPlaying && isMuted && isVideoLoaded) {
      videoPlayer.current?.play().then(() => {
        setIsFullyLoaded(true);
      });
    }
  }, [isMuted]);

  useEffect(() => {
    if (isPipActive && isActive) {
      videoPlayer.current?.play().then(() => {
        setIsFullyLoaded(true);
      });
      setIsPlaying(true);
      setIsMuted(true);
    }
    if (isActive && !isPipActive) {
      videoPlayer.current?.play().then(() => {
        setIsFullyLoaded(true);
      });
      setIsPlaying(true);
      setIsMuted(globalMuted);
    }

    if (!isActive) {
      setIsMuted(true);
    }
  }, [isPipActive, isActive]);

  useEffect(() => {
    return () => {
      // This function runs when component is about to be destroyed
      if (videoPlayer.current) {
        videoPlayer.current.pause();
        videoPlayer.current.muted = true;
        videoPlayer.current.currentTime = 0;
      }
    };
  }, []);

  return (
    <div
      ref={reelPlayer}
      className={classNames({
        "ins-reel-player-modal-reel": true,
        "ins-reel-player-modal-reel__is-active": isActive,
        "ins-reel-player-modal-reel__product-details-open":
          isProductDetailsModalOpen,
        "ins-reel-player-modal-reel__is-mobile": !isDesktop,
        "ins-reel-player-modal-reel__is-desktop": isDesktop,
        "ins-reel-player-modal-reel__is-pip-active": isPipActive,
        "ins-reel-player-modal-reel__is-pip-inactive": !isPipActive,
        "ins-reel-player-modal-reel__single-view": videoPlayerView === "SINGLE",
      })}
      style={{
        ...(isActive
          ? {
              width: isDesktop ? requiredWidth + "px" : "100%",
              // Remove position and transform for SINGLE view
              ...(videoPlayerView === "SINGLE" &&
                isDesktop && {
                  position: "relative",
                  margin: "0 auto",
                }),
            }
          : (videoPlayerView === "STACKED" || !isDesktop) && isInView
          ? isDesktop
            ? {
                left: 50 + (isPrevious ? -1 : 1) * 12.5 * sizeMultiplier + "%",
                height: window.innerHeight * dimensionsMultiplier + "px",
                width: requiredWidth * dimensionsMultiplier + "px",
                "z-index": 1000 + stackIndex,
                transform: "translateX(-50%)",
              }
            : {
                position: "absolute",
                top: isPrevious ? "-100%" : "100%",
                width: "100%",
                left: "0",
                height: "100%",
              }
          : isDesktop
          ? {
              "z-index": 0,
              transform: "translateX(-100%)",
              left: isPrevious ? "-25%" : "125%",
              height: window.innerHeight * 0.01 + "px",
              width: requiredWidth * 0.01 + "px",
            }
          : {
              top: isPrevious ? "-200%" : "200%",
              width: "100%",
              left: "0",
              height: "100%",
            }),
        visibility: isPipActive && !isFullyLoaded ? "hidden" : "visible",
      }}
    >
      {(isInView || !isDesktop) && (
        <video
          onClick={!isActive ? onClick : undefined}
          className={classNames({
            "ins-reel-player-modal-reel-video__in-view": true,
            "ins-reel-player-modal-reel-video__is-active": isActive,
            "ins-reel-player-modal-reel-video__is-desktop": !!isDesktop,
          })}
          ref={videoPlayer}
          playsInline={true}
          src={videoUrl}
          loop={true}
          muted={isPipActive ? isMuted : globalMuted || !isActive}
          controls={false}
          preload="auto"
          onLoadedData={() => {
            setIsVideoLoaded(true);
          }}
          onPause={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
          poster={video.m.find((media) => media.s === "high")?.t}
        />
      )}

      {isFullyLoaded && isInView ? (
        <>
          {isActive ? (
            <>
              {isPipActive ? (
                <>
                  <div
                    className="ins-reel-modal-player-pip-top-controls"
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsMuted((p) => !p);
                      }}
                      className="ins-reel-modal-player-mute-button"
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      {isMuted ? (
                        <SpeakerXMarkIcon className="ins-reel-modal-player-speaker-icon" />
                      ) : (
                        <SpeakerWaveIcon className="ins-reel-modal-player-speaker-icon" />
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                      }}
                      className="ins-reel-modal-player-pip-close-button"
                    >
                      <XIcon className="ins-reel-modal-player-pip-close-button-icon" />
                    </button>
                  </div>
                  <button
                    className="ins-reel-modal-player-pip-play-controls"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (videoPlayer.current?.paused) {
                        videoPlayer.current?.play();
                      } else {
                        videoPlayer.current?.pause();
                      }
                    }}
                  >
                    {isPlaying ? (
                      <PauseIcon className="ins-reel-modal-player-pause-icon" />
                    ) : (
                      <PlaySolidIcon className="ins-reel-modal-player-play-icon" />
                    )}
                  </button>
                </>
              ) : (
                <>
                  <div className="ins-reel-modal-player-top-controls">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleMute();
                      }}
                      style={{
                        width: "35px",
                        height: "35px",
                        padding: "0.5em",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                      className="ins-reel-modal-player-mute-button"
                    >
                      {globalMuted ? (
                        <SpeakerXMarkIcon className="ins-reel-modal-player-speaker-icon" />
                      ) : (
                        <SpeakerWaveIcon className="ins-reel-modal-player-speaker-icon" />
                      )}
                    </button>
                    <button
                      onClick={onClose}
                      style={{
                        width: "35px",
                        height: "35px",
                        padding: "0.5em",
                      }}
                      className="ins-reel-modal-player-close-button"
                    >
                      <XIcon className="ins-reel-modal-player-close-icon" />
                    </button>
                  </div>
                </>
              )}
              <div className="ins-reel-player-modal-reel-progress-meter">
                <div
                  className="ins-reel-player-modal-reel-progress-bar"
                  ref={videoProgressBarRef}
                ></div>
              </div>
            </>
          ) : null}

          {(video as any)?.b === 2 && (video as any)?.ct ? (
            isPipActive ? null : (
              <div
                className="ins-reel-player-product-panel"
                style={{ bottom: "50px" }}
              >
                <div
                  className="ins-product-panel-item"
                  style={{ justifyContent: "center" }}
                >
                  <div className="ins-product-panel-actions">
                    <button
                      className="ins-custom-cta-button"
                      onClick={() => {
                        if ((video as any)?.ct?.cl) {
                          window.location.href = (video as any).ct.cl;
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
              </div>
            )
          ) : video.p ? (
            isPipActive ? null : (
              <ProductPane
                video={video}
                isDesktop={isDesktop}
                isActive={isActive}
                onMute={onMute}
              />
            )
          ) : (
            <div></div>
          )}
        </>
      ) : null}
      {/* )} */}
    </div>
  );
};

export default Reel;
