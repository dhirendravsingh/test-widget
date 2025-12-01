import { createContext } from "preact";
import type { ComponentChildren } from "preact";
import { useContext } from "preact/hooks";
import { APP_NAME } from "../lib/constants";

declare global {
  interface Window {
    gtag: (command: string, eventName: string, params?: any) => void;
    dataLayer: any[];
  }
}

interface GAEventsContextType {
  trackImpression: (widget: string, pageType: string, useGtm?: boolean) => void;
  trackClick: (
    widget: string,
    pageType: string,
    videoUrl: string,
    useGtm?: boolean
  ) => void;
  trackView: (
    widget: string,
    pageType: string,
    videoUrl: string,
    useGtm?: boolean
  ) => void;
  trackAddToCart: (
    productId: string,
    quantity: number,
    variantId: string,
    widget: string,
    pageType: string,
    videoUrl: string,
    useGtm?: boolean
  ) => void;
}

const GAEventsContext = createContext<GAEventsContextType>(null as never);

interface Props {
  children: ComponentChildren;
}

export const GAEventsProvider = ({ children }: Props) => {
  const canTrackGA = typeof window.gtag === "function";
  const canTrackGTM =
    typeof window.dataLayer === "object" && Array.isArray(window.dataLayer);
  const viewerToken = localStorage?.getItem("__IS_VTOK") ?? undefined;

  const value: GAEventsContextType = {
    trackImpression: (widget: string, pageType: string, useGtm = false) => {
      if (useGtm && canTrackGTM) {
        window.dataLayer.push({
          event: `impression_${APP_NAME}`,
          app_name: APP_NAME,
          widget,
          page_Type: pageType,
          viewer_Token: viewerToken,
        });
      } else if (!useGtm && canTrackGA) {
        window.gtag("event", `impression_${APP_NAME}`, {
          app_name: APP_NAME,
          widget,
          page_Type: pageType,
          viewer_Token: viewerToken,
        });
      }
    },

    trackClick: (
      widget: string,
      pageType: string,
      videoUrl: string,
      useGtm = false
    ) => {
      if (useGtm && canTrackGTM) {
        window.dataLayer.push({
          event: `video_click_${APP_NAME}`,
          app_name: APP_NAME,
          widget,
          page_Type: pageType,
          viewer_Token: viewerToken,
          video_url: videoUrl,
        });
      } else if (!useGtm && canTrackGA) {
        window.gtag("event", `video_click_${APP_NAME}`, {
          app_name: APP_NAME,
          widget,
          page_Type: pageType,
          viewer_Token: viewerToken,
          video_url: videoUrl,
        });
      }
    },

    trackView: (
      widget: string,
      pageType: string,
      videoUrl: string,
      useGtm = false
    ) => {
      if (useGtm && canTrackGTM) {
        window.dataLayer.push({
          event: `video_view_${APP_NAME}`,
          app_name: APP_NAME,
          widget,
          page_Type: pageType,
          viewer_Token: viewerToken,
          video_url: videoUrl,
        });
      } else if (!useGtm && canTrackGA) {
        window.gtag("event", `video_view_${APP_NAME}`, {
          app_name: APP_NAME,
          widget,
          page_Type: pageType,
          viewer_Token: viewerToken,
          video_url: videoUrl,
        });
      }
    },

    trackAddToCart: (
      productId: string,
      quantity: number,
      variantId: string,
      widget: string,
      pageType: string,
      videoUrl: string,
      useGtm = false
    ) => {
      if (useGtm && canTrackGTM) {
        window.dataLayer.push({
          event: `add_to_cart_${APP_NAME}`,
          app_name: APP_NAME,
          product_id: productId,
          widget,
          page_Type: pageType,
          viewer_Token: viewerToken,
          video_url: videoUrl,
          quantity,
          variant_id: variantId,
        });
      } else if (!useGtm && canTrackGA) {
        window.gtag("event", `add_to_cart_${APP_NAME}`, {
          app_name: APP_NAME,
          product_id: productId,
          widget,
          page_Type: pageType,
          viewer_Token: viewerToken,
          video_url: videoUrl,
          quantity,
          variant_id: variantId,
        });
      }
    },
  };

  return (
    <GAEventsContext.Provider value={value}>
      {children}
    </GAEventsContext.Provider>
  );
};

export const useGAEvents = () => useContext(GAEventsContext);
