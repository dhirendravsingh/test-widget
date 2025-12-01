import { createContext } from "preact";
import React, { memo } from "preact/compat";
import { useContext, useMemo, useState } from "preact/hooks";
import { ImageHighlight, ShortVideo, Story } from "../types/api";

type IStoryVideoContext = {
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
  showFeed: boolean;
  setShowFeed: (showFeed: boolean) => void;
  purchaseFlowAction: "popUp" | "pdp" | "customCode";
  setPurchaseFlowAction: (action: "popUp" | "pdp" | "customCode") => void;
  customCode: string | null;
  setCustomCode: (code: string | null) => void;
  activeStoryId: string | null;
  activeVideoIndex: number;
  setActiveStoryId: (activeStoryId: string | null) => void;
  setActiveVideoIndex: (index: number) => void;
  stories: Story[];
  setStories: (stories: Story[]) => void;
  storySessionToken: string;
  setStorySessionToken: (val: string) => void;
  googleAnalyticsEnabled: boolean;
  setGoogleAnalyticsEnabled: (value: boolean) => void;
  useGtmForAnalytics: boolean;
  setUseGtmForAnalytics: (value: boolean) => void;
  clevertapAnalyticsEnabled: boolean;
  setClevertapAnalyticsEnabled: (value: boolean) => void;
  highlights: ImageHighlight[];
  setHighlights: (highlights: ImageHighlight[]) => void;
  showHighlights: boolean;
  setShowHighlights: (show: boolean) => void;
  shopNowText: string;
  setShopNowText: (val: string) => void;
  metaRetargetingEnabled: boolean;
  setMetaRetargetingEnabled: (value: boolean) => void;
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
  customPageRoute: string;
  setCustomPageRoute: (val: string) => void;
  isCustomPage: boolean;
  setIsCustomPage: (value: boolean) => void;

  videoBehavior: number;
  setVideoBehavior: (behavior: number) => void;

  // Story Title Settings
  storyTitleText: string;
  setStoryTitleText: (text: string) => void;
};

const StoryVideosModalContext = createContext<IStoryVideoContext>(
  null as never
);

export const StoryVideosModalContextProvider = memo(
  function StoryVideosModalContextProvider({
    children,
  }: React.PropsWithChildren) {
    const [isLoadingShortVideos, setIsLoadingShortVideos] = useState(true);
    const [shortVideos, setShortVideos] = useState<ShortVideo[]>([]);
    const [activeProductIndex, setActiveProductIndex] = useState(0);
    const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
    const [isProductDetailsModalOpen, setIsProductDetailsModalOpen] =
      useState(false);
    const [isDesktop, setIsDesktop] = useState(window.innerWidth > 600);
    const [showFeed, setShowFeed] = useState(true);
    const [purchaseFlowAction, setPurchaseFlowAction] = useState<
      "popUp" | "pdp" | "customCode"
    >("popUp");
    const [customCode, setCustomCode] = useState<string | null>("");
    const [activeStoryId, setActiveStoryId] = useState<string | null>(null);
    const [activeVideoIndex, setActiveVideoIndex] = useState(0);
    const [stories, setStories] = useState<Story[]>([]);
    const [storySessionToken, setStorySessionToken] = useState<string>("");
    const [googleAnalyticsEnabled, setGoogleAnalyticsEnabled] =
      useState<boolean>(false);
    const [useGtmForAnalytics, setUseGtmForAnalytics] =
      useState<boolean>(false);
    const [clevertapAnalyticsEnabled, setClevertapAnalyticsEnabled] =
      useState<boolean>(false);
    const [highlights, setHighlights] = useState<ImageHighlight[]>([]);
    const [showHighlights, setShowHighlights] = useState(false);
    const [shopNowText, setShopNowText] = useState<string>("");
    const [metaRetargetingEnabled, setMetaRetargetingEnabled] =
      useState<boolean>(false);
    const [discountBadgeEnabled, setDiscountBadgeEnabled] =
      useState<boolean>(false);
    const [displayAllProductImagesEnabled, setDisplayAllProductImagesEnabled] =
      useState<boolean>(false);
    const [comparePriceEnabled, setComparePriceEnabled] =
      useState<boolean>(false);
    const [storeFrontCartOperation, setStoreFrontCartOperation] =
      useState<boolean>(false);
    const [storeFrontAccessKey, setStoreFrontAccessKey] = useState<string>("");
    const [isCustomPage, setIsCustomPage] = useState<boolean>(false);
    const [customPageRoute, setCustomPageRoute] = useState<string>("");

    const [videoBehavior, setVideoBehavior] = useState<number>(0);

    // Story Title Settings
    const [storyTitleText, setStoryTitleText] = useState<string>("");

    const StoryVideoContext = useMemo<IStoryVideoContext>(() => {
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
        },
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
        activeStoryId,
        activeVideoIndex,
        setActiveStoryId: (activeStoryId: string | null) => {
          setActiveStoryId(activeStoryId);
        },
        setActiveVideoIndex,
        stories,
        setStories,
        storySessionToken,
        setStorySessionToken,
        googleAnalyticsEnabled,
        setGoogleAnalyticsEnabled,
        useGtmForAnalytics,
        setUseGtmForAnalytics,
        clevertapAnalyticsEnabled,
        setClevertapAnalyticsEnabled,
        setHighlights,
        highlights,
        showHighlights,
        setShowHighlights,
        setShopNowText,
        shopNowText,
        setMetaRetargetingEnabled,
        metaRetargetingEnabled,
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
        isCustomPage,
        setIsCustomPage,
        customPageRoute,
        setCustomPageRoute,

        videoBehavior,
        setVideoBehavior,

        // Story Title Settings
        storyTitleText,
        setStoryTitleText,
      };
    }, [
      isLoadingShortVideos,
      shortVideos,
      activeProductIndex,
      activeVideoId,
      isProductDetailsModalOpen,
      isDesktop,
      showFeed,
      activeStoryId,
      activeVideoIndex,
      googleAnalyticsEnabled,
      useGtmForAnalytics,
      stories,
      storySessionToken,
      clevertapAnalyticsEnabled,
      metaRetargetingEnabled,
      discountBadgeEnabled,
      displayAllProductImagesEnabled,
      comparePriceEnabled,
      storeFrontCartOperation,
      storeFrontAccessKey,
      customPageRoute,
      isCustomPage,

      videoBehavior,

      // Story Title Settings
      storyTitleText,
    ]); //eslint-disable-line react-hooks/exhaustive-deps

    return (
      <StoryVideosModalContext.Provider value={StoryVideoContext}>
        {children}
      </StoryVideosModalContext.Provider>
    );
  }
);

export const useStoryVideosModalContext = () => {
  const storyVideosContext = useContext(StoryVideosModalContext);
  return storyVideosContext;
};
