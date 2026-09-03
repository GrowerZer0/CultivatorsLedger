"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ArrowRight,
  X,
  Settings,
  RotateCcw,
} from "lucide-react";

const STEPS = [
  { id: 1, label: "Create your first plant", description: "Add a plant to start tracking its growth", href: "/plants", action: "Add Plant" },
  { id: 2, label: "Log your first check-in", description: "Record weight, watering, and feeding data", href: "/check-in", action: "Log Now" },
  { id: 3, label: "Import your data", description: "Upload historical CSV data for your plants", href: "/dashboard", action: "Import CSV" },
  { id: 4, label: "Set up your room", description: "Configure environmental targets for your grow space", href: "/rooms", action: "Set Up" },
  { id: 5, label: "Explore your dashboard", description: "View insights and track your progress", href: "/dashboard", action: "View Dashboard" },
];

interface OnboardingChecklistProps {
  currentStep: number;
  completed: boolean;
  onDismiss?: () => void;
}

export function OnboardingChecklist({ currentStep, completed, onDismiss }: OnboardingChecklistProps) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isPending, setIsPending] = useState(false);

  const handleDismiss = async () => {
    setIsPending(true);
    try {
      await fetch('/api/onboarding/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dismissed: true }),
      });
      onDismiss?.();
      router.refresh();
    } catch (error) {
      console.error('Failed to dismiss onboarding:', error);
    } finally {
      setIsPending(false);
    }
  };

  const handleNavigateToStep = (stepId: number) => {
    const step = STEPS.find(s => s.id === stepId);
    if (step) {
      router.push(step.href);
    }
  };

  const handleSkip = () => {
    const nextStep = Math.min(currentStep + 1, 5);
    const step = STEPS.find(s => s.id === nextStep);
    if (step) {
      router.push(step.href);
    }
  };

  const handleComplete = async () => {
    setIsPending(true);
    try {
      await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      router.refresh();
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
    } finally {
      setIsPending(false);
    }
  };

  const handleRestart = async () => {
    setIsPending(true);
    try {
      await fetch('/api/onboarding/restart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      router.push('/plants');
      router.refresh();
    } catch (error) {
      console.error('Failed to restart onboarding:', error);
    } finally {
      setIsPending(false);
    }
  };

  // If completed, show completion state
  if (completed) {
    return (
      <div className="bg-gradient-to-br from-emerald-950/30 to-zinc-900/80 border border-emerald-500/20 rounded-2xl p-5 shadow-xl transition-all">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Sparkles className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">🎉 Onboarding Complete!</h3>
              <p className="text-xs text-zinc-400">You&apos;re all set up and ready to grow</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRestart}
              disabled={isPending}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
            >
              <RotateCcw className="size-3" />
              Restart
            </button>
            <Link
              href="/settings/profile"
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
            >
              <Settings className="size-3" />
              Settings
            </Link>
            <button
              type="button"
              onClick={handleDismiss}
              disabled={isPending}
              className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
        <div className="mt-4 border-t border-zinc-800/50 pt-4">
          <p className="text-xs text-zinc-500 mb-3">Click any step to revisit:</p>
          <div className="space-y-2">
            {STEPS.map((step) => (
              <div
                key={step.id}
                className="flex items-center gap-3 rounded-lg p-3 bg-zinc-800/20 hover:bg-zinc-800/40 transition-colors cursor-pointer"
                onClick={() => handleNavigateToStep(step.id)}
              >
                <div className="shrink-0 size-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">
                  <Check className="size-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-emerald-400">{step.label}</p>
                  <p className="text-xs text-zinc-500 truncate">{step.description}</p>
                </div>
                <span className="text-xs text-emerald-400">✓ Done</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const progress = Math.min(((currentStep - 1) / STEPS.length) * 100, 100);
  const currentStepConfig = STEPS.find(s => s.id === currentStep) || STEPS[0];
  const isLastStep = currentStep >= 5;

  return (
    <div className="bg-gradient-to-br from-emerald-950/30 to-zinc-900/80 border border-emerald-500/20 rounded-2xl p-5 shadow-xl transition-all">
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
            <p className="text-xs text-zinc-400">Click any step below to jump to it</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400"
          >
            {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            disabled={isPending}
            className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500" style={{ width: `${Math.min(progress, 100)}%` }} />
      </div>

      {isExpanded && (
        <div className="mt-4">
          {/* Current step */}
          {!isLastStep && currentStepConfig && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 mb-4">
              <div className="flex items-start gap-3">
                <div className="shrink-0 size-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">
                  {currentStep}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-white">{currentStepConfig.label}</h4>
                  <p className="text-xs text-zinc-400 mt-0.5">{currentStepConfig.description}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <Link
                      href={currentStepConfig.href}
                      className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors"
                    >
                      {currentStepConfig.action}
                      <ArrowRight className="size-3" />
                    </Link>
                    <button
                      type="button"
                      onClick={handleSkip}
                      disabled={isPending}
                      className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-50"
                    >
                      {isPending ? "Skipping..." : "Skip for now"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* All steps */}
          <div className="space-y-2">
            {STEPS.map((step) => {
              const isCompleted = step.id < currentStep;
              const isCurrent = step.id === currentStep;

              return (
                <div
                  key={step.id}
                  className={`
                    flex items-center gap-3 rounded-lg p-3 transition-all cursor-pointer
                    ${isCompleted ? "bg-emerald-500/5 border border-emerald-500/20 hover:bg-emerald-500/10" : ""}
                    ${isCurrent ? "bg-zinc-800/50 border border-emerald-500/30 hover:bg-zinc-800/70" : ""}
                    ${!isCompleted && !isCurrent ? "opacity-60 hover:opacity-100 hover:bg-zinc-800/30" : ""}
                  `}
                  onClick={() => handleNavigateToStep(step.id)}
                >
                  <div className={`
                    shrink-0 size-6 rounded-full flex items-center justify-center text-xs font-bold transition-all
                    ${isCompleted ? "bg-emerald-500 text-white" : ""}
                    ${isCurrent ? "bg-emerald-600 text-white ring-2 ring-emerald-500/50" : ""}
                    ${!isCompleted && !isCurrent ? "bg-zinc-700 text-zinc-500" : ""}
                  `}>
                    {isCompleted ? <Check className="size-3.5" /> : step.id}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`
                      text-sm font-medium
                      ${isCompleted ? "text-emerald-400" : ""}
                      ${isCurrent ? "text-white" : ""}
                      ${!isCompleted && !isCurrent ? "text-zinc-400" : ""}
                    `}>
                      {step.label}
                      {isCompleted && <span className="ml-2 text-[10px] text-emerald-400">✓ Done</span>}
                      {isCurrent && <span className="ml-2 text-[10px] text-emerald-400 animate-pulse">⏳ In progress</span>}
                    </p>
                    <p className="text-xs text-zinc-500 truncate">{step.description}</p>
                  </div>

                  <div className="shrink-0">
                    {isCompleted ? (
                      <span className="text-[10px] text-emerald-400">✓ Complete</span>
                    ) : isCurrent ? (
                      <span className="text-[10px] text-emerald-400 animate-pulse">Active</span>
                    ) : (
                      <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                        Click to start
                        <ArrowRight className="size-3" />
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 text-center">
            <p className="text-[10px] text-zinc-500">💡 Click any step above to jump directly to it</p>
          </div>

          {isLastStep && (
            <div className="mt-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="shrink-0 size-10 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                  <Sparkles className="size-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-white">🎉 You're almost ready!</h4>
                  <p className="text-xs text-zinc-400">Complete the final step to finish onboarding</p>
                </div>
                <button
                  type="button"
                  onClick={handleComplete}
                  disabled={isPending}
                  className="shrink-0 flex items-center gap-1 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
                >
                  {isPending ? "Completing..." : "Finish Setup 🚀"}
                  <ArrowRight className="size-3" />
                </button>
              </div>
            </div>
          )}

          <p className="text-[10px] text-zinc-600 text-center mt-3">
            💡 You can reopen this guide anytime in Settings → Profile
          </p>
        </div>
      )}
    </div>
  );
}
