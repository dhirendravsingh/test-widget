import { createContext } from "preact";
import type { ComponentChildren } from "preact";
import { useContext } from "preact/hooks";
import { APP_NAME } from "../lib/constants";

declare global {
  interface Window {
    clevertap: {
      event: {
        push: (eventName: string, eventData?: Record<string, any>) => void;
      };
    };
  }
}

interface CleverTapEventsContextType {
  trackImpression: (widget: string, pageType: string) => void;
  trackClick: (widget: string, pageType: string, videoUrl: string) => void;
  trackView: (widget: string, pageType: string, videoUrl: string) => void;
  trackAddToCart: (
    productId: string,
    quantity: number,
    variantId: string,
    widget: string,
    pageType: string,
    videoUrl: string
  ) => void;
}

const CleverTapEventsContext = createContext<CleverTapEventsContextType>(null as never);

interface Props {
  children: ComponentChildren;
}

export const CleverTapEventsProvider = ({ children }: Props) => {
  const canTrackCleverTap = typeof window.clevertap !== "undefined";
  const viewerToken = localStorage?.getItem("__IS_VTOK") ?? undefined;

  const value: CleverTapEventsContextType = {
    trackImpression: (widget: string, pageType: string) => {
      if (!canTrackCleverTap) return;
      window.clevertap.event.push(`Impression_${APP_NAME}`, {
        app_name: APP_NAME,
        widget,
        page_Type: pageType,
        viewer_Token: viewerToken,
      });
    },

    trackClick: (widget: string, pageType: string, videoUrl: string) => {
      if (!canTrackCleverTap) return;
      window.clevertap.event.push(`Video_Click_${APP_NAME}`, {
        app_name: APP_NAME,
        widget,
        page_Type: pageType,
        viewer_Token: viewerToken,
        video_url: videoUrl,
      });
    },

    trackView: (widget: string, pageType: string, videoUrl: string) => {
      if (!canTrackCleverTap) return;
      window.clevertap.event.push(`Video_View_${APP_NAME}`, {
        app_name: APP_NAME,
        widget,
        page_Type: pageType,
        viewer_Token: viewerToken,
        video_url: videoUrl,
      });
    },

    trackAddToCart: (
      productId: string,
      quantity: number,
      variantId: string,
      widget: string,
      pageType: string,
      videoUrl: string
    ) => {
      if (!canTrackCleverTap) return;
      window.clevertap.event.push(`Add_To_Cart_${APP_NAME}`, {
        app_name: APP_NAME,
        product_id: productId,
        widget,
        page_Type: pageType,
        viewer_Token: viewerToken,
        video_url: videoUrl,
        quantity,
        variant_id: variantId,
      });
    },
  };

  return (
    <CleverTapEventsContext.Provider value={value}>
      {children}
    </CleverTapEventsContext.Provider>
  );
};

export const useCleverTapEvents = () => useContext(CleverTapEventsContext);