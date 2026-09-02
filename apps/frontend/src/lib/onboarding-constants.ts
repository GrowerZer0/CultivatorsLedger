export type OnboardingStep = 0 | 1 | 2 | 3 | 4 | 5;

export interface OnboardingStepConfig {
  id: OnboardingStep;
  label: string;
  description: string;
  href: string;
  action: string;
}

export const ONBOARDING_STEPS: OnboardingStepConfig[] = [
  {
    id: 1,
    label: "Create your first plant",
    description: "Add a plant to start tracking its growth journey",
    href: "/plants",
    action: "Add Plant",
  },
  {
    id: 2,
    label: "Log your first check-in",
    description: "Record weight, watering, and training data",
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
    description: "View insights, analytics, and recommendations",
    href: "/dashboard",
    action: "View Dashboard",
  },
];
