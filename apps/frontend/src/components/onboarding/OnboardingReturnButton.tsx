"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";

interface OnboardingReturnButtonProps {
  currentPage: string;
}

export function OnboardingReturnButton({ currentPage }: OnboardingReturnButtonProps) {
  const router = useRouter();
  const [showButton, setShowButton] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const res = await fetch('/api/user/onboarding');
        const data = await res.json();
        const isActive = !data.onboardingCompleted && !data.onboardingDismissed;
        setShowButton(isActive);
      } catch (error) {
        console.error('Error checking onboarding:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkOnboarding();
  }, []);

  if (isLoading || !showButton) {
    return null;
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <button
        onClick={() => router.push('/dashboard')}
        className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-lg transition-all hover:scale-105 active:scale-95"
      >
        <ArrowLeft className="size-4" />
        <span>Return to Onboarding</span>
        <Sparkles className="size-4" />
      </button>
    </div>
  );
}
