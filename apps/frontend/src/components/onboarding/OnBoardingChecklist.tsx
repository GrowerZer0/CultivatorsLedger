"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ArrowRight,
  X,
} from "lucide-react";
import {
  advanceOnboardingStep,
  setOnboardingDismissed,
  type OnboardingStep,
} from "@/server/actions/onboarding";

interface OnboardingStepConfig {
  id: number;
  label: string;
  description: string;
  href: string;
  action?: string;
}

const ONBOARDING_STEPS: OnboardingStepConfig[] = [
  {
    id: 1,
    label: "Create your first plant",
    description: "Add a plant to start tracking its growth",
    href: "/plants",
    action: "Add Plant",
  },
  {
    id: 2,
    label: "Log your first check-in",
    description: "Record weight, watering, and feeding data",
    href: "/check-in",
    action: "Log Now",
  },
  {
    id: 3,
    label: "Import your data",
    description: "Upload historical CSV data for your plants",
    href: "/dashboard",
    action: "Import CSV",
  },
  {
    id: 4,
    label: "Set up your room",
    description: "Configure environmental targets for your grow space",
    href: "/rooms",
    action: "Set Up",
  },
  {
    id: 5,
    label: "Explore your dashboard",
    description: "View insights and track your progress",
    href: "/dashboard",
    action: "View Dashboard",
  },
];

interface OnboardingChecklistProps {
  currentStep: OnboardingStep;
  completed: boolean;
  onDismiss?: () => void;
}

export function OnboardingChecklist({
  currentStep,
  completed,
  onDismiss,
}: OnboardingChecklistProps) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [optimisticStep, setOptimisticStep] = useState(currentStep);
  const [optimisticCompleted, setOptimisticCompleted] = useState(completed);

  // Sync with props when they change
  useEffect(() => {
    setOptimisticStep(currentStep);
    setOptimisticCompleted(completed);
  }, [currentStep, completed]);

  if (optimisticCompleted) {
    return null;
  }

  const handleDismiss = () => {
    startTransition(async () => {
      const result = await setOnboardingDismissed(true);
      if (result.success) {
        onDismiss?.();
        router.refresh();
      }
    });
  };

  const handleCompleteOnboarding = () => {
    startTransition(async () => {
      const result = await advanceOnboardingStep();
      if (result.success) {
        setOptimisticStep(result.step);
        setOptimisticCompleted(result.completed);
        router.refresh();
      }
    });
  };

  const handleSkip = () => {
    startTransition(async () => {
      const result = await advanceOnboardingStep();
      if (result.success) {
        setOptimisticStep(result.step);
        setOptimisticCompleted(result.completed);
        router.refresh();
      }
    });
  };

  const currentStepConfig = ONBOARDING_STEPS.find(s => s.id === optimisticStep) || ONBOARDING_STEPS[0];
  const isLastStep = optimisticStep >= 5;
  const progress = Math.min((optimisticStep / ONBOARDING_STEPS.length) * 100, 100);

  return (
    <div className="bg-gradient-to-br from-emerald-950/30 to-zinc-900/80 border border-emerald-500/20 rounded-2xl p-5 shadow-xl transition-all">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 animate-pulse">
            <Sparkles className="size-4" />
          </div>

          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Welcome! Let&apos;s get started
              <span className="text-[10px] font-normal bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
                {Math.round(progress)}%
              </span>
            </h3>
            <p className="text-xs text-zinc-400">
              {isLastStep 
                ? "Almost done! Complete the final step." 
                : `Step ${optimisticStep} of ${ONBOARDING_STEPS.length}: ${currentStepConfig?.label}`
              }
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400"
            aria-label={isExpanded ? "Collapse onboarding" : "Expand onboarding"}
          >
            {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>

          <button
            type="button"
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

      {/* Progress bar */}
      <div className="mt-3 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {isExpanded && (
        <div className="mt-4">
          {/* Current step focus */}
          {!isLastStep && currentStepConfig && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 mb-4">
              <div className="flex items-start gap-3">
                <div className="shrink-0 size-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">
                  {optimisticStep}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-white">{currentStepConfig.label}</h4>
                  <p className="text-xs text-zinc-400 mt-0.5">{currentStepConfig.description}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <Link
                      href={currentStepConfig.href}
                      onClick={() => {
                        // The user will complete the action, and the step will auto-advance
                        router.push(currentStepConfig.href);
                      }}
                      className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors"
                    >
                      {currentStepConfig.action || "Do this"}
                      <ArrowRight className="size-3" />
                    </Link>
                    <button
                      type="button"
                      onClick={handleSkip}
                      disabled={isPending}
                      className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-50"
                    >
                      Skip for now
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* All steps */}
          <div className="space-y-2">
            {ONBOARDING_STEPS.map((step) => {
              const isCompleted = step.id < optimisticStep;
              const isCurrent = step.id === optimisticStep && !isLastStep;

              return (
                <div
                  key={step.id}
                  className={`
                    flex items-center gap-3 rounded-lg p-3 transition-all
                    ${isCompleted ? "bg-emerald-500/5 border border-emerald-500/20" : ""}
                    ${isCurrent ? "bg-zinc-800/50 border border-emerald-500/30" : ""}
                    ${!isCompleted && !isCurrent ? "opacity-50" : ""}
                  `}
                >
                  {/* Step indicator */}
                  <div
                    className={`
                      shrink-0 size-6 rounded-full flex items-center justify-center text-xs font-bold
                      ${isCompleted ? "bg-emerald-500 text-white" : ""}
                      ${isCurrent ? "bg-emerald-600 text-white ring-2 ring-emerald-500/50" : ""}
                      ${!isCompleted && !isCurrent ? "bg-zinc-700 text-zinc-500" : ""}
                    `}
                  >
                    {isCompleted ? <Check className="size-3.5" /> : step.id}
                  </div>

                  {/* Step information */}
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
                      {isCompleted && <span className="ml-2 text-[10px] text-emerald-400">✓ Done</span>}
                      {isCurrent && <span className="ml-2 text-[10px] text-emerald-400 animate-pulse">⏳ In progress</span>}
                    </p>
                    <p className="text-xs text-zinc-500 truncate">
                      {step.description}
                    </p>
                  </div>

                  {/* Action button for completed steps - view again */}
                  {isCompleted && (
                    <Link
                      href={step.href}
                      className="shrink-0 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      View
                    </Link>
                  )}
                </div>
              );
            })}
          </div>

          {/* Completion button */}
          {isLastStep && (
            <div className="mt-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="shrink-0 size-10 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                  <Sparkles className="size-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-white">You&apos;re almost ready!</h4>
                  <p className="text-xs text-zinc-400">Complete the last step to finish onboarding</p>
                </div>
                <button
                  type="button"
                  onClick={handleCompleteOnboarding}
                  disabled={isPending}
                  className="shrink-0 flex items-center gap-1 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
                >
                  {isPending ? "Completing..." : "Finish Setup"}
                  <ArrowRight className="size-3" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
