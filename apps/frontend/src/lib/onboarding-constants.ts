export type OnboardingStep = 0 | 1 | 2 | 3 | 4 | 5;
// 0 = not started, 5 = complete

export const ONBOARDING_STEPS = [
  {
    id: 1,
    label: "Add a Room",
    description: "Create your first grow space",
    href: "/rooms",
  },
  {
    id: 2,
    label: "Add a Plant",
    description: "Add your first plant to a room",
    href: "/plants",
  },
  {
    id: 3,
    label: "Create a Batch",
    description: "Group plants into a harvest cycle",
    href: "/batches",
  },
  {
    id: 4,
    label: "Log a Reading",
    description: "Record your first weight or environment reading",
    href: "/check-in",
  },
  {
    id: 5,
    label: "View Dashboard",
    description: "See your data come to life",
    href: "/dashboard",
  },
] as const;