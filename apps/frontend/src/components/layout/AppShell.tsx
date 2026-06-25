"use client";

import { useState } from "react";
import { Leaf, Menu, X, LayoutDashboard, Settings, FlaskConical } from "lucide-react";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import Link from "next/link";
import { usePathname } from "next/navigation";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard, color: "text-canopy dark:text-emerald-400" },
    { name: "Settings", href: "/settings", icon: Settings, color: "text-clay dark:text-orange-400" },
  ];

  return (
    <main className="min-h-screen bg-[#f6f8f4] dark:bg-zinc-950 text-graphite dark:text-zinc-100 transition-colors duration-200">
      {/* Primary Header Area */}
      <header className="border-b border-[#d9e2dc] dark:border-zinc-800 bg-white dark:bg-zinc-900 transition-colors duration-200 sticky top-0 z-40">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          
          {/* Left Side: Brand Identity & Desktop Nav Links */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="grid size-10 place-items-center rounded-md bg-canopy text-white">
                <Leaf aria-hidden="true" className="size-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-clay dark:text-orange-400">
                  Single-grower command
                </p>
                <h1 className="text-xl font-semibold tracking-normal text-graphite dark:text-zinc-100">
                  Grower's Ledger
                </h1>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-[#ebd2c1]/20 dark:bg-zinc-800 text-graphite dark:text-zinc-100"
                        : "text-zinc-500 dark:text-zinc-400 hover:bg-mist dark:hover:bg-zinc-800/50 hover:text-graphite dark:hover:text-zinc-200"
                    }`}
                  >
                    <Icon className={`size-4 ${item.color}`} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right Side: Status Badge, Dark Mode & Hamburger Trigger */}
          <div className="flex items-center gap-4">
            <div className="hidden rounded-md border border-[#d9e2dc] dark:border-zinc-800 bg-mist dark:bg-zinc-800/50 px-3 py-2 text-sm font-medium text-canopy dark:text-emerald-400 lg:block">
              Local cultivation dashboard
            </div>
            
            <ThemeToggle />

            {/* Hamburger Button (Visible only on mobile/tablet widths) */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="grid size-10 place-items-center rounded-md border border-[#d9e2dc] dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-mist dark:hover:bg-zinc-800 md:hidden"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>

        </div>
      </header>

      {/* Mobile Menu Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-30 bg-black/20 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}>
          <nav 
            className="absolute top-[73px] left-0 right-0 border-b border-[#d9e2dc] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 flex flex-col gap-2 shadow-lg animate-in slide-in-from-top-2 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 rounded-md px-4 py-3 text-base font-medium transition-colors ${
                    isActive
                      ? "bg-[#ebd2c1]/20 dark:bg-zinc-800 text-graphite dark:text-zinc-100"
                      : "text-zinc-600 dark:text-zinc-400 hover:bg-mist dark:hover:bg-zinc-800/50"
                  }`}
                >
                  <Icon className={`size-5 ${item.color}`} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      )}

      {/* Main Panel Content Area */}
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </div>
    </main>
  );
}