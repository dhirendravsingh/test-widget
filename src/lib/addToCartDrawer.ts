interface CartSelectors {
  forms: string[];
  buttons: string[];
}

const CONFIG: {
  selectors: CartSelectors;
  specialStores: {
    [key: string]: {
      name: string;
      handler: (variantId: string, productId?: string) => Promise<boolean>;
    };
  };
} = {
  selectors: {
    forms: [
      "#product-form-template--18762141761757__cc770632-b78d-42ab-89fe-7f766e1a3d7a",
      'form[action="/cart/add"]',
      "product-form form",
      ".shopify-product-form",
      ".product-form",
      "[data-product-form]",
      '[data-type="add-to-cart-form"]',
      "quick-add-product form",
      "product-form .shopify-product-form",
    ],
    buttons: [
      "product-item .addtocart-showbag",
      "#product-form-template--18762141761757__cc770632-b78d-42ab-89fe-7f766e1a3d7a .Sd_addProduct",
      'button[name="add"]',
      "button[data-atc-form]",
      ".t4s-product-form__submit",
      'button[type="submit"][name="add"]',
      ".product-form__submit",
      ".js-product-button-add-to-cart",
      ".addtocart-showbag",
      ".tt-btn-addtocart",
      '.button--secondary[type="submit"]',
      "[data-add-to-cart]",
      ".add-to-cart-button",
      'gp-product-button button[type="submit"][data-state="idle"]',
      ".quick-add__button[data-add-to-cart]",
      ".product-form__submit.button.button--full-width",
      "add-to-cart[data-variant-id]",
    ],
  },
  specialStores: {
    }
};

const bypassStores = ["dff598-2.myshopify.com"];
const directAtcStores = [
  "dreambiglittleco.myshopify.com",
  "dev-solara.myshopify.com",
];

// Safari detection (ignore Chrome on iOS)

function bypassValidation(element: HTMLElement | null): void {
  if (!element) return;

  const requiredInputs =
    element.querySelectorAll<HTMLInputElement>("[required]");
  requiredInputs.forEach((input) => {
    input.removeAttribute("required");
  });

  const form = element.closest<HTMLFormElement>("form");
  if (form) {
    const originalOnSubmit = form.onsubmit;
    form.onsubmit = function (e: Event) {
      e.stopImmediatePropagation();
      return true;
    };

    setTimeout(() => {
      form.onsubmit = originalOnSubmit;
    }, 1000);
  }

  element.removeAttribute("data-variant-selection-required");
  element.removeAttribute("data-requires-variant-selection");
  element.removeAttribute("data-validation");

  (element as HTMLButtonElement).disabled = false;
  element.classList.remove("disabled");

  const errorElements = document.querySelectorAll<HTMLElement>(
    ".product-form__error-message-wrapper"
  );
  errorElements.forEach((el) => {
    el.setAttribute("hidden", "");
  });
}

async function tryExistingElements(variantId: string): Promise<boolean> {
  const hasGoKwikCart = document.querySelector(".side-cart-header") !== null;

  if (
    hasGoKwikCart ||
    directAtcStores.includes((window as any).Shopify?.shop)
  ) {
    try {
      const response = await fetch("/cart/add.js", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `id=${variantId}&quantity=1`,
      });

      if (response.ok) {
        return true;
      }
    } catch (error) {
      return false;
    }
  }

  const addToCartBtn = Array.from(document.querySelectorAll("button")).find(
    (btn) =>
      btn.textContent?.trim().toLowerCase().includes("add to cart") &&
      btn.dataset.productId
  );
  if (addToCartBtn) {
    addToCartBtn.dataset.productId = variantId;
    addToCartBtn.click();
    return true;
  }

  for (const buttonSelector of CONFIG.selectors.buttons) {
    const button = document.querySelector<HTMLButtonElement>(buttonSelector);
    // if (!button) continue
    if (button) {
      bypassValidation(button);

      const form = button.closest<HTMLFormElement>("form");
      if (form) {
        bypassValidation(form);
        const variantInput =
          form.querySelector<HTMLInputElement>('input[name="id"]');
        if (variantInput) {
          variantInput.value = variantId;

          const events = [
            new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
            new MouseEvent("mouseup", { bubbles: true, cancelable: true }),
            new MouseEvent("click", { bubbles: true, cancelable: true }),
          ];

          for (const event of events) {
            button.dispatchEvent(event);
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
          return true;
        }
      }
    }
  }
  return false;
}

export async function addToCartDrawer(
  variantId: string,
  productId?: string
): Promise<boolean> {
  const currentShop = (window as any).Shopify?.shop;

  if (bypassStores.includes(currentShop)) {
    return false;
  }

  let networkSuccess = false;

  const checkCartAddEntry = (entry: any) => {
    const entryName = entry.name || entry.url || "";
    const responseStatus =
      entry.responseStatus ||
      entry.status ||
      entry.response?.status ||
      (entry.transferSize > 0 ? 200 : 0);

    return (
      entryName.includes("/cart/add") &&
      responseStatus >= 200 &&
      responseStatus < 300
    );
  };

  const observer = new PerformanceObserver((list) => {
    list.getEntries().forEach((entry) => {
      if (checkCartAddEntry(entry)) {
        networkSuccess = true;
      }
    });
  });

  observer.observe({ type: "resource", buffered: true });

  try {
    const specialStore = CONFIG.specialStores[currentShop];
    if (specialStore) {
      const result = await specialStore.handler(variantId, productId);
      return result;
    }

    const existingSuccess = await tryExistingElements(variantId);

    await new Promise((resolve) => setTimeout(resolve, 2500));

    try {
      const allResourceEntries = performance.getEntriesByType("resource");
      for (const entry of allResourceEntries) {
        if (checkCartAddEntry(entry)) {
          networkSuccess = true;
          break;
        }
      }
    } catch (e) {
      console.log(`%cError in checkCartAddEntry: ${e}`, "color: red;");
    }

    // Safari-specific fallback: If using default CONFIG path and button click succeeded,
    // assume network request also succeeded (Safari's PerformanceObserver might miss it)
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    if (isSafari && existingSuccess && !networkSuccess && !specialStore) {
      // Default CONFIG path succeeded, so the button click worked
      // In Safari, if button mimicry succeeded, the network request likely succeeded too
      networkSuccess = true;
    }

    return existingSuccess && networkSuccess;
  } catch (error) {
    return false;
  } finally {
    observer.disconnect();
  }
}
