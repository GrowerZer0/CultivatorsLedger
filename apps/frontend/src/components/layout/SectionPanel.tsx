import type { ReactNode } from "react";

type SectionPanelProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function SectionPanel({ children }: SectionPanelProps) {
  return (
    <section className="rounded-lg border border-[#d9e2dc] dark:border-zinc-800 bg-white dark:bg-zinc-900/90 p-5 shadow-sm transition-colors duration-200">
      {children}
    </section>
  );
}
