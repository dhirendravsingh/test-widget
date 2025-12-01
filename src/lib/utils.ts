import { instasellLiveEmbedConfig } from "..";

export const classNames = (classes: Record<string, boolean>) => {
  return Object.keys(classes)
    .filter((className) => classes[className])
    .join(" ");
};

export const getSkeletonLength = () => {
  return instasellLiveEmbedConfig.skeletonLength || 6;
};

export const formatCurrency = (amount: number, currency: string = "INR") => {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      // maximumSignificantDigits: 0,
      // minimumSignificantDigits: 0,
    }).format(amount);
  } catch (err) {
    return `₹${amount}`;
  }
};

export const initializeStoreStylesCarousel = () => {
  const shopName = (window as any).Shopify?.shop;
  const isProductPage = window.location.pathname.includes("/products/");

  switch (shopName) {
    case "healthfabindia.myshopify.com":
      if (isProductPage) {
        const videosElement = document.getElementById("videos");
        if (!videosElement) return;

        const el = videosElement.cloneNode(true) as HTMLElement;
        videosElement.replaceWith(el);

        el.onclick = () => {
          const target = document.getElementById("instasell-live-short-videos");
          if (!target) return;

          const start = window.scrollY;
          const end =
            target.getBoundingClientRect().top + start - window.innerHeight / 2;
          let startTime: number | undefined;

          requestAnimationFrame(function scroll(t: number) {
            if (startTime === undefined) startTime = t;
            const p = Math.min((t - startTime) / 600, 1);
            window.scrollTo(
              0,
              start +
              (end - start) *
              (p < 0.5 ? 2 * p ** 2 : 1 - Math.pow(-2 * p + 2, 2) / 2)
            );
            if (p < 1) requestAnimationFrame(scroll);
          });
        };
      }
      break;

    case "molifestyle-3.myshopify.com":
      const el = document.querySelector('.ins-reel-pop-player-modal-overlay.ins-reel-pop-player-modal-overlay__is-pip-active') as HTMLElement;
      if (!el) break;
      Object.assign(el.style, {
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: '1em',
        transition: 'bottom 0.5s'
      });
      addEventListener('scroll', () =>
        el.style.bottom = scrollY / (document.body.scrollHeight - innerHeight) > 0.1 ? '10.5em' : '1em'
      );
      dispatchEvent(new Event('scroll'));
      break;

    default:
      break;
  }
};