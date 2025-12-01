import { createContext } from "preact";
import React, { memo } from "preact/compat";
import { useContext, useMemo, useState } from "preact/hooks";
import { ShortVideo } from "../types/api";

type IVideoPopContext = {
  shortVideos: ShortVideo[];
  setShortVideos: (shortVideos: ShortVideo[]) => void;
  shortVideo: ShortVideo | null; // Changed to allow null
  setShortVideo: (video: ShortVideo | null) => void; // Updated to match
  isLoadingShortVideos: boolean;
  setIsLoadingShortVideos: (isLoadingShortVideo: boolean) => void;
  isDesktop: boolean;
  setIsDesktop: (isDesktop: boolean) => void;
  activeVideoId: string | null;
  setActiveVideoId: (activeVideoId: string | null) => void;
  isPipActive: boolean;
  setIsPipActive: (isPipActive: boolean) => void;
  customCode: string | null;
  setCustomCode: (code: string | null) => void;
  isProductDetailsModalOpen: boolean;
  setIsProductDetailsModalOpen: (isProductDetailsModalOpen: boolean) => void;
  googleAnalyticsEnabled: boolean;
  setGoogleAnalyticsEnabled: (value: boolean) => void;
  useGtmForAnalytics: boolean;
  setUseGtmForAnalytics: (value: boolean) => void;
  videoPipSessionToken: string;
  setVideoPipSessionToken: (val: string) => void;
  purchaseFlowAction: "popUp" | "pdp" | "customCode";
  setPurchaseFlowAction: (action: "popUp" | "pdp" | "customCode") => void;
  clevertapAnalyticsEnabled: boolean;
  setClevertapAnalyticsEnabled: (value: boolean) => void;
  closeVideoPipWhenClosedFromFullScreenMode: boolean;
  setCloseVideoPipWhenClosedFromFullScreenMode: (value: boolean) => void;
  metaRetargetingEnabled: boolean;
  setMetaRetargetingEnabled: (value: boolean) => void;
  showTaggedVideos: boolean;
  setShowTaggedVideos: (showTaggedVideos: boolean) => void;
  discountBadgeEnabled: boolean;
  setDiscountBadgeEnabled: (value: boolean) => void;
  displayAllProductImagesEnabled: boolean;
  setDisplayAllProductImagesEnabled: (value: boolean) => void;
  comparePriceEnabled: boolean;
  setComparePriceEnabled: (value: boolean) => void;
  storeFrontCartOperation: boolean;
  setStoreFrontCartOperation: (value: boolean) => void;
  storeFrontAccessKey: string;
  setStoreFrontAccessKey: (val: string) => void;

  videoBehavior: number;
  setVideoBehavior: (behavior: number) => void;
  enableStoryModeOnClose: boolean;
  setEnableStoryModeOnClose: (value: boolean) => void;
};

const initialContext: IVideoPopContext = {
  shortVideos: [],
  setShortVideos: () => {},
  shortVideo: null,
  setShortVideo: () => {},
  isLoadingShortVideos: true,
  setIsLoadingShortVideos: () => {},
  isDesktop: false,
  setIsDesktop: () => {},
  activeVideoId: null,
  setActiveVideoId: () => {},
  isPipActive: false,
  setIsPipActive: () => {},
  customCode: null,
  setCustomCode: () => {},
  isProductDetailsModalOpen: false,
  setIsProductDetailsModalOpen: () => {},
  googleAnalyticsEnabled: false,
  setGoogleAnalyticsEnabled: () => {},
  useGtmForAnalytics: false,
  setUseGtmForAnalytics: () => {},
  videoPipSessionToken: "",
  setVideoPipSessionToken: () => {},
  purchaseFlowAction: "popUp",
  setPurchaseFlowAction: (action: "popUp" | "pdp" | "customCode") => {},
  clevertapAnalyticsEnabled: false,
  setClevertapAnalyticsEnabled: () => {},
  closeVideoPipWhenClosedFromFullScreenMode: false,
  setCloseVideoPipWhenClosedFromFullScreenMode: () => {},
  metaRetargetingEnabled: false,
  setMetaRetargetingEnabled: () => {},
  showTaggedVideos: false,
  setShowTaggedVideos: () => {},
  discountBadgeEnabled: false,
  setDiscountBadgeEnabled: () => {},
  displayAllProductImagesEnabled: false,
  setDisplayAllProductImagesEnabled: () => {},
  comparePriceEnabled: false,
  setComparePriceEnabled: () => {},
  storeFrontCartOperation: false,
  setStoreFrontCartOperation: () => {},
  storeFrontAccessKey: "",
  setStoreFrontAccessKey: () => {},

  videoBehavior: 0,
  setVideoBehavior: () => {},
  enableStoryModeOnClose: true,
  setEnableStoryModeOnClose: () => {},
};

const VideoPopContext = createContext<IVideoPopContext>(initialContext);

