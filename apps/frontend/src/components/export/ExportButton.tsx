"use client";

import { useState } from "react";
import { Download, Loader2, Lock } from "lucide-react";
import Link from "next/link";
import { exportAllCSV, exportPlantCSV } from "@/server/actions/export";

interface ExportButtonProps {
  mode: "plant" | "all";
  plantId?: string;
  canExport: boolean;
  className?: string;
}

export function ExportButton({
  mode,
  plantId,
  canExport,
  className = "",
}: ExportButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    if (!canExport) return;
    setLoading(true);
    setError(null);
    try {
      const result =
        mode === "plant" && plantId
          ? await exportPlantCSV(plantId)
          : await exportAllCSV();

      if (!result.success) {
        setError(result.error);
        return;
      }

      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setLoading(false);
    }
  };

  const label = mode === "plant" ? "Export" : "Export CSV";

  if (!canExport) {
    return (
      <Link
        href="/settings/billing"
        title="Upgrade to Grower to export your data"
        className={`inline-flex items-center gap-2 rounded-lg bg-zinc-200 dark:bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors ${className}`}
      >
        <Lock className="size-3.5" />
        {label}
      </Link>
    );
  }

  return (
    <div className={`inline-flex flex-col items-end ${className}`}>
      <button
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 px-3 py-2 text-xs font-semibold text-white transition-colors disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Download className="size-3.5" />
        )}
        {loading ? "Exporting..." : label}
      </button>
      {error && (
        <span className="mt-1 text-[10px] text-red-500 max-w-[200px] text-right">
          {error}
        </span>
      )}
    </div>
  );
}