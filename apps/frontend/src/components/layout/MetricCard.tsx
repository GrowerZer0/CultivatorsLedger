import type { LucideIcon } from "lucide-react";

type MetricCardProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
};

export function MetricCard({ icon: Icon, label, value, detail }: MetricCardProps) {
  return (
    <section className="rounded-lg border border-[#d9e2dc] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm transition-colors duration-200">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-[#66736b] dark:text-zinc-400">{label}</p>
        <Icon aria-hidden="true" className="size-5 text-clay dark:text-orange-400" />
      </div>
      <p className="text-2xl font-semibold tracking-normal text-graphite dark:text-zinc-100">{value}</p>
      <p className="mt-2 text-sm leading-5 text-[#66736b] dark:text-zinc-400">{detail}</p>
    </section>
  );
}