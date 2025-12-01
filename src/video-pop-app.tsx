import { useEffect, useState } from "preact/hooks";
import { VideoPops } from "./components/VideoPop";
import { useApi } from "./lib/api";
import "./styles/video-pop.scss";
import { instasellVideoPopEmbedConfig } from "./video-pop-index";

export function App() {
  const api = useApi();
  const [pastViewerToken, setPastViewerToken] = useState<string | undefined>(
    localStorage?.getItem("__IS_VTOK") ?? undefined
  );
  const [sessionToken, setSessionToken] = useState<string | undefined>(
    localStorage?.getItem("__IS_STOK") ?? undefined
  );

  useEffect(() => {
    if (!pastViewerToken) {
      const intervalId = setInterval(() => {
        const token = localStorage?.getItem("__IS_VTOK");
        if (token) {
          setPastViewerToken(token);
          clearInterval(intervalId);
        }
      }, 100);
      return () => clearInterval(intervalId);
    }
  }, [pastViewerToken]);

  useEffect(() => {
    if (!sessionToken) {
      const intervalId = setInterval(() => {
        const token = localStorage?.getItem("__IS_STOK");
        if (token) {
          setSessionToken(token);
          clearInterval(intervalId);
        }
      }, 100);
      return () => clearInterval(intervalId);
    }
  }, [sessionToken]);

  useEffect(() => {
    if (!pastViewerToken) {
      const carouselSection = document.getElementById(
        "ins-shoppable-video-feed-wrapper"
      );

      const storySection = document.getElementById(
        "instasell-live-story-reels"
      );

      if (!carouselSection && !storySection) {
        (async () => {
          console.log("entering video pip to create viewer");
          try {
            const vt = await api.getViewerToken({
              originFqdn: ["localhost", "192.168.1.33", "127.0.0.1"].includes(
                window.location.hostname
              )
                ? "utkarsh-s.myshopify.com"
                : typeof (window as any).Shopify === "undefined"
                ? window.location.hostname
                : instasellVideoPopEmbedConfig.getShopDomain?.(),
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
    }
  }, [pastViewerToken]);

  useEffect(() => {
    if (pastViewerToken) {
      const now = Date.now();
      const storedTimeStr = sessionStorage.getItem("sessionTime");
      const storedTime = storedTimeStr ? parseInt(storedTimeStr) : null;

      const carouselSection = document.getElementById(
        "ins-shoppable-video-feed-wrapper"
      );

      const storySection = document.getElementById(
        "instasell-live-story-reels"
      );

      let needNewSession = false;

      const checkSessionTime = () => {
        if (!storedTime) {
          return true;
        }

        const storedDate = new Date(storedTime);
        const currentDate = new Date(now);

        if (
          storedDate.getFullYear() !== currentDate.getFullYear() ||
          storedDate.getMonth() !== currentDate.getMonth() ||
          storedDate.getDate() !== currentDate.getDate()
        ) {
          return true;
        }

        const thirtyMinutesInMs = 30 * 60 * 1000;
        if (now - storedTime > thirtyMinutesInMs) {
          return true;
        }

        return false;
      };

      needNewSession = checkSessionTime();

      if (!needNewSession) {
        return;
      }

      const createNewSession = async (token: string) => {
        try {
          await api.shortVideosBoron({
            eventType: "newSession",
            source: "videoPop",
            newSession: token,
          });
          sessionStorage.setItem("sessionTime", now.toString());
        } catch (error) {
          console.log(
            `%cError creating new session event ${error}`,
            "color: red;"
          );
        }
      };

      if (carouselSection || storySection) {
        if (sessionToken) {
          createNewSession(sessionToken);
        } else {
          const checkSessionTokenInterval = setInterval(() => {
            const token = localStorage?.getItem("__IS_STOK");
            if (token) {
              clearInterval(checkSessionTokenInterval);
              setSessionToken(token);
              createNewSession(token);
            }
          }, 100);

          return () => clearInterval(checkSessionTokenInterval);
        }
      } else {
        let st = "";

        if (sessionToken) {
          st = sessionToken;
        } else {
          st = generateUUID();
          localStorage.setItem("__IS_STOK", st);
          setSessionToken(st);
        }

        createNewSession(st);
      }
    }
  }, [pastViewerToken, sessionToken, api]);

  if (!pastViewerToken) return null;

  return <VideoPops />;
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
