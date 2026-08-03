//apps/frontend/src/components/nutrients/NutrientCalculatorModal.tsx

"use client";

import { useEffect } from "react";
import { NutrientCalculator } from "./NutrientCalculator";

interface NutrientCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  plantStage?: string;
  plantStrain?: string;
  plantWeight?: number;
}

export function NutrientCalculatorModal({
  isOpen,
  onClose,
  plantStage,
  plantStrain,
  plantWeight,
}: NutrientCalculatorModalProps) {
  // Prevent body scroll when modal is open
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
      <div className="relative w-full max-w-2xl max-h-[95vh] overflow-y-auto">
        <NutrientCalculator
          mode="batch" // default, but user can toggle
          plantStage={plantStage}
          plantStrain={plantStrain}
          plantWeight={plantWeight}
          onClose={onClose}
        />
      </div>
    </div>
  );
}