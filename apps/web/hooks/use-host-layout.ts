"use client";

import { useCallback, useEffect, useState } from "react";

export type HostLayoutMode = "desktop" | "condensed" | "phone";
export type HostLayoutVariant = "standard" | "compact" | "heads-up";

const STORAGE_KEY = "host-layout-variant";

function getAutoMode(): HostLayoutMode {
  const width = window.innerWidth;
  if (width >= 1024) return "desktop";
  if (width >= 768) return "condensed";
  return "phone";
}

export function useHostLayout() {
  const [layoutMode, setLayoutMode] = useState<HostLayoutMode>("desktop");
  const [variant, setVariantState] = useState<HostLayoutVariant>("standard");

  // Load saved variant from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "compact" || saved === "heads-up" || saved === "standard") {
      setVariantState(saved);
    }
  }, []);

  // Auto-detect mode on resize
  useEffect(() => {
    function handleResize() {
      setLayoutMode(getAutoMode());
    }

    handleResize();

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", () => {
      setTimeout(handleResize, 150);
    });

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, []);

  const setVariant = useCallback((v: HostLayoutVariant) => {
    setVariantState(v);
    localStorage.setItem(STORAGE_KEY, v);
  }, []);

  return { layoutMode, variant, setVariant };
}
