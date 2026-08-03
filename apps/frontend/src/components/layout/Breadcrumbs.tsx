//apps/frontend/src/components/layout/Breadcrumbs.tsx
"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type BreadcrumbSegment = {
  label: string;
  href: string | null; // null = current page (not clickable)
};

interface BreadcrumbsProps {
  segments: BreadcrumbSegment[];
}

export function Breadcrumbs({ segments }: BreadcrumbsProps) {
  return (
    <nav
      className="flex items-center gap-1 text-sm text-zinc-500 dark:text-zinc-400 mb-3"
      aria-label="Breadcrumb"
    >
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        return (
          <span key={index} className="flex items-center gap-1">
            {segment.href && !isLast ? (
              <Link
                href={segment.href}
                className="hover:text-emerald-500 transition-colors"
              >
                {segment.label}
              </Link>
            ) : (
              <span
                className={isLast ? "text-white font-medium" : "text-zinc-500"}
              >
                {segment.label}
              </span>
            )}
            {!isLast && <ChevronRight className="size-3.5 text-zinc-400" />}
          </span>
        );
      })}
    </nav>
  );
}