"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Leaf,
  ThermometerSun,
  Droplet,
  Wind,
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

  const checkInHref = useMemo(() => {
    if (pathname.startsWith('/rooms/')) {
      const segments = pathname.split('/');
      const roomId = segments[2];
      if (roomId) {
        return `/check-in?roomId=${roomId}`;
      }
    }
    return '/check-in';
  }, [pathname]);

  const { data } = useTelemetry();

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
    <div className="min-h-screen bg-zinc-950">
      {/* Header - Clean: Brand + Telemetry + Avatar */}
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          {/* Brand - Restored old logo style */}
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

          {/* Right side: Telemetry + Avatar */}
          <div className="flex items-center gap-3">
            {/* Telemetry */}
            <div className="hidden md:flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs">
              <span className="flex items-center gap-1 text-zinc-400">
                <ThermometerSun className="size-3.5 text-orange-400" />
                <span className="text-white">{tempFormatted}</span>
              </span>
              <span className="text-zinc-700">|</span>
              <span className="flex items-center gap-1 text-zinc-400">
                <Droplet className="size-3.5 text-blue-400" />
                <span className="text-white">{rhFormatted}</span>
              </span>
              <span className="text-zinc-700">|</span>
              <span className="flex items-center gap-1 text-zinc-400">
                <Wind className="size-3.5 text-emerald-400" />
                <span className="text-white">{vpdFormatted}</span>
              </span>
            </div>

            {/* Avatar Menu - Everything lives here */}
            <AvatarMenu
              userEmail={user?.email}
              displayName={user?.displayName}
              checkInHref={checkInHref}
              currentPath={pathname}
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
