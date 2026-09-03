"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
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
  Circle,
  CheckCircle2,
} from "lucide-react";

const STEPS = [
  { 
    id: 1, 
    label: "Create your first plant", 
    description: "Add a plant to start tracking its growth", 
    href: "/plants", 
    action: "Add Plant",
    buttonText: "Go to Plants",
    completeText: "Plant created! ✓"
  },
  { 
    id: 2, 
    label: "Log your first check-in", 
    description: "Record weight, watering, and feeding data", 
    href: "/check-in", 
    action: "Log Now",
    buttonText: "Go to Check-in",
    completeText: "Check-in logged! ✓"
  },
  { 
    id: 3, 
    label: "Import your data", 
    description: "Upload historical CSV data for your plants", 
    href: "/dashboard", 
    action: "Import CSV",
    buttonText: "Go to Dashboard",
    completeText: "Data imported! ✓"
  },
  { 
    id: 4, 
    label: "Set up your room", 
    description: "Configure environmental targets for your grow space", 
    href: "/rooms", 
    action: "Set Up",
    buttonText: "Go to Rooms",
    completeText: "Room set up! ✓"
  },
  { 
    id: 5, 
    label: "Explore your dashboard", 
    description: "View insights and track your progress", 
    href: "/dashboard", 
    action: "View Dashboard",
    buttonText: "Go to Dashboard",
    completeText: "Dashboard explored! ✓"
  },
];

interface OnboardingChecklistProps {
  currentStep: number;
  completed: boolean;
  onDismiss?: () => void;
}

