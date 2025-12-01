import { createContext } from "preact";
import React, { memo } from "preact/compat";
import { useContext, useMemo, useState } from "preact/hooks";
import { FrameDesign, ShortVideo } from "../types/api";

type IShortVideoContext = {
  shortVideos: ShortVideo[];
  setShortVideos: (shortVideos: ShortVideo[]) => void;
  isLoadingShortVideos: boolean;
  setIsLoadingShortVideos: (isLoadingShortVideo: boolean) => void;
  isDesktop: boolean;
  setIsDesktop: (isDesktop: boolean) => void;
  isProductDetailsModalOpen: boolean;
  setIsProductDetailsModalOpen: (isProductDetailsModalOpen: boolean) => void;
  activeVideoId: string | null;
  setActiveVideoId: (activeVideoId: string | null) => void;
  activeProductIndex: number;
  setActiveProductIndex: (activeProductIndex: number) => void;
  isPipActive: boolean;
  setIsPipActive: (isPipActive: boolean) => void;
  showFeed: boolean;
  setShowFeed: (showFeed: boolean) => void;
  purchaseFlowAction: "popUp" | "pdp" | "customCode";
  setPurchaseFlowAction: (action: "popUp" | "pdp" | "customCode") => void;
  customCode: string | null;
  setCustomCode: (code: string | null) => void;
  hidePoweredBy: boolean;
  setHidePoweredBy: (value: boolean) => void;
  pipEnabled: boolean;
  setPipEnabled: (value: boolean) => void;
  comparePriceEnabled: boolean;
  setComparePriceEnabled: (value: boolean) => void;
  productPageTitle: string | null;
  setProductPageTitle: (title: string) => void;
  noOfVideosInViewPort: number;
  setNoOfVideosInViewport: (videos: number) => void;
  googleAnalyticsEnabled: boolean;
  setGoogleAnalyticsEnabled: (value: boolean) => void;
  useGtmForAnalytics: boolean;
  setUseGtmForAnalytics: (value: boolean) => void;
  clevertapAnalyticsEnabled: boolean;
  setClevertapAnalyticsEnabled: (value: boolean) => void;
  metaRetargetingEnabled: boolean;
  setMetaRetargetingEnabled: (value: boolean) => void;
  shortVideoSessionToken: string;
  setShortVideoSessionToken: (val: string) => void;
  canRegisterClickEvent: boolean;
  setCanRegisterClickEvent: (val: boolean) => void;
  videoPlayerView: string;
  setVideoPlayerView: (val: string) => void;
  carouselTitle: string;
  setCarouselTitle: (val: string) => void;
  shopNowText: string;
  setShopNowText: (val: string) => void;
  customScript: string;
  setCustomScript: (val: string) => void;
  atcButtonText: string;
  setAtcButtonText: (val: string) => void;
  showOldVideoPop: boolean;
  setShowOldVideoPop: (val: boolean) => void;
  discountBadgeEnabled: boolean;
  setDiscountBadgeEnabled: (value: boolean) => void;
  displayAllProductImagesEnabled: boolean;
  setDisplayAllProductImagesEnabled: (value: boolean) => void;
  storeFrontCartOperation: boolean;
  setStoreFrontCartOperation: (value: boolean) => void;
  storeFrontAccessKey: string;
  setStoreFrontAccessKey: (val: string) => void;

  videoBehavior: number;
  setVideoBehavior: (behavior: number) => void;
  isTestimonial: boolean;
  setIsTestimonial: (value: boolean) => void;
  variantSliderEnabled: boolean;
  setVariantSliderEnabled: (value: boolean) => void;
  frameDesign: FrameDesign;
  setFrameDesign: (value: FrameDesign) => void;
};

const ShortVideosModalContext = createContext<IShortVideoContext>(
  null as never
);

