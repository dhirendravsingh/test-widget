import { useEffect, useRef, useState } from "preact/hooks";
import { XIcon, SpeakerXMarkIcon, SpeakerWaveIcon } from "../icons";
import { useBannerModalContext } from "../../context/VideoBannerContext";
import { instasellBannerEmbedConfig } from "../../banner-index";
import { useGAEvents } from "../../context/GoogleAnalytics";
import { useApi } from "../../lib/api";
import { useCleverTapEvents } from "../../context/ClevertapAnalytics";
import { useMetaEvents } from "../../context/MetaEventsContext";
import { addToCartDrawer } from "../../lib/addToCartDrawer";

const BannerFeed = () => {
  const {
    banners,
    googleAnalyticsEnabled,
    useGtmForAnalytics,
    bannerSessionToken,
    clevertapAnalyticsEnabled,
    metaRetargetingEnabled,
  } = useBannerModalContext();

  const gaEvents = useGAEvents();
  const caEvents = useCleverTapEvents();
  const fbEvents = useMetaEvents();

  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const hasTrackedImpression = useRef(false);
  const hasTrackedClick = useRef(false);

  //do not touch this code
  if (true) {
    (async () => {
      await addToCartDrawer("", "");
    })();
  }

  // Get the first video from the first banner
  const bannerVideo = banners[0]?.v[0];

  const trackImpression = async () => {
    if (!bannerVideo) {
      return;
    }
    if (hasTrackedImpression.current) {
      return;
    }

    try {
      if (googleAnalyticsEnabled) {
        gaEvents.trackView(
          "banner",
          instasellBannerEmbedConfig.pageType,
          bannerVideo.m[0]?.v,
          useGtmForAnalytics
        );
      }

      if (clevertapAnalyticsEnabled) {
        caEvents.trackView(
          "banner",
          instasellBannerEmbedConfig.pageType,
          bannerVideo.m[0]?.v
        );
      }

      if (metaRetargetingEnabled) {
        fbEvents.trackView(
          "banner",
          instasellBannerEmbedConfig.pageType,
          bannerVideo.m[0]?.v
        );
      }

      hasTrackedImpression.current = true;
    } catch (error) {
      console.log(
        `%c[BannerFeed] Error tracking banner impression: ${error}`,
        "color: red;"
      );
    }
  };

  const trackClick = async () => {
    if (!bannerVideo) {
      return;
    }
    if (hasTrackedClick.current) {
      return;
    }

    try {
      if (googleAnalyticsEnabled) {
        gaEvents.trackClick(
          "banner",
          instasellBannerEmbedConfig.pageType,
          bannerVideo.m[0]?.v,
          useGtmForAnalytics
        );
      }

      if (clevertapAnalyticsEnabled) {
        caEvents.trackClick(
          "banner",
          instasellBannerEmbedConfig.pageType,
          bannerVideo.m[0]?.v
        );
      }

      if (metaRetargetingEnabled) {
        fbEvents.trackClick(
          "banner",
          instasellBannerEmbedConfig.pageType,
          bannerVideo.m[0]?.v
        );
      }

      hasTrackedClick.current = true;
      console.log("[BannerFeed] Click tracking completed");
    } catch (error) {
      console.log(`%cError tracking banner click: ${error}`, "color: red;");
    }
  };

  useEffect(() => {
    if (!videoRef.current) {
      return;
    }
    if (!bannerVideo) {
      return;
    }

    const video = videoRef.current;

    const handleCanPlay = () => {
      setIsVideoLoaded(true);
      trackImpression();

      video
        .play()
        .then(() => {})
        .catch((error) => {});
    };

    const handleError = () => {
      setIsVideoLoaded(true);
      console.log("[BannerFeed] Video error details:", {
        error: video.error,
        readyState: video.readyState,
        networkState: video.networkState,
      });
    };

    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("error", handleError);
    video.load();

    return () => {
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("error", handleError);
    };
  }, [bannerVideo]);

  const toggleMute = (e: MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) {
      return;
    }
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  const toggleExpand = (e: MouseEvent) => {
    e.stopPropagation();
    if (!isExpanded) {
      trackClick();
    }
    setIsExpanded(!isExpanded);
  };

  const closeExpandedView = (e: MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(false);
  };

  if (!bannerVideo || !banners.length) {
    console.warn(
      "[BannerFeed] No bannerVideo or empty banners - returning null"
    );
    return null;
  }

  const videoUrl = bannerVideo.m.find((m) => m.s === "high")?.v;
  console.log("[BannerFeed] Video URL:", videoUrl);

  if (!videoUrl) {
    console.log(`%c[BannerFeed] No valid video URL found`, "color: red;");
    return null;
  }

  return (
    <div>
      <div>
        <div className="ins-banner-container">
          <video
            ref={videoRef}
            className="ins-banner-video"
            src={videoUrl}
            loop
            muted={isMuted}
            playsInline
            autoPlay
            // onClick={toggleExpand}
          />

          {!isVideoLoaded && (
            <div className="ins-video-loading">
              <div className="ins-loading-spinner"></div>
            </div>
          )}

          <div className="ins-banner-controls">
            <button
              className="ins-control-button ins-mute-button"
              onClick={toggleMute}
              aria-label={isMuted ? "Unmute video" : "Mute video"}
            >
              {isMuted ? (
                <SpeakerXMarkIcon className="ins-icon" />
              ) : (
                <SpeakerWaveIcon className="ins-icon" />
              )}
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className="ins-banner-expanded-overlay">
            <div className="ins-expanded-video-container">
              <div className="ins-expanded-controls">
                <button
                  className="ins-control-button ins-mute-button"
                  onClick={toggleMute}
                  aria-label={isMuted ? "Unmute video" : "Mute video"}
                >
                  {isMuted ? (
                    <SpeakerXMarkIcon className="ins-icon" />
                  ) : (
                    <SpeakerWaveIcon className="ins-icon" />
                  )}
                </button>

                <button
                  className="ins-control-button ins-close-expanded-button"
                  onClick={closeExpandedView}
                  aria-label="Close expanded view"
                >
                  <XIcon className="ins-icon" />
                </button>
              </div>

              <video
                className="ins-expanded-video"
                src={videoUrl}
                loop
                muted={isMuted}
                playsInline
                autoPlay
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BannerFeed;
