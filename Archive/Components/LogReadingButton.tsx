"use client";

import Link from "next/link";
import { Scale } from "lucide-react";

interface LogReadingButtonProps {
  plantId?: string;
  returnTo: string;
  variant?: "compact" | "full";
  className?: string;
}

export function LogReadingButton({
  plantId,
  returnTo,
  variant = "compact",
  className = "",
}: LogReadingButtonProps) {
  const href = plantId
    ? `/check-in?plantId=${plantId}&returnTo=${encodeURIComponent(returnTo)}`
    : `/check-in?returnTo=${encodeURIComponent(returnTo)}`;

  if (variant === "full") {
    return (
      <Link
        href={href}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors ${className}`}
      >
        <Scale className="size-3.5" />
        Log Reading
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors ${className}`}
      title="Log reading"
    >
      <Scale className="size-3.5" />
      <span className="hidden md:inline">Log</span>
    </Link>
  );
}