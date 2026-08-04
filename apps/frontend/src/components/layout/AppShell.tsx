"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Leaf,
  Menu,
  X,
  Gauge,
  Droplets,
  Settings,
  LogOut,
  ThermometerSun,
  Droplet,
  Wind,
  ChevronDown,
  Layers,
  Plus,
  Home,
} from "lucide-react";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useTelemetry } from "@/lib/telemetry-context";

type AppShellProps = {
  children: ReactNode;
  unitSystem?: "imperial" | "metric";
};

export function AppShell({
  children,
  unitSystem = "imperial",
}: AppShellProps) {

  const pathname = usePathname();
    useEffect(() => {
  setMobileMenuOpen(false);
}, [pathname]);

const checkInHref = useMemo(() => {
  if (pathname.startsWith('/rooms/')) {
    const segments = pathname.split('/');
    const roomId = segments[2]; // e.g., 'abc123'
    if (roomId) {
      return `/check-in?roomId=${roomId}`;
    }
  }
  return '/check-in';
}, [pathname]);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [settingsExpanded, setSettingsExpanded] = useState(
    pathname.startsWith("/settings")
  );

  const { data } = useTelemetry();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth/login";
  };


  const tabs = [
    {
      name: "Dashboard",
      href: "/dashboard",
      match: ["/dashboard"],
      icon: Gauge,
      color: "text-canopy dark:text-emerald-400",
    },
    {
      name: "Rooms",
      href: "/rooms",
      match: ["/rooms"],
      icon: Home,
      color: "text-canopy dark:text-emerald-400",
    },
    {
      name: "Batches",
      href: "/batches",
      match: ["/batches"],
      icon: Layers,
      color: "text-canopy dark:text-emerald-400",
    },
    {
      name: "Nutrients",
      href: "/nutrients",
      match: ["/nutrients"],
      icon: Droplets,
      color: "text-canopy dark:text-emerald-400",
    },
  ];


  const settingsLinks = [
    { name: "Profile", href: "/settings/profile" },
    { name: "Facility", href: "/settings/facility" },
    { name: "Hardware", href: "/settings/hardware" },
    { name: "Nutrients", href: "/settings/nutrients" },
    { name: "System", href: "/settings/system" },
  ];


  const env = data.latestEnvironment;


  const tempFormatted =
    env?.temperatureF !== undefined && env?.temperatureF !== null
      ? unitSystem === "imperial"
        ? `${Math.round(Number(env.temperatureF))}°F`
        : `${(((Number(env.temperatureF) - 32) * 5) / 9).toFixed(1)}°C`
      : "--";
  const rhFormatted =
    env?.humidity !== undefined && env?.humidity !== null
      ? `${Math.round(Number(env.humidity))}%`
      : "--";
  const vpdFormatted =
    env?.vpd !== undefined && env?.vpd !== null
      ? `${Number(env.vpd).toFixed(1)} kPa`
      : "--";
  return (
    <>
      <header className="border-b border-[#d9e2dc] dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          {/* Brand */}
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-md bg-canopy text-white">
              <Leaf className="size-5" />
            </div>
            <div className="hidden sm:block">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-clay dark:text-orange-400">
                Single-grower command
              </p>

              <h1 className="text-xl font-semibold text-graphite dark:text-zinc-100">
                Cultivator's Ledger
              </h1>
            </div>
          </Link>

          {/* Telemetry */}
          <div className="hidden sm:flex items-center gap-3 rounded-full border border-[#d9e2dc] dark:border-zinc-800 bg-mist/60 dark:bg-zinc-800/60 px-3 py-1.5 text-xs">
            <span className="flex items-center gap-1">
              <ThermometerSun className="size-3.5 text-orange-500" />
              {tempFormatted}
            </span>
            <span>|</span>
            <span className="flex items-center gap-1">
              <Droplet className="size-3.5 text-blue-500" />
              {rhFormatted}
            </span>
            <span>|</span>
            <span className="flex items-center gap-1">
              <Wind className="size-3.5 text-emerald-500" />
              {vpdFormatted}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Link
              href={checkInHref}
              className="hidden sm:inline-flex rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white"
                onClick={() => setMobileMenuOpen(false)}
            >
              Log a Reading
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="grid size-10 place-items-center rounded-md border border-[#d9e2dc] dark:border-zinc-800"
            >
              {mobileMenuOpen ? (
                <X className="size-5" />
              ) : (
                <Menu className="size-5" />
              )}
            </button>
          </div>
        </div>
      </header>
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm"
          onClick={() => {
            setMobileMenuOpen(false);
            setSettingsExpanded(false);
          }}
        >
          <nav
            className="absolute top-[73px] left-0 right-0 bg-white dark:bg-zinc-900 p-4 shadow-lg"
            onClick={(e)=>e.stopPropagation()}
          >
            <Link
              href={checkInHref}
              className="block rounded-xl bg-emerald-600 px-4 py-3 text-center font-bold text-white"
              onClick={() => setMobileMenuOpen(false)}
            >
              Log a Reading
            </Link>
            {tabs.map((tab)=>{
              const Icon = tab.icon;
              const isActive = tab.match?.some(
                route =>
                  pathname === route ||
                  pathname.startsWith(route + "/")
              );
              return (
                <Link
                  key={tab.name}
                  href={tab.href}
                  onClick={()=>setMobileMenuOpen(false)}
                  className={`mt-2 flex items-center gap-3 rounded-md px-4 py-3 ${
                    isActive
                      ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30"
                      : "text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  <Icon className={`size-5 ${tab.color}`} />
                  {tab.name}
                </Link>
              );
            })}
            <div className="my-3 border-t border-zinc-200 dark:border-zinc-800"/>
            <div className="flex items-center justify-between px-4 py-3">
              <span>
                Theme
              </span>
              <ThemeToggle />
            </div>
            <button
              onClick={()=>setSettingsExpanded(!settingsExpanded)}
              className="flex w-full items-center justify-between rounded-md px-4 py-3"
            >
              <span className="flex items-center gap-3">
                <Settings className="size-5"/>
                Settings
              </span>
              <ChevronDown
                className={`transition-transform ${
                  settingsExpanded ? "rotate-180" : ""
                }`}
              />
            </button>
            {settingsExpanded && (
              <div className="ml-8 space-y-1">
                {settingsLinks.map((item)=>{
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={()=>setMobileMenuOpen(false)}
                      className={`block rounded-md px-3 py-2 text-sm ${
                        isActive
                          ? "bg-emerald-600 text-white"
                          : "text-zinc-500"
                      }`}
                    >
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            )}
            <button
              onClick={handleLogout}
              className="mt-3 flex w-full items-center gap-3 rounded-md px-4 py-3 text-red-400"
            >
              <LogOut className="size-5"/>
              Logout
            </button>
          </nav>
        </div>
      )}
      {/* Floating Action Button - always visible when logged in */}
      {!mobileMenuOpen && (
        <Link
          href="/check-in"
          className="fixed bottom-6 right-6 z-20 flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 py-3.5 shadow-lg transition hover:bg-emerald-700 active:scale-95 sm:hidden"
        >
          <Plus className="size-5 text-white" />
          <span className="text-sm font-bold text-white">Log</span>
        </Link>
      )}
      <main>
        {children}
      </main>
    </>
  );
}