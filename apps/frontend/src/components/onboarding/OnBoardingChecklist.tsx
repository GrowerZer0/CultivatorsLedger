"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, ChevronDown, ChevronUp, Sparkles, ArrowRight, X } from "lucide-react";
import { advanceOnboardingStep, setOnboardingDismissed, type OnboardingStep } from "@/server/actions/onboarding";
import { ONBOARDING_STEPS } from "@/lib/onboarding-constants";

interface OnboardingChecklistProps {
  currentStep: OnboardingStep;
  completed: boolean;
  onDismiss?: () => void; 
}

export function OnboardingChecklist({ currentStep, completed, onDismiss }: OnboardingChecklistProps) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [optimisticStep, setOptimisticStep] = useState(currentStep);
  const [optimisticCompleted, setOptimisticCompleted] = useState(completed);
  const [isDismissing, setIsDismissing] = useState(false);

  // If completed, don't show the checklist
  if (optimisticCompleted) {
    return null;
  }

const handleCompleteStep = async (stepId: OnboardingStep) => {   
   // If this is the last step, mark as complete
    if (stepId === 5) {
      startTransition(async () => {
        const result = await advanceOnboardingStep();
        if (result.success) {
          setOptimisticStep(result.step);
          setOptimisticCompleted(result.completed);
          router.refresh();
        }
      });
    }
  };

  const handleAdvance = async () => {
    startTransition(async () => {
      const result = await advanceOnboardingStep();
      if (result.success) {
        setOptimisticStep(result.step);
        setOptimisticCompleted(result.completed);
        router.refresh();
      }
    });
  };

const handleDismiss = () => {
  startTransition(async () => {
    const result = await setOnboardingDismissed(true);

    if (result.success) {
      router.refresh();
    }
  });
};

  // Find the next incomplete step
  const nextIncompleteStep = ONBOARDING_STEPS.find((s) => s.id > optimisticStep);
  const currentStepData = ONBOARDING_STEPS.find((s) => s.id === optimisticStep);
  const isLastStep = optimisticStep === 4; // Step 4 is "Log a Reading", Step 5 auto-completes

  return (
    <div className="bg-gradient-to-br from-emerald-950/30 to-zinc-900/80 border border-emerald-500/20 rounded-2xl p-5 shadow-xl transition-all">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
            <Sparkles className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Welcome! Let's get started</h3>
            <p className="text-xs text-zinc-400">
              {optimisticStep === 0
                ? "Complete these steps to set up your grow"
                : `${optimisticStep} of 5 steps complete`}
            </p>
          </div>
        </div>
<div className="flex items-center gap-1">
  <button
    onClick={() => setIsExpanded(!isExpanded)}
    className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400"
    aria-label={isExpanded ? "Collapse onboarding" : "Expand onboarding"}
  >
    {isExpanded ? (
      <ChevronUp className="size-4" />
    ) : (
      <ChevronDown className="size-4" />
    )}
  </button>

  <button
    onClick={handleDismiss}
    disabled={isPending}
    className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400"
    aria-label="Dismiss onboarding"
    title="Dismiss onboarding"
  >
    <X className="size-4" />
  </button>
</div>
      </div>
      

      {isExpanded && (
        <div className="mt-4 space-y-2">
          {ONBOARDING_STEPS.map((step) => {
            const isCompleted = step.id < optimisticStep;
            const isCurrent = step.id === optimisticStep;
            const stepIsPending = isCurrent && isPending;

            return (
              <div
                key={step.id}
                className={`
                  flex items-center gap-3 rounded-lg p-3 transition-all
                  ${isCompleted ? "bg-emerald-500/5 border border-emerald-500/20" : ""}
                  ${isCurrent ? "bg-zinc-800/50 border border-emerald-500/30" : ""}
                  ${!isCompleted && !isCurrent ? "opacity-60" : ""}
                `}
              >
                {/* Step indicator */}
                <div
                  className={`
                    shrink-0 size-6 rounded-full flex items-center justify-center text-xs font-bold
                    ${isCompleted ? "bg-emerald-500 text-white" : ""}
                    ${isCurrent ? "bg-emerald-600 text-white" : ""}
                    ${!isCompleted && !isCurrent ? "bg-zinc-700 text-zinc-500" : ""}
                  `}
                >
                  {isCompleted ? <Check className="size-3.5" /> : step.id}
                </div>

                <div className="flex-1 min-w-0">
                  <p
                    className={`
                      text-sm font-medium
                      ${isCompleted ? "text-emerald-400" : ""}
                      ${isCurrent ? "text-white" : ""}
                      ${!isCompleted && !isCurrent ? "text-zinc-500" : ""}
                    `}
                  >
                    {step.label}
                  </p>
                  <p className="text-xs text-zinc-500 truncate">{step.description}</p>
                </div>

                {isCurrent && (
                  <Link
                    href={step.href}
                    onClick={() => {
                      // If this is the dashboard step, complete it automatically
                      if (step.id === 5) {
                        handleCompleteStep(step.id);
                      }
                    }}
                    className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors"
                  >
                    {stepIsPending ? "Loading..." : "Do this →"}
                  </Link>
                )}

                {isCompleted && (
                  <span className="shrink-0 text-xs text-emerald-400">✓ Done</span>
                )}
              </div>
            );
          })}

          {/* Continue button when all steps are done */}
          {optimisticStep === 4 && !optimisticCompleted && (
            <button
              onClick={handleAdvance}
              disabled={isPending}
              className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-colors disabled:opacity-50"
            >
              {isPending ? "Completing..." : "🎉 Complete Onboarding"}
              <ArrowRight className="size-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}