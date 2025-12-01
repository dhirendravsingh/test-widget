import React, { useState, useEffect, useRef } from "react";
import { ChevronDownIcon } from "../icons";
import { ProductOption, ProductVariant } from "../../types/api";

interface VariantSelectorProps {
  onPurchase: (val: string) => void;
  variants: ProductVariant[];
  addToCartStatus: string;
  options: ProductOption[];
}

interface CustomDropdownProps {
  label: string;
  options: string[];
  selectedValue: string;
  onChange: (value: string) => void;
  resetDropdown: boolean;
  onDropdownToggle: (isOpen: boolean) => void;
}

const CustomDropdown: React.FC<CustomDropdownProps> = ({
  label,
  options,
  selectedValue,
  onChange,
  resetDropdown,
  onDropdownToggle,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLLabelElement>(null);

  useEffect(() => {
    if (resetDropdown) {
      setIsOpen(false);
    }
  }, [resetDropdown]);

  useEffect(() => {
    onDropdownToggle(isOpen);
  }, [isOpen, onDropdownToggle]);

  useEffect(() => {
    if (isOpen && labelRef.current) {
      const variantList = document.querySelector(
        ".ins-product-details-variants-list"
      );
      if (variantList) {
        const labelPosition = labelRef.current.getBoundingClientRect();
        const containerPosition = variantList.getBoundingClientRect();

        const scrollOffset = labelPosition.top - containerPosition.top;

        variantList.scrollTo({
          top: variantList.scrollTop + scrollOffset,
          behavior: "smooth",
        });
      }
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const optionsElement = optionsRef.current;
    const variantList = document.querySelector(
      ".ins-product-details-variants-list"
    );
    if (!optionsElement || !variantList) return;

    const handleWheel = (event: WheelEvent) => {
      const { deltaY } = event;
      const variantListElement = variantList as HTMLElement;

      const canScrollOuterUp = variantListElement.scrollTop > 0;
      const canScrollOuterDown =
        variantListElement.scrollTop <
        variantListElement.scrollHeight - variantListElement.clientHeight;

      const canScrollInnerUp = optionsElement.scrollTop > 0;
      const canScrollInnerDown =
        optionsElement.scrollTop <
        optionsElement.scrollHeight - optionsElement.clientHeight;

      if (
        (deltaY < 0 && canScrollOuterUp) ||
        (deltaY > 0 && canScrollOuterDown)
      ) {
        variantListElement.scrollTop += deltaY;
        event.preventDefault();
      } else if (
        (deltaY < 0 && canScrollInnerUp) ||
        (deltaY > 0 && canScrollInnerDown)
      ) {
        optionsElement.scrollTop += deltaY;
        event.preventDefault();
      }
    };

    optionsElement.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      optionsElement.removeEventListener("wheel", handleWheel);
    };
  }, [isOpen]);

  return (
    <div className="ins-product-details-option-group">
      <label ref={labelRef} className="ins-product-details-option-label">
        {label}
      </label>
      <div ref={dropdownRef} className="ins-product-details-custom-dropdown">
        <div
          className="ins-product-details-dropdown-selected"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span>{selectedValue || `Select ${label}`}</span>
          <ChevronDownIcon
            className={`ins-product-details-dropdown-chevron ${
              isOpen ? "rotate" : ""
            }`}
          />
        </div>
        {isOpen && (
          <div
            ref={optionsRef}
            className="ins-product-details-dropdown-options"
          >
            {options.map((option) => (
              <div
                key={option}
                className={`ins-product-details-dropdown-option ${
                  selectedValue === option ? "selected" : ""
                }`}
                onClick={() => {
                  onChange(option);
                  setIsOpen(false);
                }}
              >
                {option}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const VariantSelector: React.FC<VariantSelectorProps> = ({
  onPurchase,
  variants,
  options,
  addToCartStatus,
}) => {
  const [selectedOptions, setSelectedOptions] = useState<{
    [key: string]: string;
  }>({});
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [resetDropdowns, setResetDropdowns] = useState<boolean>(false);
  const [showOutOfStock, setShowOutOfStock] = useState<boolean>(false);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const [allOutOfStock, setAllOutOfStock] = useState<boolean>(false);
  const [currentVariantOutOfStock, setCurrentVariantOutOfStock] =
    useState<boolean>(false);
  const [openDropdowns, setOpenDropdowns] = useState<number>(0);
  const [drawerHeight, setDrawerHeight] = useState<number>(0);
  const [isLocallyLoading, setIsLocallyLoading] = useState<boolean>(false);

  // Check if this is buywow.in and should show variant boxes
  const isBuywowShop =
    typeof window !== "undefined" &&
    (window as any).Shopify?.shop === "buywow.in";
  const shouldShowVariantBoxes =
    isBuywowShop && (options.length === 0 || options.length === 1);

  // Calculate drawer height based on options and open dropdowns
  useEffect(() => {
    const baseHeight = 60; // Title + padding
    const optionHeight = 80; // Height per option group (label + dropdown)
    const dropdownOptionsHeight = 150; // Additional height when dropdown is open

    // For buywow.in with variant boxes, treat as 1 option
    const effectiveOptions = shouldShowVariantBoxes ? 1 : options.length;

    const calculatedHeight =
      baseHeight +
      effectiveOptions * optionHeight +
      openDropdowns * dropdownOptionsHeight;
    const maxHeight = 250;

    setDrawerHeight(Math.min(calculatedHeight, maxHeight));
  }, [options.length, openDropdowns, shouldShowVariantBoxes, variants.length]);

  // Track open dropdowns
  const handleDropdownToggle = (isDropdownOpen: boolean) => {
    setOpenDropdowns((prev) =>
      isDropdownOpen ? prev + 1 : Math.max(0, prev - 1)
    );
  };

  // Check if all variants are out of stock
  useEffect(() => {
    if (isBuywowShop) {
      setAllOutOfStock(false);
      return;
    }
    const allVariantsOutOfStock = variants.every((variant) => {
      // If policy is CONTINUE, always allow (backorders enabled)
      if (variant.ip === "CONTINUE") {
        return false;
      }

      // If policy is DENY but stock is positive, allow
      if (variant.ip === "DENY" && variant.s > 0) {
        return false;
      }

      // If policy is DENY and stock is 0 or negative, use availableForSale
      if (variant.ip === "DENY" && variant.s <= 0) {
        return !variant.af;
      }

      return false; // fallback - not out of stock
    });
    setAllOutOfStock(allVariantsOutOfStock);
  }, [variants, isBuywowShop]);

  // Set initial selections to first valid variant combination
  useEffect(() => {
    const getDefaultOptions = () => {
      // For buywow.in with variant boxes
      if (shouldShowVariantBoxes) {
        // Try to find first in-stock variant
        const inStockVariant = variants.find((v) => {
          if (v.ip === "CONTINUE") return true;
          if (v.ip === "DENY" && v.s > 0) return true;
          if (v.ip === "DENY" && v.s <= 0) return v.af;
          return true;
        });

        if (options.length === 1) {
          return { [options[0].n]: inStockVariant?.v || variants[0]?.v };
        } else if (options.length === 0) {
          return { variant: inStockVariant?.v || variants[0]?.v };
        }
      }

      // Create a map of all valid combinations
      const validCombinations = variants.map((v) => v.v.split(" / "));

      // Try to find first in-stock variant
      const inStockVariant = variants.find((v) => {
        // If policy is CONTINUE, always allow (backorders enabled)
        if (v.ip === "CONTINUE") {
          return true;
        }

        // If policy is DENY but stock is positive, allow
        if (v.ip === "DENY" && v.s > 0) {
          return true;
        }

        // If policy is DENY and stock is 0 or negative, use availableForSale
        if (v.ip === "DENY" && v.s <= 0) {
          return v.af;
        }

        return true; // fallback
      });
      if (inStockVariant) {
        const variantParts = inStockVariant.v.split(" / ");
        return options.reduce((acc, option, index) => {
          acc[option.n] = variantParts[index] || option.v[0];
          return acc;
        }, {} as { [key: string]: string });
      }

      // If no in-stock variants, use first valid combination
      if (validCombinations.length > 0) {
        return options.reduce((acc, option, index) => {
          acc[option.n] = validCombinations[0][index] || option.v[0];
          return acc;
        }, {} as { [key: string]: string });
      }

      // Fallback to first option values if no valid combinations
      return options.reduce((acc, option) => {
        acc[option.n] = option.v[0];
        return acc;
      }, {} as { [key: string]: string });
    };

    setSelectedOptions(getDefaultOptions());
  }, [options, variants, shouldShowVariantBoxes]);

  // Check if selected variant exists and is in stock
  const getSelectedVariant = (): ProductVariant | undefined => {
    const selectedValues = options
      .map((option) => selectedOptions[option.n] || option.v[0])
      .join(" / ");

    return variants.find((variant) => variant.v === selectedValues);
  };

  // Update out of stock status when selections change
  useEffect(() => {
    if (isBuywowShop) {
      setCurrentVariantOutOfStock(false);
      return;
    }

    const variant = shouldShowVariantBoxes
      ? getSelectedVariantForBoxes()
      : getSelectedVariant();

    const isOutOfStock =
      !variant ||
      (() => {
        // If policy is CONTINUE, always allow (backorders enabled)
        if (variant.ip === "CONTINUE") {
          return false;
        }

        // If policy is DENY but stock is positive, allow
        if (variant.ip === "DENY" && variant.s > 0) {
          return false;
        }

        // If policy is DENY and stock is 0 or negative, use availableForSale
        if (variant.ip === "DENY" && variant.s <= 0) {
          return !variant.af;
        }

        return false; // fallback - not out of stock
      })();
    setCurrentVariantOutOfStock(isOutOfStock);
  }, [selectedOptions, variants, shouldShowVariantBoxes, isBuywowShop]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        drawerRef.current &&
        !drawerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setShowOutOfStock(false);
        setOpenDropdowns(0); // Reset dropdown count
        const defaultSelections = getDefaultOptions();
        setSelectedOptions(defaultSelections);
        setResetDropdowns((prev) => !prev);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [variants, options]);

  const getDefaultOptions = () => {
    const inStockVariant = variants.find((variant) => {
      // If policy is CONTINUE, always allow (backorders enabled)
      if (variant.ip === "CONTINUE") {
        return true;
      }

      // If policy is DENY but stock is positive, allow
      if (variant.ip === "DENY" && variant.s > 0) {
        return true;
      }

      // If policy is DENY and stock is 0 or negative, use availableForSale
      if (variant.ip === "DENY" && variant.s <= 0) {
        return variant.af;
      }

      return true; // fallback
    });
    if (inStockVariant) {
      const defaultValues = inStockVariant.v.split(" / ");
      return options.reduce((acc, option, index) => {
        acc[option.n] = defaultValues[index] || option.v[0];
        return acc;
      }, {} as { [key: string]: string });
    }
    return options.reduce((acc, option) => {
      acc[option.n] = option.v[0];
      return acc;
    }, {} as { [key: string]: string });
  };

  const handleOptionChange = (optionName: string, value: string) => {
    const newOptions = { ...selectedOptions, [optionName]: value };
    setSelectedOptions(newOptions);

    if (isBuywowShop) {
      setCurrentVariantOutOfStock(false);
      return;
    }

    // Immediately check if this combination exists
    const selectedValues = options
      .map((option) =>
        option.n === optionName
          ? value
          : selectedOptions[option.n] || option.v[0]
      )
      .join(" / ");

    const variantExists = variants.some((v) => v.v === selectedValues);
    setCurrentVariantOutOfStock(!variantExists);
  };

  // Handler for variant box selection (buywow.in only)
  const handleVariantBoxSelect = (variant: ProductVariant) => {
    // For single option or no options, just select the variant directly
    if (options.length <= 1) {
      const newOptions =
        options.length === 1
          ? { [options[0].n]: variant.v }
          : { variant: variant.v };
      setSelectedOptions(newOptions);

      // Check if variant is out of stock
      const isOutOfStock = isVariantOutOfStock(variant);
      setCurrentVariantOutOfStock(isBuywowShop ? false : isOutOfStock);
    }
  };

  // Check if a variant is out of stock
  const isVariantOutOfStock = (variant: ProductVariant): boolean => {
    if (variant.ip === "CONTINUE") {
      return false;
    }
    if (variant.ip === "DENY" && variant.s > 0) {
      return false;
    }
    if (variant.ip === "DENY" && variant.s <= 0) {
      return !variant.af;
    }
    return false;
  };

  // Get selected variant for box UI
  const getSelectedVariantForBoxes = (): ProductVariant | undefined => {
    if (options.length === 1) {
      const selectedValue = selectedOptions[options[0].n];
      return variants.find((v) => v.v === selectedValue);
    } else if (options.length === 0) {
      // When no options, use the variant property directly
      const selectedValue = selectedOptions["variant"];
      return variants.find((v) => v.v === selectedValue);
    }
    return undefined;
  };

  const handleAddToCart = (
    e: React.JSX.TargetedMouseEvent<HTMLButtonElement>
  ) => {
    e.stopPropagation();

    if (!isBuywowShop && allOutOfStock) return;

    if (!isOpen) {
      setIsOpen(true);
      return;
    }

    if (!isBuywowShop && currentVariantOutOfStock) {
      setShowOutOfStock(true);
      setTimeout(() => {
        setShowOutOfStock(false);
      }, 2000);
      return;
    }

    // For variant boxes UI, use different getter
    const variant = shouldShowVariantBoxes
      ? getSelectedVariantForBoxes() || getSelectedVariant()
      : getSelectedVariant();
    console.log("Selected Variant :", variant);

    setIsLocallyLoading(true);

    requestAnimationFrame(() => {
      onPurchase(variant ? variant.pi : variants[0].pi);
    });
  };

  useEffect(() => {
    let timeoutId: number | undefined;

    if (addToCartStatus === "out-of-stock") {
      setIsLocallyLoading(false);
      setShowOutOfStock(true);
      timeoutId = window.setTimeout(() => {
        setShowOutOfStock(false);
      }, 3000);
    } else if (addToCartStatus === "added" || addToCartStatus === "add") {
      setIsLocallyLoading(false);
      setShowOutOfStock(false);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [addToCartStatus]);

  const handleChevronClick = (
    e: React.JSX.TargetedMouseEvent<HTMLSpanElement>
  ) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
    setShowOutOfStock(false);
    if (!isOpen) {
      setOpenDropdowns(0); // Reset dropdown count when closing
    }
  };

  const shouldShowStatusAsOutOfStock = isBuywowShop
    ? addToCartStatus === "out-of-stock"
    : currentVariantOutOfStock || showOutOfStock || allOutOfStock;

  const isButtonDisabled = isBuywowShop
    ? addToCartStatus === "out-of-stock"
    : allOutOfStock || currentVariantOutOfStock || showOutOfStock;

  const buttonLabel = (() => {
    if (isBuywowShop) {
      if (addToCartStatus === "out-of-stock") {
        return "Out of Stock";
      }
      if (isLocallyLoading || addToCartStatus === "adding") {
        return "Adding To Cart...";
      }
      if (addToCartStatus === "added") {
        return "Added";
      }
      return "ADD TO CART";
    }

    if (allOutOfStock) {
      return "Out of Stock";
    }
    if (
      currentVariantOutOfStock ||
      showOutOfStock ||
      addToCartStatus === "out-of-stock"
    ) {
      return "Out of Stock";
    }
    if (!isOpen) {
      return "ADD TO CART";
    }
    if (isLocallyLoading || addToCartStatus === "adding") {
      return "Adding To Cart...";
    }
    if (addToCartStatus === "added") {
      return "Added";
    }
    return "ADD TO CART";
  })();

  return (
    <div
      ref={drawerRef}
      className="ins-shoppable-video-variant-container"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className={`ins-shoppable-video-variant-drawer ${isOpen ? "open" : ""}`}
        style={{
          height: `${drawerHeight}px`,
          bottom: isOpen ? `calc(100% + 50px)` : `-${drawerHeight}px`,
        }}
      >
        <div className="ins-shoppable-video-variant-title">
          Select your variant
        </div>

        {shouldShowVariantBoxes ? (
          <div className="ins-product-details-variants-list">
            <CustomDropdown
              label="Options"
              options={variants.map((v) => v.v)}
              selectedValue={
                getSelectedVariantForBoxes()?.v || variants[0]?.v || ""
              }
              onChange={(value) => {
                const variant = variants.find((v) => v.v === value);
                if (variant) {
                  handleVariantBoxSelect(variant);
                }
              }}
              resetDropdown={resetDropdowns}
              onDropdownToggle={handleDropdownToggle}
            />
          </div>
        ) : (
          <div className="ins-product-details-variants-list">
            {options.map((option) => (
              <CustomDropdown
                key={option.n}
                label={option.n}
                options={option.v}
                selectedValue={selectedOptions[option.n] || option.v[0]}
                onChange={(value) => handleOptionChange(option.n, value)}
                resetDropdown={resetDropdowns}
                onDropdownToggle={handleDropdownToggle}
              />
            ))}
          </div>
        )}
      </div>

      <button
        className={`ins-shoppable-video-card-add-to-cart-with-variant ${
          shouldShowStatusAsOutOfStock ? "out-of-stock" : ""
        }`}
        onClick={handleAddToCart}
        disabled={isButtonDisabled}
      >
        <div className="ins-shoppable-video-card-add-to-cart-text-container">
          <p className="ins-shoppable-video-card-add-to-cart-text-with-variant">
            {buttonLabel}
          </p>
        </div>
        {!allOutOfStock && (
          <span
            style={{
              all: "unset",
              display: "inline-flex",
              cursor: "pointer",
            }}
            onClick={handleChevronClick}
          >
            <ChevronDownIcon
              className={`ins-shoppable-video-chevron-down ${
                isOpen ? "rotate" : ""
              }`}
            />
          </span>
        )}
      </button>
    </div>
  );
};

export default VariantSelector;
