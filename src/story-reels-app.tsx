import "./styles/story-reels.scss";
import ShowStoryReels from "./components/ShowStoryReels";
import { useApi } from "./lib/api";
import { useEffect, useRef, useState } from "preact/hooks";
import { instasellStoryEmbedConfig } from "./story-index";
import { useStoryVideosModalContext } from "./context/StoryVideosModalContext";

export function App({storyName}: { storyName?: string }) {
  const api = useApi();
  const [pastViewerToken, setPastViewerToken] = useState<string | undefined>(
    localStorage?.getItem("__IS_VTOK") ?? undefined
  );
  const [sessionToken, setSessionToken] = useState<string | undefined>(
    localStorage?.getItem("__IS_STOK") ?? undefined
  );
  const componentRef = useRef<HTMLDivElement>(null);
  const [isNearViewport, setIsNearViewport] = useState(false);
  const hasTrackedImpression = useRef(false);

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
    const observer = new MutationObserver(() => {
      const modal = document.querySelector(".ins-story-modal-overlay");
      if (modal && modal.parentNode !== document.body)
        document.body.appendChild(modal);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

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
    if (!pastViewerToken) {
      const carouselSection = document.getElementById("ins-carousel-section");

      if (!carouselSection) {
        (async () => {
          console.log("entering story section to create viewer");
          try {
            const vt = await api.getViewerToken({
              originFqdn: ["localhost", "192.168.1.33", "127.0.0.1"].includes(
                window.location.hostname
              )
                ? "utkarsh-s.myshopify.com"
                : typeof (window as any).Shopify === "undefined"
                ? window.location.hostname
                : instasellStoryEmbedConfig.getShopDomain?.(),
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

      // For story component, we only need to check for carousel
      const carouselSection = document.getElementById(
        "ins-shoppable-video-feed-wrapper"
      );

      // Check if we need to create a new session
      let needNewSession = false;

      const checkSessionTime = () => {
        if (!storedTime) {
          return true;
        }

        const storedDate = new Date(storedTime);
        const currentDate = new Date(now);

        // Check if it's a different day
        if (
          storedDate.getFullYear() !== currentDate.getFullYear() ||
          storedDate.getMonth() !== currentDate.getMonth() ||
          storedDate.getDate() !== currentDate.getDate()
        ) {
          return true;
        }

        // Check if it's been more than 30 minutes
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

      // Create new session API call
      const createNewSession = async (token: string) => {
        try {
          await api.shortVideosBoron({
            eventType: "newSession",
            source: "story",
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

      // If carousel exists, wait for it to create session token
      if (carouselSection) {
        if (sessionToken) {
          // Already have a session token, use it
          createNewSession(sessionToken);
        } else {
          // Set up a listener to wait for the session token from carousel
          const checkSessionTokenInterval = setInterval(() => {
            const token = localStorage?.getItem("__IS_STOK");
            if (token) {
              clearInterval(checkSessionTokenInterval);
              setSessionToken(token);
              createNewSession(token);
            }
          }, 100);

          // Clean up interval if component unmounts
          return () => clearInterval(checkSessionTokenInterval);
        }
      } else {
        // No carousel, create our own session token
        let st = "";

        if (sessionToken) {
          st = sessionToken;
        } else {
          st = generateUUID();
          localStorage.setItem("__IS_STOK", st);
          setSessionToken(st);
        }

        // Use our session token
        createNewSession(st);
      }
    }
  }, [pastViewerToken, sessionToken, api]);

  return (
    <div ref={componentRef}>
      {pastViewerToken && <ShowStoryReels storyName={storyName || ""} isNearViewport={isNearViewport} />}
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
