import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BackLink } from "@/components/ui/BackLink";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-12 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <BackLink href="/" label="Back to Home" />
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 sm:p-12 shadow-sm">
          {children}
        </div>
      </div>
    </div>
  );
}