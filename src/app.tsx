import "./styles/index.scss";
import ShowShoppableReels from "./components/ShowShoppableReels";
import { instasellLiveEmbedConfig } from ".";
import { useApi } from "./lib/api";
import { GetVideosExistParams } from "./types/api";
import { useEffect, useState, useRef } from "preact/hooks";
import { useShortVideosModalContext } from "./context/ShortVideosModalContext";

type CarouselData = {
  carouselName?: string;
  elementId?: string;
  isVideoPop?: boolean;
  isTestimonial?: boolean;
};

export function App({
  carouselData,
  loadImmediately,
}: {
  carouselData?: CarouselData;
  loadImmediately: boolean;
}) {
  const pageType = instasellLiveEmbedConfig.pageType ?? "home";
  const api = useApi();
  const [isNearViewport, setIsNearViewport] = useState<boolean>(false);
  const [pastViewerToken, setPastViewerToken] = useState<string | undefined>(
    localStorage?.getItem("__IS_VTOK") ?? undefined
  );
  const sessionToken = localStorage?.getItem("__IS_STOK");
  const hasTrackedImpression = useRef(false);
  const componentRef = useRef<HTMLDivElement>(null);
  const [doNotShowFeed, setDoNotShowFeed] = useState<boolean>(true);
  const { setShortVideoSessionToken } = useShortVideosModalContext();

  useEffect(() => {
    if (!componentRef.current) return;

    if (hasTrackedImpression.current) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (
          !entry.isIntersecting &&
          entry.intersectionRatio === 0 &&
          !hasTrackedImpression.current
        ) {
          hasTrackedImpression.current = true;

          const boundingRect = entry.boundingClientRect;
          const windowHeight = window.innerHeight;
          const distanceFromViewport = boundingRect.top - windowHeight;
          const threshold = windowHeight * 0.2;

          if (distanceFromViewport <= threshold && distanceFromViewport > 0) {
            setIsNearViewport(true);
          } else {
            setIsNearViewport(false);
          }
        } else if (entry.isIntersecting) {
          setIsNearViewport(true);
        }
      },
      {
        rootMargin: "20% 0px",
        threshold: [0, 0.1, 0.2],
      }
    );

    observer.observe(componentRef.current);

    return () => {
      if (componentRef.current) {
        observer.unobserve(componentRef.current);
      }
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (loadImmediately) {
      setIsNearViewport(true);
      hasTrackedImpression.current = true;
      setDoNotShowFeed(false);
    } else if (pageType === "home") {
      (async () => {
        try {
          const params: GetVideosExistParams = {
            pageType: pageType,
            originFqdn: instasellLiveEmbedConfig.getShopDomain?.(),
            carouselName: carouselData?.carouselName,
          };

          const { exists, isSingleVideo, hasDefaultVideoPip } =
            await api.checkVideosExist(params);

          if (exists) {
            setDoNotShowFeed(false);
            if (isSingleVideo || hasDefaultVideoPip) {
              setIsNearViewport(true);
            }
          } else {
            setDoNotShowFeed(true);
            document
              .querySelectorAll(
                '[id^="instasell-carousel"], #instasell-live-short-videos'
              )
              .forEach((el) => ((el as HTMLElement).style.height = "0"));
          }
        } catch (error) {
          console.log("Error in checkVideosExist:", error);
          setDoNotShowFeed(true);
          document
            .querySelectorAll(
              '[id^="instasell-carousel"], #instasell-live-short-videos'
            )
            .forEach((el) => ((el as HTMLElement).style.height = "0"));
        }
      })();
    } else {
      setDoNotShowFeed(false);
    }
  }, []);

  useEffect(() => {
    if (!pastViewerToken) {
      (async () => {
        try {
          const vt = await api.getViewerToken({
            originFqdn: ["localhost", "192.168.1.33", "127.0.0.1"].includes(
              window.location.hostname
            )
              ? "utkarsh-s.myshopify.com"
              : typeof (window as any).Shopify === "undefined"
              ? window.location.hostname
              : instasellLiveEmbedConfig.getShopDomain?.(),
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

      let st = "";

      if (sessionToken) {
        st = sessionToken;
      } else {
        st = generateUUID();
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
        } catch (error) {
           console.log(`%cerror creating new session event ${error}`, "color: red;");
        }
      };

      if (!storedTime) {
        createNewSession();
        return;
      }

      const storedDate = new Date(storedTime);
      const currentDate = new Date(now);

      if (
        storedDate.getFullYear() !== currentDate.getFullYear() ||
        storedDate.getMonth() !== currentDate.getMonth() ||
        storedDate.getDate() !== currentDate.getDate()
      ) {
        createNewSession();
        return;
      }

      const thirtyMinutesInMs = 30 * 60 * 1000;
      if (now - storedTime > thirtyMinutesInMs) {
        createNewSession();
        return;
      }
    }
  }, [pastViewerToken]);

  return (
    <div id="ins-carousel-section" ref={componentRef}>
      {!doNotShowFeed && pastViewerToken && (
        <ShowShoppableReels
          carouselData={carouselData}
          isNearViewport={isNearViewport}
        />
      )}
    </div>
  );
}

const generateUUID = () => {
  try {
    return crypto.randomUUID();
  } catch (e) {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
};