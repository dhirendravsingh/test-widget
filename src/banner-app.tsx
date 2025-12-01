// banner-app.tsx
import "./styles/banner-index.scss";
import { useApi } from "./lib/api";
import { useEffect, useState, useRef } from "preact/hooks";
import { instasellBannerEmbedConfig } from "./banner-index";
import { GetVideoBannersExistParams } from "./types/api";
import { useBannerModalContext } from "./context/VideoBannerContext";
import ShowBanner from "./components/ShowVideoBanners";

type BannerData = {
  bannerName?: string;
  elementId?: string;
};

export function App({
  bannerData,
  loadImmediately,
}: {
  bannerData?: BannerData;
  loadImmediately: boolean;
}) {
  const pageType = instasellBannerEmbedConfig.pageType ?? "home";
  const api = useApi();
  const [isNearViewport, setIsNearViewport] = useState<boolean>(false);
  const [pastViewerToken, setPastViewerToken] = useState<string | undefined>(
    localStorage?.getItem("__IS_VTOK") ?? undefined
  );
  const sessionToken = localStorage?.getItem("__IS_STOK");
  const hasTrackedImpression = useRef(false);
  const componentRef = useRef<HTMLDivElement>(null);
  const [doNotShowBanner, setDoNotShowBanner] = useState<boolean>(true);
  const { setBannerSessionToken } = useBannerModalContext();

  useEffect(() => {
    if (!componentRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          setIsNearViewport(true);
        } else if (!hasTrackedImpression.current) {
          const boundingRect = entry.boundingClientRect;
          const windowHeight = window.innerHeight;
          const distanceFromViewport = boundingRect.top - windowHeight;
          const threshold = windowHeight * 0.2;
          setIsNearViewport(distanceFromViewport <= threshold && distanceFromViewport > 0);
        }
      },
      { rootMargin: "20% 0px", threshold: [0, 0.1, 0.2] }
    );

    observer.observe(componentRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (loadImmediately) {
      setIsNearViewport(true);
      hasTrackedImpression.current = true;
      setDoNotShowBanner(false);
    } else if (pageType === "home") {
      (async () => {
        try {
          const params: GetVideoBannersExistParams = {
            pageType,
            originFqdn: instasellBannerEmbedConfig.getShopDomain?.(),
          };

          const exists = await api.checkVideoBannersExist(params);
          setDoNotShowBanner(!exists);
          
          if (!exists) {
            document
              .querySelectorAll('[id^="instasell-banner-"], #instasell-banner')
              .forEach((el) => ((el as HTMLElement).style.display = "none"));
          }
        } catch (error) {
          console.log(`%cError checking banners ${error}`, "color: red;");
        }
      })();
    } else {
      setDoNotShowBanner(false);
    }
  }, []);

  useEffect(() => {
    if (!pastViewerToken) {
      (async () => {
        try {
          const vt = await api.getViewerToken({
            originFqdn: ["localhost", "192.168.1.33", "127.0.0.1"].includes(window.location.hostname)
              ? "utkarsh-s.myshopify.com"
              : typeof (window as any).Shopify === "undefined"
              ? window.location.hostname
              : instasellBannerEmbedConfig.getShopDomain?.(),
          });
          if (vt.vt) {
            localStorage.setItem("__IS_VTOK", vt.vt);
            setPastViewerToken(vt.vt);
          }
        } catch (error) {
          console.log(`%c${error}`, "color: red;");
        }
      })();
    }
  }, [pastViewerToken]);

  useEffect(() => {
    if (pastViewerToken) {
      const now = Date.now();
      const storedTimeStr = sessionStorage.getItem("sessionTime");
      const storedTime = storedTimeStr ? parseInt(storedTimeStr) : null;

      let st = sessionToken || generateUUID();
      if (!sessionToken) {
        localStorage?.setItem("__IS_STOK", st);
      }

      const createNewSession = async () => {
        try {
          await api.shortVideosBoron({
            eventType: "newSession",
            source: "carousel",
            newSession: st,
          });
          sessionStorage.setItem("sessionTime", now.toString());
          setBannerSessionToken(st);
        } catch (error) {
          console.log(`%cError creating new session: ${error}`, "color: red;");
        }
      };

      if (!storedTime || 
          new Date(storedTime).getDate() !== new Date(now).getDate() ||
          now - storedTime > 30 * 60 * 1000) {
        createNewSession();
      }
    }
  }, [pastViewerToken]);

  return (
    <div id="ins-banner-section" ref={componentRef}>
      {!doNotShowBanner && pastViewerToken && (
        <ShowBanner
          bannerData={bannerData}
          isNearViewport={isNearViewport}
        />
      )}
    </div>
  );
}

function generateUUID() {
  try {
    return crypto.randomUUID();
  } catch {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}