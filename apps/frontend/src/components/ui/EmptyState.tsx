import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  /** Optional secondary link below the CTA */
  secondaryAction?: {
    label: string;
    href: string;
  };
  /** "compact" renders tighter padding — use inside cards/panels */
  variant?: "default" | "compact";
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  variant = "default",
}: EmptyStateProps) {
  const isCompact = variant === "compact";
  const padding = isCompact ? "py-10 px-4" : "py-16 px-4";
  const iconSize = isCompact ? "size-12" : "size-16";
  const iconInner = isCompact ? "size-6" : "size-8";

  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${padding} bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm`}
    >
      <div
        className={`${iconSize} bg-emerald-100 dark:bg-emerald-950/40 rounded-full flex items-center justify-center mb-4`}
      >
        <Icon className={`${iconInner} text-emerald-600 dark:text-emerald-400`} />
      </div>
      <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
        {title}
      </h2>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
        {description}
      </p>
      {action && (
        <div className="mt-6">
          {action.href ? (
            <a
              href={action.href}
              className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold transition-colors shadow-md"
            >
              {action.label}
            </a>
          ) : (
            <button
              onClick={action.onClick}
              className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold transition-colors shadow-md"
            >
              {action.label}
            </button>
          )}
        </div>
      )}
      {secondaryAction && (
        <a
          href={secondaryAction.href}
          className="mt-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          {secondaryAction.label}
        </a>
      )}
    </div>
  );
}