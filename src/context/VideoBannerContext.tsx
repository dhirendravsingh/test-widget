import { createContext } from "preact";
import React, { memo } from "preact/compat";
import { useContext, useMemo, useState } from "preact/hooks";
import { VideoBanner } from "../types/api";

type IBannerContext = {
  banners: VideoBanner[];
  setBanners: (banners: VideoBanner[]) => void;
  isLoadingBanners: boolean;
  setIsLoadingBanners: (isLoading: boolean) => void;
  isDesktop: boolean;
  setIsDesktop: (isDesktop: boolean) => void;
  showBanner: boolean;
  setShowBanner: (showBanner: boolean) => void;
  googleAnalyticsEnabled: boolean;
  setGoogleAnalyticsEnabled: (value: boolean) => void;
  useGtmForAnalytics: boolean;
  setUseGtmForAnalytics: (value: boolean) => void;
  clevertapAnalyticsEnabled: boolean;
  setClevertapAnalyticsEnabled: (value: boolean) => void;
  bannerSessionToken: string;
  setBannerSessionToken: (val: string) => void;
  bannerTitle: string;
  setBannerTitle: (val: string) => void;
  customScript: string;
  setCustomScript: (val: string) => void;
  activeBannerId: string | null;
  setActiveBannerId: (bannerId: string | null) => void;
  purchaseFlowAction: "popUp" | "pdp" | "customCode";
  setPurchaseFlowAction: (action: "popUp" | "pdp" | "customCode") => void;
  metaRetargetingEnabled: boolean;
  setMetaRetargetingEnabled: (value: boolean) => void;
};

const BannerModalContext = createContext<IBannerContext>(null as never);

export const BannerModalContextProvider = memo(
  function BannerModalContextProvider({ children }: React.PropsWithChildren) {
    const [isLoadingBanners, setIsLoadingBanners] = useState(true);
    const [banners, setBanners] = useState<VideoBanner[]>([]);
    const [activeBannerId, setActiveBannerId] = useState<string | null>(null);
    const [isDesktop, setIsDesktop] = useState(window.innerWidth > 600);
    const [showBanner, setShowBanner] = useState(true);
    const [purchaseFlowAction, setPurchaseFlowAction] = useState<
      "popUp" | "pdp" | "customCode"
    >("popUp");
    const [googleAnalyticsEnabled, setGoogleAnalyticsEnabled] =
      useState<boolean>(false);
    const [useGtmForAnalytics, setUseGtmForAnalytics] =
      useState<boolean>(false);
    const [clevertapAnalyticsEnabled, setClevertapAnalyticsEnabled] =
      useState<boolean>(false);
    const [bannerSessionToken, setBannerSessionToken] = useState<string>("");
    const [bannerTitle, setBannerTitle] = useState<string>("");
    const [customScript, setCustomScript] = useState<string>("");
    const [metaRetargetingEnabled, setMetaRetargetingEnabled] =
      useState<boolean>(false);

    const BannerContext = useMemo<IBannerContext>(() => {
      return {
        isLoadingBanners,
        setIsLoadingBanners,
        banners,
        setBanners,
        activeBannerId,
        setActiveBannerId,
        isDesktop,
        setIsDesktop,
        showBanner,
        setShowBanner,
        googleAnalyticsEnabled,
        setGoogleAnalyticsEnabled,
        useGtmForAnalytics,
        setUseGtmForAnalytics,
        clevertapAnalyticsEnabled,
        setClevertapAnalyticsEnabled,
        bannerSessionToken,
        setBannerSessionToken,
        bannerTitle,
        setBannerTitle,
        customScript,
        setCustomScript,
        purchaseFlowAction,
        setPurchaseFlowAction,
        metaRetargetingEnabled,
        setMetaRetargetingEnabled,
      };
    }, [
      isLoadingBanners,
      banners,
      activeBannerId,
      isDesktop,
      showBanner,
      purchaseFlowAction,
      googleAnalyticsEnabled,
      useGtmForAnalytics,
      clevertapAnalyticsEnabled,
      bannerSessionToken,
      bannerTitle,
      customScript,
      metaRetargetingEnabled,
    ]);

    return (
      <BannerModalContext.Provider value={BannerContext}>
        {children}
      </BannerModalContext.Provider>
    );
  }
);

export const useBannerModalContext = () => {
  const bannerContext = useContext(BannerModalContext);
  return bannerContext;
};