export const VideoPopContextProvider = memo(function VideoPopContextProvider({
  children,
}: React.PropsWithChildren) {
  const [isLoadingShortVideos, setIsLoadingShortVideos] = useState(true);
  const [shortVideos, setShortVideos] = useState<ShortVideo[]>([]);
  const [shortVideo, setShortVideo] = useState<ShortVideo | null>(null);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [isPipActive, setIsPipActive] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth > 600);
  const [customCode, setCustomCode] = useState<string | null>(null);
  const [isProductDetailsModalOpen, setIsProductDetailsModalOpen] =
    useState(false);
  const [googleAnalyticsEnabled, setGoogleAnalyticsEnabled] =
    useState<boolean>(false);
  const [useGtmForAnalytics, setUseGtmForAnalytics] = useState<boolean>(false);
  const [metaRetargetingEnabled, setMetaRetargetingEnabled] =
    useState<boolean>(false);
  const [videoPipSessionToken, setVideoPipSessionToken] = useState<string>("");
  const [clevertapAnalyticsEnabled, setClevertapAnalyticsEnabled] =
    useState<boolean>(false);
  const [
    closeVideoPipWhenClosedFromFullScreenMode,
    setCloseVideoPipWhenClosedFromFullScreenMode,
  ] = useState<boolean>(false);
  const [showTaggedVideos, setShowTaggedVideos] = useState<boolean>(false);
  const [discountBadgeEnabled, setDiscountBadgeEnabled] =
    useState<boolean>(false);
  const [displayAllProductImagesEnabled, setDisplayAllProductImagesEnabled] =
    useState<boolean>(false);
  const [comparePriceEnabled, setComparePriceEnabled] =
    useState<boolean>(false);
  const [storeFrontCartOperation, setStoreFrontCartOperation] =
    useState<boolean>(false);
  const [storeFrontAccessKey, setStoreFrontAccessKey] = useState<string>("");

  const [videoBehavior, setVideoBehavior] = useState<number>(0);
  const [enableStoryModeOnClose, setEnableStoryModeOnClose] =
    useState<boolean>(false);

  const [purchaseFlowAction, setPurchaseFlowAction] = useState<
    "popUp" | "pdp" | "customCode"
  >("popUp");

  const handleSetActiveVideoId = (videoId: string | null) => {
    setActiveVideoId(videoId);
    if (videoId) {
      localStorage.setItem("__IS_LAST_ACTIVE_SV", videoId);
    }
  };

  const videoPopContext = useMemo<IVideoPopContext>(
    () => ({
      isLoadingShortVideos,
      setIsLoadingShortVideos,
      shortVideo,
      setShortVideo,
      activeVideoId,
      setActiveVideoId: handleSetActiveVideoId,
      isPipActive,
      setIsPipActive,
      isDesktop,
      setIsDesktop,
      customCode,
      setCustomCode,
      isProductDetailsModalOpen,
      setIsProductDetailsModalOpen,
      googleAnalyticsEnabled,
      setGoogleAnalyticsEnabled,
      useGtmForAnalytics,
      setUseGtmForAnalytics,
      setVideoPipSessionToken,
      videoPipSessionToken,
      purchaseFlowAction,
      setPurchaseFlowAction,
      clevertapAnalyticsEnabled,
      setClevertapAnalyticsEnabled,
      closeVideoPipWhenClosedFromFullScreenMode,
      setCloseVideoPipWhenClosedFromFullScreenMode,
      setMetaRetargetingEnabled,
      metaRetargetingEnabled,
      shortVideos,
      setShortVideos,
      setShowTaggedVideos,
      showTaggedVideos,
      discountBadgeEnabled,
      setDiscountBadgeEnabled,
      displayAllProductImagesEnabled,
      setDisplayAllProductImagesEnabled,
      comparePriceEnabled,
      setComparePriceEnabled,
      storeFrontCartOperation,
      setStoreFrontCartOperation,
      storeFrontAccessKey,
      setStoreFrontAccessKey,

      videoBehavior,
      setVideoBehavior,
      enableStoryModeOnClose,
      setEnableStoryModeOnClose,
    }),
    [
      isLoadingShortVideos,
      shortVideo,
      activeVideoId,
      isPipActive,
      isDesktop,
      customCode,
      googleAnalyticsEnabled,
      useGtmForAnalytics,
      videoPipSessionToken,
      isProductDetailsModalOpen,
      purchaseFlowAction,
      clevertapAnalyticsEnabled,
      closeVideoPipWhenClosedFromFullScreenMode,
      metaRetargetingEnabled,
      shortVideos,
      showTaggedVideos,
      comparePriceEnabled,
      discountBadgeEnabled,
      displayAllProductImagesEnabled,
      storeFrontAccessKey,

      videoBehavior,
      enableStoryModeOnClose,
    ]
  );

  return (
    <VideoPopContext.Provider value={videoPopContext}>
      {children}
    </VideoPopContext.Provider>
  );
});

export const useVideoPopContext = () => {
  const context = useContext(VideoPopContext);
  if (!context) {
    throw new Error(
      "useVideoPopContext must be used within a VideoPopContextProvider"
    );
  }
  return context;
};
