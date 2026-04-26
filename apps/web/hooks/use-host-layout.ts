"use client";

import { useEffect, useState } from "react";

export type HostLayoutMode = "desktop" | "condensed" | "phone";

export function useHostLayout() {
  const [layoutMode, setLayoutMode] = useState<HostLayoutMode>("desktop");

  useEffect(() => {
    function handleResize() {
      const width = window.innerWidth;
      
      if (width >= 1024) {
        setLayoutMode("desktop");
      } else if (width >= 768) {
        setLayoutMode("condensed");
      } else {
        setLayoutMode("phone");
      }
    }

    // Initial check
    handleResize();

    window.addEventListener("resize", handleResize);
    // Listen for orientation changes explicitly for mobile devices
    window.addEventListener("orientationchange", () => {
      // Add a small delay to allow window.innerWidth to update after rotation
      setTimeout(handleResize, 150);
    });

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, []);

  return layoutMode;
}
