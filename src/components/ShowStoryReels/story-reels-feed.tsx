import { useEffect, useRef, useState } from "preact/hooks";
import { useStoryVideosModalContext } from "../../context/StoryVideosModalContext";
import StoryModal from "../StoryModal";
import { useApi } from "../../lib/api";
import { useGAEvents } from "../../context/GoogleAnalytics";
import { instasellStoryEmbedConfig } from "../../story-index";
import { useCleverTapEvents } from "../../context/ClevertapAnalytics";
import { useMetaEvents } from "../../context/MetaEventsContext";
const StoryFeed = () => {
  const {
    activeStoryId,
    setActiveStoryId,
    stories,
    storySessionToken,
    googleAnalyticsEnabled,
    useGtmForAnalytics,
    clevertapAnalyticsEnabled,
    metaRetargetingEnabled,
    showHighlights,

    // Story Title Settings
    storyTitleText,
  } = useStoryVideosModalContext();
  const gaEvents = useGAEvents();
  const caEvents = useCleverTapEvents();
  const fbEvents = useMetaEvents();

  const pageType = instasellStoryEmbedConfig.getPageType?.();

  const pageId =
    pageType == "home"
      ? ""
      : pageType == "product"
      ? instasellStoryEmbedConfig.currentProductId ?? ""
      : instasellStoryEmbedConfig.currentCollectionId ?? "";

  const api = useApi();
  const handleActiveVideoId = async (storyId: string) => {
    const story = stories.find((story) => story.i === storyId);
    if (!story) {
      return;
    }
    try {
      const pageType = instasellStoryEmbedConfig?.getPageType();
      const trackingPromises = story.sv.map(async (video) => {
        await api.shortVideosBoron({
          eventType: "shortVideoClick",
          shortVideoView: {
            shortVideoId: video.i,
          },
          source: "story",
          pageType,
          pageId,
        });
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

        if (googleAnalyticsEnabled) {
          gaEvents.trackClick(
            "video-story",
            instasellStoryEmbedConfig.pageType,
            video.m[0].v,
            useGtmForAnalytics
          );
        }
        if (clevertapAnalyticsEnabled) {
          caEvents.trackClick(
            "video-story",
            instasellStoryEmbedConfig.pageType,
            video.m[0].v
          );
        }
        if (metaRetargetingEnabled) {
          fbEvents.trackClick(
            "video-story",
            instasellStoryEmbedConfig.pageType,
            video.m[0].v
          );
        }
      });

      await Promise.all(trackingPromises);
    } catch (error) {
      console.log(`%cError tracking clicks: ${error}`, "color: red;");
    }
  };

  const handleActiveStoryChange = (id: string, e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setActiveStoryId(id);
  };
  const feedWrapperRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [windowWidth, setWindowWidth] = useState<number>(0);
  useEffect(() => {
    const updateWidth = () => {
      if (feedWrapperRef.current) {
        setContainerWidth(feedWrapperRef.current.offsetWidth);
      }
    };

    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  const calculateStoriesWidth = () => {
    const isMobile = windowWidth < 640;
    const storyWidth = isMobile ? 90 : 120;
    const paddingPerStory = 2; // 5px left + 5px right

    return stories.length * (storyWidth + paddingPerStory);
  };

  const getJustifyContent = () => {
    const requiredWidth = calculateStoriesWidth();
    return containerWidth > requiredWidth ? "center" : "start";
  };

  useEffect(() => {
    const updateDimensions = () => {
      if (feedWrapperRef.current) {
        setContainerWidth(feedWrapperRef.current.offsetWidth);
      }
      setWindowWidth(window.innerWidth);
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  return (
    <>
      {/* Story Section Title */}
      {storyTitleText && (
        <div className="ins-story-section-title">{storyTitleText}</div>
      )}

      <div
        style={{ justifyContent: getJustifyContent() }}
        ref={feedWrapperRef}
        className="ins-story-feed"
      >
        {stories.map((story) => (
          <div
            key={story.i}
            className="ins-story-item"
            onClick={(e) => {
              handleActiveStoryChange(story.i, e);
              handleActiveVideoId(story.i);
            }}
            style={{
              position: "relative",
              zIndex: 1,
            }}
          >
            <div
              className="ins-story-circle-wrapper"
              style={{ position: "relative" }}
            >
              {story.tu.length != 0 ? (
                <img
                  src={story.tu}
                  alt={story.t}
                  className="ins-story-image"
                  style={{ pointerEvents: "none" }}
                />
              ) : (
                <video
                  src={story.sv[0].m[0].v}
                  className="ins-story-video"
                  autoPlay={true}
                  muted
                  playsInline
                  loop
                  style={{ pointerEvents: "none" }}
                />
              )}
            </div>
            {story.t !== "New Collection" && (
              <span className="ins-story-title">{story.t}</span>
            )}
          </div>
        ))}
      </div>
      {activeStoryId && <StoryModal />}
    </>
  );
};

export default StoryFeed;
