import { useEffect, useRef } from "preact/hooks";
import { useApi } from "../lib/api";
import { VideoViewsQueue } from "../types/api";
import { useShortVideosModalContext } from "./ShortVideosModalContext";
import { instasellLiveEmbedConfig } from "..";

export const useVideoViews = () => {
  const api = useApi();
  const viewsQueue = useRef<VideoViewsQueue>({});
  const isProcessing = useRef(false);
  const flushInterval = 10000;
  const maxQueueSize = 50;
  const isMounted = useRef(true);
  const { shortVideoSessionToken } = useShortVideosModalContext();

  const getTotalViews = (): number => {
    return Object.values(viewsQueue.current).reduce(
      (total, video) => total + video.views,
      0
    );
  };

  const flush = async () => {
    if (
      !isMounted.current ||
      isProcessing.current ||
      Object.keys(viewsQueue.current).length === 0
    ) {
      return;
    }

    isProcessing.current = true;
    const viewsToSend = { ...viewsQueue.current };
    viewsQueue.current = {};

    const pageType = instasellLiveEmbedConfig.getPageType?.();
    const pageId =
      pageType == "home"
        ? ""
        : pageType == "product"
        ? instasellLiveEmbedConfig.currentProductId ?? ""
        : instasellLiveEmbedConfig.currentCollectionId ?? "";

    try {
      await api.shortVideosBoron({
        eventType: "shortVideoView",
        videoViewsQueue: viewsToSend,
        source: "carousel",
        pageId,
        pageType,
      });

      if (!isMounted.current) {
        return;
      }
    } catch (error) {
      console.log(`%cFailed to flush views ${error}`, "color: red;")

      if (isMounted.current) {
        Object.entries(viewsToSend).forEach(([videoId, data]) => {
          if (!viewsQueue.current[videoId]) {
            viewsQueue.current[videoId] = data;
          } else {
            viewsQueue.current[videoId].views += data.views;
            viewsQueue.current[videoId].metadata.lastViewed = Math.max(
              viewsQueue.current[videoId].metadata.lastViewed,
              data.metadata.lastViewed
            );
          }
        });
      }
    } finally {
      if (isMounted.current) {
        isProcessing.current = false;
      }
      sessionStorage.setItem("sessionTime", Date.now().toString());
    }
  };

  const flushSync = () => {
    if (Object.keys(viewsQueue.current).length === 0) return;

    try {
      api.shortVideosBoron({
        eventType: "shortVideoView",
        videoViewsQueue: viewsQueue.current,
        source: "carousel",
      });
      viewsQueue.current = {};
    } catch (error) {
      console.log(`%cFailed to flush views during cleanup ${error}`, "color: red;")
    } finally {
      viewsQueue.current = {};
      sessionStorage.setItem("sessionTime", Date.now().toString());
    }
  };

  const trackView = (videoId: string) => {
    if (!isMounted.current) return;

    if (!viewsQueue.current[videoId]) {
      viewsQueue.current[videoId] = {
        views: 0,
        metadata: {
          lastViewed: Date.now(),
        },
      };
    }

    viewsQueue.current[videoId].views++;
    viewsQueue.current[videoId].metadata.lastViewed = Date.now();

    if (getTotalViews() >= maxQueueSize) {
      flush();
    }
  };

  useEffect(() => {
    isMounted.current = true;

    const timer = setInterval(() => {
      if (isMounted.current) {
        flush();
      }
    }, flushInterval);

    const handleBeforeUnload = () => {
      flushSync();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flush();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted.current = false;
      clearInterval(timer);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      if (Object.keys(viewsQueue.current).length > 0) {
        flushSync();
      }
    };
  }, []);

  return { trackView };
};