export const ShortVideosModalContextProvider = memo(
  function ShortVideosModalContextProvider({
    children,
  }: React.PropsWithChildren) {
    const [isLoadingShortVideos, setIsLoadingShortVideos] = useState(true);
    const [shortVideos, setShortVideos] = useState<ShortVideo[]>([]);
    const [activeProductIndex, setActiveProductIndex] = useState(0);
    const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
    const [isPipActive, setIsPipActive] = useState(false);
    const [isProductDetailsModalOpen, setIsProductDetailsModalOpen] =
      useState(false);
    const [isDesktop, setIsDesktop] = useState(window.innerWidth > 600);
    const [showFeed, setShowFeed] = useState(true);
    const [purchaseFlowAction, setPurchaseFlowAction] = useState<
      "popUp" | "pdp" | "customCode"
    >("popUp");
    const [customCode, setCustomCode] = useState<string | null>("");
    const [hidePoweredBy, setHidePoweredBy] = useState<boolean>(false);
    const [pipEnabled, setPipEnabled] = useState<boolean>(false);
    const [comparePriceEnabled, setComparePriceEnabled] =
      useState<boolean>(false);
    const [productPageTitle, setProductPageTitle] = useState<string | null>(
      null
    );
    const [noOfVideosInViewPort, setNoOfVideosInViewport] = useState<number>(6);
    const [googleAnalyticsEnabled, setGoogleAnalyticsEnabled] =
      useState<boolean>(false);
    const [useGtmForAnalytics, setUseGtmForAnalytics] =
      useState<boolean>(false);
    const [clevertapAnalyticsEnabled, setClevertapAnalyticsEnabled] =
      useState<boolean>(false);
    const [metaRetargetingEnabled, setMetaRetargetingEnabled] =
      useState<boolean>(false);
    const [shortVideoSessionToken, setShortVideoSessionToken] =
      useState<string>("");
    const [canRegisterClickEvent, setCanRegisterClickEvent] =
      useState<boolean>(true);
    const [videoPlayerView, setVideoPlayerView] = useState<string>("");
    const [carouselTitle, setCarouselTitle] = useState<string>("");
    const [shopNowText, setShopNowText] = useState<string>("");
    const [customScript, setCustomScript] = useState<string>("");
    const [atcButtonText, setAtcButtonText] = useState<string>("");
    const [showOldVideoPop, setShowOldVideoPop] = useState<boolean>(false);
    const [discountBadgeEnabled, setDiscountBadgeEnabled] =
      useState<boolean>(false);
    const [displayAllProductImagesEnabled, setDisplayAllProductImagesEnabled] =
      useState<boolean>(false);
    const [storeFrontCartOperation, setStoreFrontCartOperation] =
      useState<boolean>(false);
    const [storeFrontAccessKey, setStoreFrontAccessKey] = useState<string>("");

    const [videoBehavior, setVideoBehavior] = useState<number>(0);
    const [isTestimonial, setIsTestimonial] = useState<boolean>(false);
    const [variantSliderEnabled, setVariantSliderEnabled] =
      useState<boolean>(false);
    const [frameDesign, setFrameDesign] = useState<FrameDesign>("NONE");

    const ShortVideoContext = useMemo<IShortVideoContext>(() => {
      return {
        isLoadingShortVideos,
        setIsLoadingShortVideos,
        shortVideos,
        setShortVideos,
        activeProductIndex,
        setActiveProductIndex,
        activeVideoId,
        setActiveVideoId: (activeVideoId: string | null) => {
          setActiveVideoId(activeVideoId);
          if (activeVideoId) {
            localStorage.setItem("__IS_LAST_ACTIVE_SV", activeVideoId);
          }
        },
        isPipActive,
        setIsPipActive,
        isProductDetailsModalOpen,
        setIsProductDetailsModalOpen,
        isDesktop,
        setIsDesktop,
        showFeed,
        setShowFeed,
        purchaseFlowAction,
        setPurchaseFlowAction,
        customCode,
        setCustomCode,
        hidePoweredBy,
        setHidePoweredBy,
        pipEnabled,
        setPipEnabled,
        comparePriceEnabled,
        setComparePriceEnabled,
        productPageTitle,
        setProductPageTitle,
        noOfVideosInViewPort,
        setNoOfVideosInViewport,
        googleAnalyticsEnabled,
        setGoogleAnalyticsEnabled,
        useGtmForAnalytics,
        setUseGtmForAnalytics,
        shortVideoSessionToken,
        setShortVideoSessionToken,
        canRegisterClickEvent,
        setCanRegisterClickEvent,
        videoPlayerView,
        setVideoPlayerView,
        clevertapAnalyticsEnabled,
        setClevertapAnalyticsEnabled,
        carouselTitle,
        setCarouselTitle,
        showOldVideoPop,
        setShowOldVideoPop,
        setShopNowText,
        shopNowText,
        customScript,
        setCustomScript,
        atcButtonText,
        setAtcButtonText,
        metaRetargetingEnabled,
        setMetaRetargetingEnabled,
        discountBadgeEnabled,
        setDiscountBadgeEnabled,
        displayAllProductImagesEnabled,
        setDisplayAllProductImagesEnabled,
        storeFrontCartOperation,
        setStoreFrontCartOperation,
        storeFrontAccessKey,
        setStoreFrontAccessKey,

        videoBehavior,
        setVideoBehavior,
        isTestimonial,
        setIsTestimonial,
        variantSliderEnabled,
        setVariantSliderEnabled,
        frameDesign,
        setFrameDesign,
      };
    }, [
      isLoadingShortVideos,
      shortVideos,
      activeProductIndex,
      activeVideoId,
      isPipActive,
      isProductDetailsModalOpen,
      isDesktop,
      showFeed,
      pipEnabled,
      comparePriceEnabled,
      productPageTitle,
      googleAnalyticsEnabled,
      useGtmForAnalytics,
      shortVideoSessionToken,
      canRegisterClickEvent,
      videoPlayerView,
      clevertapAnalyticsEnabled,
      carouselTitle,
      showOldVideoPop,
      shopNowText,
      customScript,
      atcButtonText,
      metaRetargetingEnabled,
      discountBadgeEnabled,
      displayAllProductImagesEnabled,
      storeFrontCartOperation,
      storeFrontAccessKey,

      videoBehavior,
      isTestimonial,
      variantSliderEnabled,
      frameDesign,
    ]); //eslint-disable-line react-hooks/exhaustive-deps

    return (
      <ShortVideosModalContext.Provider value={ShortVideoContext}>
        {children}
      </ShortVideosModalContext.Provider>
    );
  }
);

export const useShortVideosModalContext = () => {
  const shortVideosContext = useContext(ShortVideosModalContext);
  return shortVideosContext;
};
