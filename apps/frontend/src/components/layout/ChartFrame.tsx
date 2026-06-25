import type { ReactNode } from "react";

type ChartFrameProps = {
  children: ReactNode;
  title: string;
  value?: string;
};

export function ChartFrame({ children, title, value }: ChartFrameProps) {
  return (
    <section className="rounded-lg border border-[#d9e2dc] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm transition-colors duration-200">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-graphite dark:text-zinc-100">{title}</h2>
        {/* If a value prop is passed, render a clean tracker badge */}
        {value && (
          <span className="text-xs font-medium text-[#66736b] dark:text-zinc-400 bg-[#f4f1ea] dark:bg-zinc-800 px-2 py-1 rounded">
            {value}
          </span>
        )}
      </div>
      <div className="w-full h-72">{children}</div>
    </section>
  );
}