export function OnboardingChecklist({ currentStep, completed, onDismiss }: OnboardingChecklistProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isPending, setIsPending] = useState(false);
  const [stepStatuses, setStepStatuses] = useState<Record<number, 'completed' | 'current' | 'pending'>>({});
  const [showSuccess, setShowSuccess] = useState(false);

  // Check step completion status whenever the page changes
  useEffect(() => {
    const checkStatuses = async () => {
      const statuses: Record<number, 'completed' | 'current' | 'pending'> = {};
      let foundCurrent = false;

      for (const step of STEPS) {
        let isComplete = false;
        try {
          if (step.id === 1) {
            const res = await fetch('/api/plants');
            const plants = await res.json();
            isComplete = plants.length > 0;
          } else if (step.id === 2) {
            const res = await fetch('/api/plants');
            const plants = await res.json();
            isComplete = plants.some((p: any) => p.currentWeight !== null);
          } else if (step.id === 3) {
            const res = await fetch('/api/import/history');
            const history = await res.json();
            isComplete = history.length > 0;
          } else if (step.id === 4) {
            const res = await fetch('/api/rooms');
            const rooms = await res.json();
            isComplete = rooms.length > 0;
          } else if (step.id === 5) {
            const res = await fetch('/api/user/onboarding');
            const data = await res.json();
            isComplete = data.dashboardVisited || false;
          }
        } catch {
          isComplete = false;
        }

        if (isComplete) {
          statuses[step.id] = 'completed';
        } else if (!foundCurrent) {
          statuses[step.id] = 'current';
          foundCurrent = true;
        } else {
          statuses[step.id] = 'pending';
        }
      }

      setStepStatuses(statuses);
      
      // Auto-advance if all completed
      const allCompleted = STEPS.every(step => statuses[step.id] === 'completed');
      if (allCompleted && !completed) {
        setShowSuccess(true);
        // Auto-complete onboarding
        fetch('/api/onboarding/complete', { method: 'POST' });
        setTimeout(() => {
          router.refresh();
        }, 1500);
      }
    };

    checkStatuses();
    // Re-check when pathname changes or every 5 seconds
    const interval = setInterval(checkStatuses, 5000);
    return () => clearInterval(interval);
  }, [pathname, completed, router]);

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
      // If step is already completed, just navigate
      if (stepStatuses[stepId] === 'completed') {
        router.push(step.href);
        return;
      }
      
      // For step 1 (add plant), navigate to plants page
      // The user will add a plant there, and the auto-check will detect it
      router.push(step.href);
      setIsExpanded(true);
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
      setStepStatuses({});
      setShowSuccess(false);
      router.push('/plants');
      router.refresh();
    } catch (error) {
      console.error('Failed to restart onboarding:', error);
    } finally {
      setIsPending(false);
    }
  };

  // Completed state - show success with celebration
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
              <p className="text-xs text-zinc-400">You're all set up and ready to grow</p>
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
          <div className="grid grid-cols-5 gap-2 text-center text-xs text-emerald-400">
            {STEPS.map((step) => (
              <div key={step.id} className="flex flex-col items-center">
                <CheckCircle2 className="size-4 mb-1" />
                <span className="text-[8px] text-zinc-500">{step.label.split(' ').slice(0,2).join(' ')}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-zinc-500 mt-3 text-center">
            🎯 All steps completed! You're ready to grow.
          </p>
        </div>
      </div>
    );
  }

  const progress = STEPS.length > 0 
    ? Math.min((STEPS.filter(s => stepStatuses[s.id] === 'completed').length / STEPS.length) * 100, 100) 
    : 0;
  
  const nextIncompleteStep = STEPS.find(s => stepStatuses[s.id] !== 'completed');

  return (
    <div className="bg-gradient-to-br from-emerald-950/30 to-zinc-900/80 border border-emerald-500/20 rounded-2xl p-5 shadow-xl transition-all">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 animate-pulse">
            <Sparkles className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              🚀 Onboarding Guide
              <span className="text-[10px] font-normal bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
                {Math.round(progress)}%
              </span>
            </h3>
            <p className="text-xs text-zinc-400">
              {nextIncompleteStep 
                ? `Next: ${nextIncompleteStep.label}`
                : "Almost done!"}
            </p>
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
          {/* Active step - show what to do next */}
          {nextIncompleteStep && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="shrink-0 size-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">
                  {nextIncompleteStep.id}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-white">Step {nextIncompleteStep.id}: {nextIncompleteStep.label}</h4>
                  <p className="text-xs text-zinc-400 mt-0.5">{nextIncompleteStep.description}</p>
                </div>
                <button
                  onClick={() => handleNavigateToStep(nextIncompleteStep.id)}
                  className="shrink-0 flex items-center gap-1 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors"
                >
                  {nextIncompleteStep.buttonText || nextIncompleteStep.action}
                  <ArrowRight className="size-3" />
                </button>
              </div>
            </div>
          )}

          {/* All steps with status */}
          <div className="space-y-1">
            {STEPS.map((step) => {
              const status = stepStatuses[step.id] || 'pending';
              const isCompleted = status === 'completed';
              const isCurrent = status === 'current';

              return (
                <div
                  key={step.id}
                  className={`
                    flex items-center gap-3 rounded-lg p-2.5 transition-all cursor-pointer group
                    ${isCompleted ? "bg-emerald-500/5 hover:bg-emerald-500/10" : ""}
                    ${isCurrent ? "bg-zinc-800/50 border border-emerald-500/30" : ""}
                    ${!isCompleted && !isCurrent ? "opacity-60 hover:opacity-100 hover:bg-zinc-800/30" : ""}
                  `}
                  onClick={() => handleNavigateToStep(step.id)}
                >
                  <div className="shrink-0">
                    {isCompleted ? (
                      <CheckCircle2 className="size-5 text-emerald-400" />
                    ) : isCurrent ? (
                      <div className="size-5 rounded-full border-2 border-emerald-400 flex items-center justify-center">
                        <div className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                      </div>
                    ) : (
                      <Circle className="size-5 text-zinc-600" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`
                      text-sm font-medium
                      ${isCompleted ? "text-emerald-400" : ""}
                      ${isCurrent ? "text-white" : ""}
                      ${!isCompleted && !isCurrent ? "text-zinc-400" : ""}
                    `}>
                      {step.label}
                    </p>
                    <p className="text-xs text-zinc-500 truncate">{step.description}</p>
                  </div>

                  <div className="shrink-0">
                    {isCompleted ? (
                      <span className="text-[10px] text-emerald-400">✓ Done</span>
                    ) : isCurrent ? (
                      <span className="text-[10px] text-emerald-400 animate-pulse">Active</span>
                    ) : (
                      <span className="text-[10px] text-zinc-500 group-hover:text-zinc-300 transition-colors">
                        Click
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Instructions */}
          <div className="mt-4 p-3 bg-zinc-800/30 rounded-lg border border-zinc-700/50">
            <p className="text-xs text-zinc-400">
              💡 <span className="font-medium text-zinc-300">How it works:</span> Click the action button above, complete the step, then return here. The checklist will auto-detect your progress.
            </p>
          </div>

          <p className="text-[10px] text-zinc-600 text-center mt-3">
            You can reopen this guide anytime in Settings → Profile
          </p>
        </div>
      )}
    </div>
  );
}
