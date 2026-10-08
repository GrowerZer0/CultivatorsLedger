"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  Settings,
  LogOut,
  Loader2,
  User,
  Shield,
  CreditCard,
  Server,
  Leaf,
  Gauge,
  Droplets,
  Layers,
  Home,
  Sprout,
  CalendarCheck,
  FlaskConical,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

interface AvatarMenuProps {
  userEmail?: string;
  displayName?: string;
  checkInHref?: string;
  currentPath?: string;
}

export function AvatarMenu({ 
  userEmail, 
  displayName, 
  checkInHref = "/check-in",
  currentPath = ""
}: AvatarMenuProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  };

  const getInitials = () => {
    if (displayName) {
      const names = displayName.split(" ");
      if (names.length >= 2) {
        return `${names[0][0]}${names[1][0]}`.toUpperCase();
      }
      return displayName.slice(0, 2).toUpperCase();
    }
    if (userEmail) {
      return userEmail.slice(0, 2).toUpperCase();
    }
    return "U";
  };

  // Navigation - organized in logical workflow order
  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: Gauge },
    { name: "Plants", href: "/plants", icon: Sprout },
    { name: "Rooms", href: "/rooms", icon: Home },
  ];

  const settingsLinks = [
    { name: "Profile", href: "/settings/profile", icon: User },
    { name: "Billing", href: "/settings/billing", icon: CreditCard },
    { name: "Grow", href: "/settings/grow", icon: Sprout },
    { name: "Hardware", href: "/settings/hardware", icon: Server },
    { name: "System", href: "/settings/system", icon: Shield },
  ];

  const isActive = (href: string) => {
    return currentPath === href || currentPath?.startsWith(href + "/");
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* Avatar Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-full bg-zinc-800 hover:bg-zinc-700 transition-colors p-1.5"
        aria-label="Open menu"
      >
        <div className="size-8 rounded-full bg-emerald-600/20 text-emerald-400 flex items-center justify-center font-bold text-sm">
          {getInitials()}
        </div>
      </button>

      {/* Dropdown Menu - Full Navigation */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-xl border border-zinc-800 bg-zinc-950 shadow-xl py-2 z-50 max-h-[calc(100vh-80px)] overflow-y-auto">
          {/* User info */}
          <div className="px-4 py-3 border-b border-zinc-800">
            <p className="text-sm font-medium text-white truncate">
              {displayName || "User"}
            </p>
            <p className="text-xs text-zinc-400 truncate">{userEmail || ""}</p>
          </div>

          {/* Quick Action - Log a Reading */}
          <div className="px-2 py-2 border-b border-zinc-800">
            <Link
              href={checkInHref}
              onClick={() => setIsOpen(false)}
              className="block w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-center text-sm font-bold text-white hover:bg-emerald-700 transition-colors"
            >
              <span className="flex items-center justify-center gap-2">
                <CalendarCheck className="size-4" />
                Log a Reading
              </span>
            </Link>
          </div>

          {/* Navigation */}
          <div className="px-2 py-1">
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              Navigation
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    active
                      ? "bg-emerald-600/20 text-emerald-400"
                      : "text-zinc-300 hover:bg-zinc-800/50"
                  }`}
                >
                  <Icon className={`size-4 ${active ? "text-emerald-400" : "text-zinc-500"}`} />
                  {item.name}
                  {active && (
                    <span className="ml-auto size-1.5 rounded-full bg-emerald-400" />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Settings */}
          <div className="px-2 py-1 border-t border-zinc-800">
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              Settings
            </div>
            {settingsLinks.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    active
                      ? "bg-emerald-600/20 text-emerald-400"
                      : "text-zinc-300 hover:bg-zinc-800/50"
                  }`}
                >
                  <Icon className={`size-4 ${active ? "text-emerald-400" : "text-zinc-500"}`} />
                  {item.name}
                  {active && (
                    <span className="ml-auto size-1.5 rounded-full bg-emerald-400" />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Theme Toggle */}
          <div className="px-2 py-2 border-t border-zinc-800">
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-sm text-zinc-300">Theme</span>
              <ThemeToggle />
            </div>
          </div>

          {/* Logout */}
          <div className="px-2 py-1 border-t border-zinc-800">
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
            >
              {isLoggingOut ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <LogOut className="size-4" />
              )}
              {isLoggingOut ? "Logging out..." : "Logout"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
