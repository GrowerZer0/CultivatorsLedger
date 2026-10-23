"use client";

import { useEffect } from "react";
import { NutrientCalculator } from "./NutrientCalculator";

interface NutrientCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  plantStage?: string;
  plantStrain?: string;
  plantName?: string;
  weekOfStage?: number | null;
}

export function NutrientCalculatorModal({
  isOpen,
  onClose,
  plantStage,
  plantStrain,
  plantName,
  weekOfStage,
}: NutrientCalculatorModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md max-h-[95vh] overflow-y-auto">
        <NutrientCalculator
          plantStage={plantStage}
          plantStrain={plantStrain}
          plantName={plantName}
          weekOfStage={weekOfStage}
          onClose={onClose}
        />
      </div>
    </div>
  );
}