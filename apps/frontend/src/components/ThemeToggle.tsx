"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration layout shift by waiting for client-side execution
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Exact sizing placeholder to avoid flickering or pushing your header items around
    return <div className="size-9 rounded-md bg-zinc-200/50 dark:bg-zinc-800/50" />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="p-2 rounded-md transition-all border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-graphite dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 shadow-sm shrink-0 active:scale-95"
      aria-label="Toggle theme color scheme"
    >
      {isDark ? (
        <Sun className="size-5 text-amber-500 fill-amber-500/10" />
      ) : (
        <Moon className="size-5 text-indigo-500 fill-indigo-500/10" />
      )}
    </button>
  );
}