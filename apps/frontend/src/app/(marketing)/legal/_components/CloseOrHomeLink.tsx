"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, X } from "lucide-react";

export function CloseOrHomeLink() {
  const [openedFromLink, setOpenedFromLink] = useState<boolean | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setOpenedFromLink(params.has("from"));
  }, []);

  // Reserve space so the card doesn't jump while we decide
  if (openedFromLink === null) {
    return <div className="h-5" />;
  }

  if (openedFromLink) {
    return (
      <button
        type="button"
        onClick={() => window.close()}
        className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
      >
        <X className="size-4" />
        Close Tab
      </button>
    );
  }

  return (
    <Link
      href="/"
      className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
    >
      <ArrowLeft className="size-4" />
      Back to Home
    </Link>
  );
}