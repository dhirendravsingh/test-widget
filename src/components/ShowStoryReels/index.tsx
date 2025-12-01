import { useEffect, useRef } from "preact/hooks";
import StoryFeed from "./story-reels-feed";
import HighlightFeed from "./image-highlights-feed";
import StoryFeedSkeleton from "./story-reels-feed-skeleton";
import { useStoryVideosModalContext } from "../../context/StoryVideosModalContext";
import { instasellStoryEmbedConfig } from "../../story-index";
import { useApi } from "../../lib/api";
import { useGAEvents } from "../../context/GoogleAnalytics";
import { useCleverTapEvents } from "../../context/ClevertapAnalytics";
import { useMetaEvents } from "../../context/MetaEventsContext";

const ShowStoryReels = ({
  isNearViewport,
  storyName,
}: {
  isNearViewport: boolean;
  storyName: string;
}) => {
  const {
    setStories,
    setHighlights,
    setIsLoadingShortVideos,
    isLoadingShortVideos,
    setPurchaseFlowAction,
    setShowFeed,
    setShowHighlights,
    storySessionToken,
    setGoogleAnalyticsEnabled,
    googleAnalyticsEnabled,
    useGtmForAnalytics,
    setUseGtmForAnalytics,
    clevertapAnalyticsEnabled,
    setClevertapAnalyticsEnabled,
    showFeed,
    stories,
    setShopNowText,
    showHighlights,
    metaRetargetingEnabled,
    setMetaRetargetingEnabled,
    setDiscountBadgeEnabled,
    setDisplayAllProductImagesEnabled,
    setComparePriceEnabled,
    setStoreFrontCartOperation,
    setStoreFrontAccessKey,
    setIsCustomPage,
    setCustomPageRoute,

    setVideoBehavior,

    // Story Title Settings
    setStoryTitleText,
  } = useStoryVideosModalContext();

  const api = useApi();
  const hasTrackedImpression = useRef(false);
  const feedRef = useRef<HTMLDivElement>(null);
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

  const shouldShowHighlights = () => {
    const container = document.getElementById("instasell-live-story-reels");
    return container?.dataset.highlight === "true";
  };

  useEffect(() => {
    if (!isNearViewport) {
      return;
    }

    (async () => {
      try {
        let isCustomPage: boolean = false;
        let customPageRoute: string = "";

        if (
          "__custom_page" in window &&
          typeof window.__custom_page === "boolean"
        ) {
          setIsCustomPage(true);
          isCustomPage = true;
          if (
            "__custom_page_route" in window &&
            typeof window.__custom_page_route === "string"
          ) {
            setCustomPageRoute(window.__custom_page_route);
            customPageRoute = window.__custom_page_route;
          }
        }

        const pageType = instasellStoryEmbedConfig.pageType;
        let pageId = "";

        if (pageType === "product") {
          pageId =
            instasellStoryEmbedConfig.currentProductId ??
            ((window as any).__st &&
              (window as any).__st.p === "product" &&
              (window as any).__st.rid);
        } else if (pageType === "collection") {
          pageId =
            instasellStoryEmbedConfig.currentCollectionId ??
            ((window as any).__st &&
              (window as any).__st.p === "collection" &&
              (window as any).__st.rid);
        }

        if (shouldShowHighlights()) {
          // Highlights flow
          const highlightsResponse = await api.getHighlights({
            originFqdn: instasellStoryEmbedConfig.getShopDomain(),
            pageType,
            pageId: pageId.toString(),
          });

          if (highlightsResponse.hs && highlightsResponse.hs.length > 0) {
            const selectedHighlight = highlightsResponse.hs.find(
              (highlight: any) => highlight.n === storyName
            );
            if (selectedHighlight) {
              setHighlights(selectedHighlight?.h);
              setPurchaseFlowAction(highlightsResponse.pf);
              setGoogleAnalyticsEnabled(highlightsResponse.ga);
              setUseGtmForAnalytics(highlightsResponse.gt);
              setClevertapAnalyticsEnabled(highlightsResponse.ca);

              const styleTag = document.createElement("style");
              styleTag.innerHTML = highlightsResponse.cs as string;
              document.head.insertBefore(styleTag, document.head.children[0]);

              setShowHighlights(true);
              setShowFeed(false);
            } else {
              setShowFeed(false);
            }
          } else {
            setShowHighlights(false);
          }
        } else {
          // Stories flow
          const storiesResponse = await api.getStories({
            originFqdn: instasellStoryEmbedConfig.getShopDomain(),
            pageType,
            pageId: pageId.toString(),
            customPageRoute: customPageRoute,
          });

          console.log(storiesResponse);

          if (storiesResponse.ss && storiesResponse.ss.length > 0) {
            const selectedStory = storiesResponse.ss.find(
              (story: any) => story.n === storyName
            );

            if (selectedStory) {
              setStories(selectedStory.s);
              setPurchaseFlowAction(storiesResponse.pf);
              setGoogleAnalyticsEnabled(storiesResponse.ga);
              setUseGtmForAnalytics(storiesResponse.gt);
              setClevertapAnalyticsEnabled(storiesResponse.ca);
              setMetaRetargetingEnabled(storiesResponse.mr);
              setShopNowText(storiesResponse.st);
              setDiscountBadgeEnabled(storiesResponse.db);
              setDisplayAllProductImagesEnabled(storiesResponse.da);
              setComparePriceEnabled(storiesResponse.ce);
              setStoreFrontAccessKey(storiesResponse.sa ?? "");

              // Set story title settings
              setStoryTitleText(storiesResponse.stt || "");

              // Handle custom CTA and behavior for the first story's first video
              if (
                selectedStory.s.length > 0 &&
                selectedStory.s[0].sv &&
                selectedStory.s[0].sv.length > 0
              ) {
                const firstVideo = selectedStory.s[0].sv[0];
                if (firstVideo.b !== undefined) {
                  setVideoBehavior(firstVideo.b);
                }
              }

              if (
                "storeFrontApiAccessKey" in window &&
                typeof window.storeFrontApiAccessKey === "string"
              ) {
                setStoreFrontAccessKey(window.storeFrontApiAccessKey);
              } else {
                setStoreFrontAccessKey(storiesResponse.sa ?? "");
              }

              const storeFrontCartOperation = (window as any).__headless_env__;

              if (storeFrontCartOperation) {
                setStoreFrontCartOperation(true);
              }

              const styleTag = document.createElement("style");
              styleTag.innerHTML = storiesResponse.cs as string;
              document.head.insertBefore(styleTag, document.head.children[0]);

              setShowFeed(true);
              setShowHighlights(false);
            } else {
              setShowFeed(false);
              setHighlights([]);
              setShowHighlights(false);
            }
          } else {
            setShowFeed(false);
            setHighlights([]);
            setShowHighlights(false);
          }
        }
      } catch (error) {
        console.log(`%cError loading content: ${error}`, "color: red;");

        setStories([]);
        setHighlights([]);
        setShowFeed(false);
        setShowHighlights(false);
      } finally {
        setIsLoadingShortVideos(false);
      }
    })();
  }, [
    isNearViewport,
    instasellStoryEmbedConfig.currentProductId,
    instasellStoryEmbedConfig.currentCollectionId,
    instasellStoryEmbedConfig.pageType,
    storyName,
  ]);

  useEffect(() => {
    if (!showFeed && !showHighlights) {
      return;
    }

    const feedElement = feedRef.current?.querySelector(
      showHighlights ? ".ins-highlight-feed" : ".ins-story-feed"
    );

    if (!feedElement) {
      return;
    }

    const observerOptions = {
      root: null,
      rootMargin: "0px",
      threshold: 0.1,
    };

    const observer = new IntersectionObserver((entries) => {
      const feedEntry = entries[0];

      if (feedEntry.isIntersecting && !hasTrackedImpression.current) {
        try {
          api
            .shortVideosBoron({
              eventType: "shortVideoImpression",
              source: showHighlights ? "highlight" : "story",
              pageType,
              pageId,
            })
            .then(() => {
              hasTrackedImpression.current = true;
              sessionStorage.setItem("sessionTime", Date.now().toString());
              observer.disconnect();
            })
            .catch((error) => {
              console.log(`%cAPI call failed: ${error}`, "color: red;");
            });

          if (googleAnalyticsEnabled) {
            gaEvents.trackImpression(
              showHighlights ? "image-highlight" : "video-story",
              instasellStoryEmbedConfig.pageType,
              useGtmForAnalytics
            );
          }
          if (clevertapAnalyticsEnabled) {
            caEvents.trackImpression(
              showHighlights ? "image-highlight" : "video-story",
              instasellStoryEmbedConfig.pageType
            );
          }
          if (metaRetargetingEnabled) {
            fbEvents.trackImpression(
              showHighlights ? "image-highlight" : "video-story",
              instasellStoryEmbedConfig.pageType
            );
          }
        } catch (error) {
          console.log(
            `%cFailed to track feed impression: ${error}`,
            "color: red;"
          );
        }
      }
    }, observerOptions);

    observer.observe(feedElement);

    return () => {
      observer.disconnect();
    };
  }, [
    showFeed,
    showHighlights,
    feedRef.current,
    gaEvents,
    googleAnalyticsEnabled,
    clevertapAnalyticsEnabled,
    api,
  ]);

  return (
    <div ref={feedRef} className="ins-story-reels-container">
      {isLoadingShortVideos ? (
        <StoryFeedSkeleton />
      ) : showHighlights ? (
        <HighlightFeed />
      ) : showFeed ? (
        <StoryFeed />
      ) : null}
    </div>
  );
};

export default ShowStoryReels;
