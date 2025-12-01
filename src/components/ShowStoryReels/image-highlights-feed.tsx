import { useEffect, useRef, useState } from "preact/hooks";
import { useStoryVideosModalContext } from "../../context/StoryVideosModalContext";
import { useApi } from "../../lib/api";
import { useGAEvents } from "../../context/GoogleAnalytics";
import { instasellStoryEmbedConfig } from "../../story-index";
import { useCleverTapEvents } from "../../context/ClevertapAnalytics";
import { useMetaEvents } from "../../context/MetaEventsContext";

const HighlightFeed = () => {
  const {
    highlights,
    storySessionToken,
    googleAnalyticsEnabled,
    useGtmForAnalytics,
    clevertapAnalyticsEnabled,
    metaRetargetingEnabled,
  } = useStoryVideosModalContext();

  const hasTrackedClick = useRef(false);
  const gaEvents = useGAEvents();
  const fbEvents = useMetaEvents();
  const caEvents = useCleverTapEvents();
  const api = useApi();

  const pageType = instasellStoryEmbedConfig.getPageType?.();
  const pageId =
    pageType == "home"
      ? ""
      : pageType == "product"
      ? instasellStoryEmbedConfig.currentProductId ?? ""
      : instasellStoryEmbedConfig.currentCollectionId ?? "";

  const handleHighlightClick = async (highlightId: string) => {
    if (!hasTrackedClick.current) {
      const highlight = highlights.find((h) => h.i === highlightId);
      if (!highlight) {
        return;
      }
      try {
        await api.shortVideosBoron({
          eventType: "shortVideoClick",
          source: "highlight",
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
            "image-highlight",
            instasellStoryEmbedConfig.pageType,
            highlight.ru || window.location.href,
            useGtmForAnalytics
          );
        }
        if (clevertapAnalyticsEnabled) {
          caEvents.trackClick(
            "image-highlight",
            instasellStoryEmbedConfig.pageType,
            highlight.ru || window.location.href
          );
        }
        if (metaRetargetingEnabled) {
          fbEvents.trackClick(
            "image-highlight",
            instasellStoryEmbedConfig.pageType,
            highlight.ru || window.location.href
          );
        }

        hasTrackedClick.current = true;
      } catch (error) {
        console.log(
          `%cError tracking highlight click: ${error}`,
          "color: red;"
        );
      }
    }
  };

  const handleHighlightSelect = (id: string, e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const highlight = highlights.find((h) => h.i === id);
    if (highlight) {
      if (highlight.ru) {
        window.location.href = highlight.ru;
      } else {
        window.location.reload();
      }
    }
  };

  const feedWrapperRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);

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

  return (
    <div
      style={{ justifyContent: containerWidth > 700 ? "center" : "start" }}
      ref={feedWrapperRef}
      className="ins-highlight-feed"
    >
      {highlights.map((highlight) => (
        <div
          key={highlight.i}
          className="ins-highlight-item"
          onClick={(e) => {
            handleHighlightSelect(highlight.i, e);
            // handleHighlightClick(highlight.i);
          }}
          style={{
            position: "relative",
            zIndex: 1,
            cursor: "pointer",
          }}
        >
          <div className="ins-highlight-circle-wrapper">
            <img
              src={highlight.tu}
              alt={highlight.t}
              className="ins-highlight-image"
              style={{ pointerEvents: "none" }}
            />
          </div>
          <span className="ins-highlight-title">{highlight.t}</span>
        </div>
      ))}
    </div>
  );
};

export default HighlightFeed;
