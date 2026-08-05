"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { User, Settings, CreditCard, LogOut, Loader2 } from "lucide-react";

interface UserMenuProps {
  userEmail?: string;
  displayName?: string;
}

export function UserMenu({ userEmail, displayName }: UserMenuProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".user-menu")) {
        setIsOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // Get initials for avatar
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

  return (
    <div className="relative user-menu">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-full bg-zinc-800 hover:bg-zinc-700 transition-colors p-1.5 text-sm"
        aria-label="User menu"
      >
        <div className="size-8 rounded-full bg-emerald-600/20 text-emerald-400 flex items-center justify-center font-bold text-sm">
          {getInitials()}
        </div>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl border border-zinc-800 bg-zinc-950 shadow-xl py-1 z-50">
          {/* User info */}
          <div className="px-4 py-3 border-b border-zinc-800">
            <p className="text-sm font-medium text-white truncate">
              {displayName || "User"}
            </p>
            <p className="text-xs text-zinc-400 truncate">{userEmail || ""}</p>
          </div>

          {/* Menu items */}
          <button
            onClick={() => {
              setIsOpen(false);
              router.push("/settings/profile");
            }}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800/50 transition-colors"
          >
            <User className="size-4" />
            Profile
          </button>

          <button
            onClick={() => {
              setIsOpen(false);
              router.push("/settings/billing");
            }}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800/50 transition-colors"
          >
            <CreditCard className="size-4" />
            Billing
          </button>

          <button
            onClick={() => {
              setIsOpen(false);
              router.push("/settings");
            }}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800/50 transition-colors"
          >
            <Settings className="size-4" />
            Settings
          </button>

          <div className="border-t border-zinc-800 my-1" />

          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
          >
            {isLoggingOut ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <LogOut className="size-4" />
            )}
            {isLoggingOut ? "Logging out..." : "Logout"}
          </button>
        </div>
      )}
    </div>
  );
}