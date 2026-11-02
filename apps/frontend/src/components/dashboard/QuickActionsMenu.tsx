"use client";

import { useEffect, useRef, useState } from "react";
import { Scale, FlaskConical, Sprout, Zap, ChevronDown } from "lucide-react";

interface QuickActionsMenuProps {
    onLogReading: () => void;
    onStartGrow: () => void;
    onNutrientCalc: () => void;
}

export function QuickActionsMenu({
    onLogReading,
    onStartGrow,
    onNutrientCalc,
}: QuickActionsMenuProps) {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef<HTMLDivElement>(null);

    // Close on outside click / Escape
    useEffect(() => {
        if (!open) return;
        const onDocClick = (e: MouseEvent) => {
            if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", onDocClick);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDocClick);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const item = (
        label: string,
        icon: React.ReactNode,
        onClick: () => void,
        accent: string,
    ) => (
        <button
            key={label}
            onClick={() => {
                setOpen(false);
                onClick();
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${accent}`}
        >
            {icon}
            {label}
        </button>
    );

    return (
        <div ref={wrapRef} className="relative">
            <button
                onClick={() => setOpen((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-sm"
                aria-haspopup="menu"
                aria-expanded={open}
            >
                <Zap className="size-3.5" />
                Quick Actions
                <ChevronDown
                    className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`}
                />
            </button>

            {open && (
                <div
                    role="menu"
                    className="absolute right-0 mt-2 w-56 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden z-40"
                >
                    {item(
                        "Log Reading",
                        <Scale className="size-4 text-emerald-500" />,
                        onLogReading,
                        "",
                    )}
                    {item(
                        "Mix Nutrients",
                        <FlaskConical className="size-4 text-amber-500" />,
                        onNutrientCalc,
                        "",
                    )}
                    {item(
                        "Start New Grow",
                        <Sprout className="size-4 text-emerald-500" />,
                        onStartGrow,
                        "",
                    )}
                </div>
            )}
        </div>
    );
}