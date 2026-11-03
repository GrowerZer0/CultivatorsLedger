"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Scale, Loader2, Check, X } from "lucide-react";
import { recordDailyCheckInLog } from "@/server/actions/check-in";

interface WeightInputProps {
  plantId: string;
  currentWeightLbs: number | null;
  unitLabel: string; // "g" or "lbs"
  displayValue: string; // The formatted string (e.g. "412.3 g")
  isSmallScale: boolean;
}

export function WeightInput({
  plantId,
  currentWeightLbs,
  unitLabel,
  displayValue,
  isSmallScale,
}: WeightInputProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Focus input when edit mode starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Click outside to cancel (without saving)
  useEffect(() => {
    if (!isEditing) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsEditing(false); // Cancel, don't save
      }
    };
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isEditing]);

  const handleSave = () => {
    const parsed = parseFloat(inputValue);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setIsEditing(false);
      return;
    }

    // If the input is in grams, convert to lbs for the server
    const weightLbs = isSmallScale ? parsed / 453.592 : parsed;

    startTransition(async () => {
      const res = await recordDailyCheckInLog({
        plantId,
        weight: weightLbs,
        unit: "lbs",
        watered: false,
        fed: false,
        trainingEvent: "None",
      });

      if (res.success) {
        setIsEditing(false);
        router.refresh();
      } else {
        alert(res.error || "Failed to save weight");
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") {
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div ref={wrapperRef} className="flex items-center gap-1">
        <input
          ref={inputRef}
          type="number"
          step="0.01"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isPending}
          className="w-20 px-1.5 py-0.5 text-sm font-bold bg-white dark:bg-zinc-800 border-2 border-emerald-500 rounded outline-none"
        />
        <span className="text-[10px] text-zinc-500 font-bold uppercase">{unitLabel}</span>
        
        <button
          onClick={handleSave}
          disabled={isPending}
          className="p-1 text-emerald-600 hover:text-emerald-500 disabled:opacity-50"
          title="Save (Enter)"
        >
          {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
        </button>
        <button
          onClick={() => setIsEditing(false)}
          disabled={isPending}
          className="p-1 text-zinc-400 hover:text-zinc-600 disabled:opacity-50"
          title="Cancel (Escape)"
        >
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => {
        const displayVal = currentWeightLbs !== null 
          ? (isSmallScale ? currentWeightLbs * 453.592 : currentWeightLbs).toFixed(1)
          : "";
        setInputValue(displayVal);
        setIsEditing(true);
      }}
      className="group flex items-center gap-1.5 px-1 -ml-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
      title="Click to log a new weight"
    >
      <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100 font-mono">
        {displayValue}
      </span>
      <Scale className="size-3 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}