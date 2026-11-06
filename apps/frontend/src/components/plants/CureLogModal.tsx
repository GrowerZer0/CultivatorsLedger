// src/components/plants/CureLogModal.tsx
"use client";

import { X } from "lucide-react";
import { DryCureTracker } from "@/components/facility/DryCureTracker";

interface CureLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  plantId: string;
  plantName: string;
  stage: "dry" | "cure";
  lastWeight: number | null;
  cureStartedAt: string | null;
}

export function CureLogModal({ isOpen, onClose, ...rest }: CureLogModalProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="relative">
          <button onClick={onClose} className="absolute -top-2 -right-2 p-2 bg-zinc-800 rounded-full text-zinc-300 hover:text-white z-10">
            <X className="size-4" />
          </button>
          <DryCureTracker
            plantId={rest.plantId}
            stage={rest.stage}
            lastWeight={rest.lastWeight}
            cureStartedAt={rest.cureStartedAt}
          />
        </div>
      </div>
    </div>
  );
}