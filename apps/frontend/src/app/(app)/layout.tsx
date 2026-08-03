// apps/frontend/src/app/%28app%29/layout.tsx

import { AppShell } from "@/components/layout/AppShell";
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell>
      {children}
    </AppShell>
  );
}