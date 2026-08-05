"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Leaf,
  Gauge,
  Droplets,
  ThermometerSun,
  Droplet,
  Wind,
  Layers,
  Home,
} from "lucide-react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useTelemetry } from "@/lib/telemetry-context";
import { AvatarMenu } from "./AvatarMenu";

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
    { name: "Nutrients", href: "/settings/nutrients" },
    { name: "Hardware", href: "/settings/hardware" },
    { name: "Billing", href: "/settings/billing" },
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

  const [user, setUser] = useState<{ email?: string; displayName?: string } | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        setUser({
          email: data.user.email || undefined,
          displayName: data.user.user_metadata?.displayName || undefined,
        });
      }
    };
    getUser();
  }, []);

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

            <AvatarMenu
              userEmail={user?.email}
              displayName={user?.displayName}
              checkInHref={checkInHref}
            />
          </div>
        </div>
      </header>

      <main>
        {children}
      </main>
    </>
  );
}