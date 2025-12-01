import { createContext } from "preact";
import type { ComponentChildren } from "preact";
import { useContext, useEffect, useState } from "preact/hooks";
import { APP_NAME } from "../lib/constants";

declare global {
  interface Window {
    fbq: (
      command: string,
      eventName: string,
      params?: Record<string, any>,
      eventId?: string
    ) => void;
  }
}

interface MetaEventsContextType {
  isMetaLoaded: boolean;
  trackEvent: (eventName: string, params: Record<string, any>) => void;
  trackImpression: (widget: string, pageType: string) => void;
  trackClick: (widget: string, pageType: string, videoUrl: string) => void;
  trackView: (
    widget: string,
    pageType: string,
    videoUrl: string,
    percentViewed?: number
  ) => void;
  trackAddToCart: (
    productId: string,
    quantity: number,
    variantId: string,
    widget: string,
    pageType: string,
    videoUrl: string
  ) => void;
}

const MetaEventsContext = createContext<MetaEventsContextType>(null as never);

interface Props {
  children: ComponentChildren;
  debug?: boolean;
}

export const MetaEventsProvider = ({ children, debug = false }: Props) => {
  const [isMetaLoaded, setIsMetaLoaded] = useState(false);
  const viewerToken = localStorage?.getItem("__IS_VTOK") ?? undefined;

  useEffect(() => {
    const checkMeta = () => {
      if (typeof window.fbq === "function") {
        setIsMetaLoaded(true);
        if (debug) console.log("[MetaEvents] Meta Pixel ready");
      } else if (debug) {
        console.warn("[MetaEvents] Meta Pixel not detected");
      }
    };

    checkMeta();
    const timeout = setTimeout(checkMeta, 2000);
    return () => clearTimeout(timeout);
  }, []);

  const trackEvent = (eventName: string, params: Record<string, any>) => {
    if (!isMetaLoaded) {
      if (debug) console.warn(`[MetaEvents] Event ${eventName} skipped - Pixel not loaded`);
      return;
    }

    const enhancedParams = {
      ...params,
      content_name: APP_NAME,
      viewer_token: viewerToken,
      timestamp: Date.now(),
    };

    if (debug) console.log(`[MetaEvents] Tracking: ${eventName}`, enhancedParams);
    
    try {
      window.fbq("trackCustom", eventName, enhancedParams);
    } catch (error) {
      console.log(`%c[MetaEvents] Failed to track event ${error}`, "color: red;")
    }
  };

  const value: MetaEventsContextType = {
    isMetaLoaded,
    trackEvent,
    
    trackImpression: (widget, pageType) => {
      trackEvent(`${APP_NAME}_Impression`, {
        widget,
        page_type: pageType,
        event_source: "shoppable_video",
      });
    },

    trackClick: (widget, pageType, videoUrl) => {
      trackEvent(`${APP_NAME}_VideoClick`, {
        widget,
        page_type: pageType,
        video_url: videoUrl,
        interaction_type: "click",
      });
    },

    trackView: (widget, pageType, videoUrl, percentViewed = 25) => {
      trackEvent(`${APP_NAME}_VideoView`, {
        widget,
        page_type: pageType,
        video_url: videoUrl,
        video_percent_viewed: percentViewed,
        view_duration: percentViewed === 100 ? "complete" : "partial",
      });
    },

    trackAddToCart: (productId, quantity, variantId, widget, pageType, videoUrl) => {
      trackEvent(`${APP_NAME}_AddToCart`, {
        product_id: productId,
        quantity,
        variant_id: variantId,
        widget,
        page_type: pageType,
        video_url: videoUrl,
        event_source: "shoppable_video",
        currency: "USD", // You may want to make this dynamic
      });
    },
  };

  return (
    <MetaEventsContext.Provider value={value}>
      {children}
    </MetaEventsContext.Provider>
  );
};

export const useMetaEvents = () => {
  const context = useContext(MetaEventsContext);
  if (!context) {
    throw new Error("useMetaEvents must be used within MetaEventsProvider");
  }
  return context;
};