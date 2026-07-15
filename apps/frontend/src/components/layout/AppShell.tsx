"use client";

import { useState } from "react";
import { Leaf, Menu, X, Gauge, Weight, Droplets, Settings, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/auth/login';
  };

  const tabs = [
    { name: "Environment", href: "/", icon: Gauge, color: "text-canopy dark:text-emerald-400" },
    { name: "Weights", href: "/weights", icon: Weight, color: "text-canopy dark:text-emerald-400" },
    { name: "Nutrients", href: "/nutrients", icon: Droplets, color: "text-canopy dark:text-emerald-400" },
  ];

  return (
    <main className="min-h-screen bg-[#f6f8f4] dark:bg-zinc-950 text-graphite dark:text-zinc-100 transition-colors duration-200">
      <header className="border-b border-[#d9e2dc] dark:border-zinc-800 bg-white dark:bg-zinc-900 transition-colors duration-200 sticky top-0 z-40">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          
          {/* Left: Brand Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="grid size-10 place-items-center rounded-md bg-canopy text-white">
              <Leaf aria-hidden="true" className="size-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-clay dark:text-orange-400">
                Single-grower command
              </p>
              <h1 className="text-xl font-semibold tracking-normal text-graphite dark:text-zinc-100">
                Cultivator's Ledger
              </h1>
            </div>
          </Link>

          {/* Right: Status badge, ThemeToggle, Settings, Hamburger */}
          <div className="flex items-center gap-4">            
            <ThemeToggle />

            <Link href="/settings">
              <button className="grid size-10 place-items-center rounded-md border border-[#d9e2dc] dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-mist dark:hover:bg-zinc-800 transition-colors">
                <Settings className="size-5" />
              </button>
            </Link>

            {/* Hamburger – visible on all screen sizes */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="grid size-10 place-items-center rounded-md border border-[#d9e2dc] dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-mist dark:hover:bg-zinc-800"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}>
          <nav 
            className="absolute top-[73px] left-0 right-0 border-b border-[#d9e2dc] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 flex flex-col gap-2 shadow-lg animate-in slide-in-from-top-2 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = pathname === tab.href;
              return (
                <Link
                  key={tab.name}
                  href={tab.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 rounded-md px-4 py-3 text-base font-medium transition-colors ${
                    isActive
                      ? "bg-[#ebd2c1]/20 dark:bg-zinc-800 text-graphite dark:text-zinc-100"
                      : "text-zinc-600 dark:text-zinc-400 hover:bg-mist dark:hover:bg-zinc-800/50"
                  }`}
                >
                  <Icon className={`size-5 ${tab.color}`} />
                  <span>{tab.name}</span>
                </Link>
              );
            })}
            <Link
              href="/settings"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 rounded-md px-4 py-3 text-base font-medium text-zinc-600 dark:text-zinc-400 hover:bg-mist dark:hover:bg-zinc-800/50"
            >
              <Settings className="size-5 text-clay dark:text-orange-400" />
              <span>Settings</span>
            </Link>
                <ThemeToggle />

            {/* Logout and ThemeToggle in the menu */}
            <div className="border-t border-[#d9e2dc] dark:border-zinc-800 pt-4 mt-2">
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 rounded-md px-4 py-3 text-base font-medium text-zinc-600 dark:text-zinc-400 hover:bg-mist dark:hover:bg-zinc-800/50 w-full transition-colors"
              >
                <LogOut className="size-5 text-red-400" />
                <span>Logout</span>
              </button>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-base font-medium text-zinc-600 dark:text-zinc-400">Theme</span>
              </div>
            </div>
          </nav>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </div>
    </main>
  );
}