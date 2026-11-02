"use client";

import { useEffect } from "react";

export function PrintTrigger() {
  useEffect(() => {
    // Give the browser a beat to render images before prompting print.
    const t = setTimeout(() => window.print(), 500);
    return () => clearTimeout(t);
  }, []);
  return null;
}