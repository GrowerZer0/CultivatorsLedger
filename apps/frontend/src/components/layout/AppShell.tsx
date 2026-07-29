"use client";

import { useState } from "react";
import { Leaf, Menu, X, Gauge, Weight, Droplets, Settings, LogOut, ThermometerSun, Droplet, Wind, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useTelemetry } from "@/lib/telemetry-context";

// Define Plant type more accurately for local use
type Plant = {
  id: string;
  name: string;
  strain?: string | null;
  batchId?: string | null;
  roomId?: string | null;
  wetWeight?: number | null;
  dryTarget?: number | null;
  stage?: string | null;
  containerGallons?: number | null;
};

type AppShellProps = {
  children: ReactNode;
  unitSystem?: "imperial" | "metric";
};

export function AppShell({ children, unitSystem = "imperial" }: AppShellProps) {
  const router = useRouter(); 
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const { data } = useTelemetry();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth/login";
  };

  const tabs = [
    { name: "Dashboard", href: "/", icon: Gauge, color: "text-canopy dark:text-emerald-400" },
    { name: "Nutrients", href: "/nutrients", icon: Droplets, color: "text-canopy dark:text-emerald-400" },
  ];

  // --- Telemetry Data Extraction ---
  const env = data.latestEnvironment;
  
  // Format Temp (°F vs °C)
  const tempFormatted = env?.temperatureF !== undefined && env?.temperatureF !== null
    ? unitSystem === "imperial"
      ? `${Math.round(Number(env.temperatureF))}°F`
      : `${(((Number(env.temperatureF) - 32) * 5) / 9).toFixed(1)}°C`
    : "--";

  const rhFormatted = env?.humidity !== undefined && env?.humidity !== null
    ? `${Math.round(Number(env.humidity))}%`
    : "--";

  const vpdFormatted = env?.vpd !== undefined && env?.vpd !== null
    ? `${Number(env.vpd).toFixed(1)} kPa`
    : "--";

  return (
    <main className="min-h-screen bg-[#f6f8f4] dark:bg-zinc-950 text-graphite dark:text-zinc-100 transition-colors duration-200">
      {/* Header */}
      <header className="border-b border-[#d9e2dc] dark:border-zinc-800 bg-white dark:bg-zinc-900 transition-colors duration-200 sticky top-0 z-40">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          {/* Brand Logo (left) */}
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="grid size-10 place-items-center rounded-md bg-canopy text-white">
              <Leaf aria-hidden="true" className="size-5" />
            </div>
            <div className="hidden sm:block">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-clay dark:text-orange-400">
                Single-grower command
              </p>
              <h1 className="text-xl font-semibold tracking-normal text-graphite dark:text-zinc-100">
                Cultivator's Ledger
              </h1>
            </div>
          </Link>

          {/* Telemetry Pill (center) — hidden on mobile, shown sm and up */}
          <div className="hidden sm:flex items-center gap-2 sm:gap-4 rounded-full border border-[#d9e2dc] dark:border-zinc-800 bg-mist/60 dark:bg-zinc-800/60 px-3 py-1.5 text-xs font-medium">
            <div className="flex items-center gap-1 text-zinc-700 dark:text-zinc-300" title="Air Temperature">
              <ThermometerSun className="size-3.5 text-orange-500" />
              <span>{tempFormatted}</span>
            </div>
            <span className="text-zinc-300 dark:text-zinc-700">|</span>
            <div className="flex items-center gap-1 text-zinc-700 dark:text-zinc-300" title="Relative Humidity">
              <Droplet className="size-3.5 text-blue-500" />
              <span>{rhFormatted}</span>
            </div>
            <span className="text-zinc-300 dark:text-zinc-700">|</span>
            <div className="flex items-center gap-1 text-zinc-700 dark:text-zinc-300" title="Vapor Pressure Deficit">
              <Wind className="size-3.5 text-emerald-500" />
              <span>{vpdFormatted}</span>
            </div>
          </div>

          {/* Right side: Log a Reading + Hamburger */}
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="hidden sm:inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-2 text-xs font-bold text-white shadow-md shadow-emerald-950/20 transition-all"
            >
              Log a Reading
            </Link>
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

      {/* Dropdown Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}>
          <nav 
            className="absolute top-[73px] left-0 right-0 border-b border-[#d9e2dc] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 flex flex-col gap-2 shadow-lg animate-in slide-in-from-top-2 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <Link
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-base font-bold text-white shadow-lg mb-2"
            >
              Log a Reading
            </Link>
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

            <div className="border-t border-[#d9e2dc] dark:border-zinc-800 my-2" />

            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-base font-medium text-zinc-600 dark:text-zinc-400">Theme</span>
              <ThemeToggle />
            </div>

            {/* Settings Disclosure */}
            <Link
            href="/settings/profile"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 rounded-md px-4 py-3 text-base font-medium text-zinc-600 dark:text-zinc-400 hover:bg-mist dark:hover:bg-zinc-800/50"
            >
              <Settings className="size-5 text-clay dark:text-orange-400" />
              <span>Settings</span>
            </Link>

            <button
              onClick={handleLogout}
              className="flex items-center gap-3 rounded-md px-4 py-3 text-base font-medium text-zinc-600 dark:text-zinc-400 hover:bg-mist dark:hover:bg-zinc-800/50 w-full transition-colors"
            >
              <LogOut className="size-5 text-red-400" />
              <span>Logout</span>
            </button>
          </nav>
        </div>
      )}

      {/* Main content */}
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </div>
    </main>
  );
}
