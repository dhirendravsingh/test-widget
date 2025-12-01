import { useEffect, useRef, useState } from "preact/hooks";
import { useApi } from "../../lib/api";
import { PreactPortal } from "../Portal";
import { useGAEvents } from "../../context/GoogleAnalytics";
import { useCleverTapEvents } from "../../context/ClevertapAnalytics";
import { instasellBannerEmbedConfig } from "../../banner-index";
import { GetVideoBannersResponse, VideoBanner } from "../../types/api";
import { useBannerModalContext } from "../../context/VideoBannerContext";
import BannerFeed from "./banner-feed";
import BannerFeedSkeleton from "./banner-feed-skeleton";
import { useMetaEvents } from "../../context/MetaEventsContext";

const ShowBanner = ({
  bannerData,
  isNearViewport,
}: {
  bannerData?: {
    bannerName?: string;
    elementId?: string;
  };
  isNearViewport: boolean;
}) => {
  const api = useApi();
  const {
    setBanners,
    isLoadingBanners,
    setIsLoadingBanners,
    showBanner,
    setShowBanner,
    setGoogleAnalyticsEnabled,
    googleAnalyticsEnabled,
    useGtmForAnalytics,
    setUseGtmForAnalytics,
    setClevertapAnalyticsEnabled,
    clevertapAnalyticsEnabled,
    activeBannerId,
    setActiveBannerId,
    setMetaRetargetingEnabled,
    metaRetargetingEnabled,
  } = useBannerModalContext();

  const feedRef = useRef(null);
  const hasTrackedImpression = useRef(false);
  const gaEvents = useGAEvents();
  const caEvents = useCleverTapEvents();
  const fbEvents = useMetaEvents();
  const [isLoadedBanners, setIsLoadedBanners] = useState(false);

  const shopDomain = ["localhost", "192.168.1.33", "127.0.0.1"].includes(
    window.location.hostname
  )
    ? "utkarsh-s.myshopify.com"
    : typeof (window as any).Shopify === "undefined"
    ? window.location.hostname
    : instasellBannerEmbedConfig.getShopDomain?.();

  const injectStyles = (styles: string, id: string) => {
    const styleTag = document.createElement("style");
    styleTag.id = id;

    const transformedStyles = styles
      .split("}")
      .filter((rule) => rule.trim())
      .map((rule) => {
        const [selector, styles] = rule.split("{");
        if (!styles) return "";

        const cleanStyles = styles
          .trim()
          .replace(/!important !important/g, "!important")
          .replace(/;$/, "");

        return `.ins-banner ${selector.trim()} {
          ${cleanStyles}
        }`;
      })
      .join("\n");

    styleTag.innerHTML = transformedStyles;
    document.head.appendChild(styleTag);
    return styleTag;
  };

  const injectCustomScript = (scriptContent: string) => {
    const existingScript = document.getElementById(
      "instasell-banner-custom-script"
    );
    if (existingScript) {
      existingScript.remove();
    }

    if (!scriptContent || scriptContent.trim() === "") {
      return;
    }

    try {
      const script = document.createElement("script");
      script.id = "instasell-banner-custom-script";
      script.type = "text/javascript";

      const safeScript = `
        (function() {
          try {
            ${scriptContent}
          } catch (e) {
            console.log(%c[Instaell Banner Custom script error], "color: red;");
          }
        })();
      `;

      script.textContent = safeScript;
      document.head.appendChild(script);
    } catch (error) {
      console.log(`%cFailed to inject script ${error}`, "color: red;");
    }
  };

  const fetchBanners = async () => {
    const pageType = instasellBannerEmbedConfig.pageType;
    let bannersResponse;

    bannersResponse = await api
      .getVideoBanners({
        originFqdn: instasellBannerEmbedConfig.getShopDomain?.(),
        pageType,
        currentProductId: instasellBannerEmbedConfig.currentProductId,
        currentCollectionId: instasellBannerEmbedConfig.currentCollectionId,
      })
      .catch((e) => {
        document
          .querySelectorAll('[id^="instasell-banner"], #instasell-banner')
          .forEach((el) => ((el as HTMLElement).style.display = "none"));
        setIsLoadingBanners(false);
        setIsLoadedBanners(true);
      });

    if (bannersResponse != null) {
      handleCommonResponseSettings(bannersResponse);

      if (bannersResponse.b) {
        const banners = bannersResponse.b;
        const selectedBanner = bannerData?.bannerName
          ? banners.find((banner) => banner.n === bannerData.bannerName)
          : banners[0];

        if (selectedBanner) {
          setBanners([selectedBanner]);
          setActiveBannerId(selectedBanner.i);
          setShowBanner(true);
        } else {
          setShowBanner(false);
        }
      }

      setIsLoadingBanners(false);
      setIsLoadedBanners(true);
    }
  };

  const handleCommonResponseSettings = (response: GetVideoBannersResponse) => {
    setGoogleAnalyticsEnabled(response.ga);
    setUseGtmForAnalytics(response.gt);
    setClevertapAnalyticsEnabled(response.ca);
    setMetaRetargetingEnabled(response.mr);

    if (response.ck) {
      injectCustomScript(response.ck);
    }

    document.getElementById("instasell-banner-custom-css")?.remove();
    document.getElementById("instasell-banner-ai-css")?.remove();

    if (response.cs) {
      const styleTag = document.createElement("style");
      styleTag.id = "instasell-banner-custom-css";
      styleTag.innerHTML = response.cs;
      document.head.appendChild(styleTag);
    }

    if (response.ac) {
      injectStyles(response.ac, "instasell-banner-ai-css");
    }
  };

  useEffect(() => {
    return () => {
      document.getElementById("instasell-banner-custom-css")?.remove();
      document.getElementById("instasell-banner-ai-css")?.remove();
      document.getElementById("instasell-banner-custom-script")?.remove();
    };
  }, []);

  useEffect(() => {
    if (isNearViewport && !isLoadedBanners) {
      fetchBanners();
    }
  }, [isNearViewport]);

  useEffect(() => {
    if (!showBanner || !feedRef.current || hasTrackedImpression.current) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const feedEntry = entries[0];
        if (feedEntry.isIntersecting) {
          try {
            api
              .shortVideosBoron({
                eventType: "shortVideoImpression",
                source: "carousel",
              })
              .then(() => {
                hasTrackedImpression.current = true;
              });

            if (googleAnalyticsEnabled) {
              gaEvents.trackImpression(
                "banner",
                instasellBannerEmbedConfig.pageType,
                useGtmForAnalytics
              );
            }
            if (clevertapAnalyticsEnabled) {
              caEvents.trackImpression(
                "banner",
                instasellBannerEmbedConfig.pageType
              );
            }
            if (metaRetargetingEnabled) {
              fbEvents.trackImpression(
                "banner",
                instasellBannerEmbedConfig.pageType
              );
            }
          } catch (error) {
            console.log(
              `%cFailed to track banner impression: ${error}`,
              "color: red;"
            );
          }
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(feedRef.current);
    return () => observer.disconnect();
  }, [
    showBanner,
    activeBannerId,
    googleAnalyticsEnabled,
    clevertapAnalyticsEnabled,
  ]);

  return (
    <div class="ins-banner">
      {isLoadingBanners ? (
        <BannerFeedSkeleton />
      ) : showBanner ? (
        <div ref={feedRef}>
          <BannerFeed />
        </div>
      ) : null}
    </div>
  );
};

export default ShowBanner;
