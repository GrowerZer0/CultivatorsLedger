'use client'

import Link from "next/link";
import { ReactNode } from "react";
import {
  Cpu,
  FlaskConical,
  Building,
  Sliders,
  User,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";

const navigation = [
  { href: "/settings/profile", label: "Profile", icon: User },
  { href: "/settings/facility", label: "Facility", icon: Building },
  { href: "/settings/hardware", label: "Hardware", icon: Cpu },
  { href: "/settings/nutrients", label: "Nutrients", icon: FlaskConical },
  { href: "/settings/system", label: "System", icon: Sliders },
];

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
return (
  <div className="min-h-screen bg-zinc-950">

    {/* Mobile Drawer */}
    {mobileOpen && (
      <div className="lg:hidden fixed inset-0 z-50">

        <div
          className="absolute inset-0 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />

        <aside className="absolute left-0 top-0 bottom-0 w-72 bg-zinc-900 border-r border-zinc-800 p-5">

          <div className="flex justify-between items-center mb-6">
            <h2 className="text-white text-xl font-semibold">
              Settings
            </h2>

            <button
              onClick={() => setMobileOpen(false)}
              className="text-zinc-400 hover:text-white"
            >
              ✕
            </button>
          </div>

          <nav className="space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-3 text-zinc-400 hover:text-white hover:bg-zinc-800"
                >
                  <Icon className="size-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

        </aside>
      </div>
    )}


      {/* Settings Shell */}
      <div className="flex min-h-screen">
        
      {/* Desktop Sidebar */}
      <aside
        className="hidden lg:flex flex-col flex-shrink-0 bg-zinc-900 border-r border-zinc-800 transition-all duration-200"
        style={{
          width: sidebarCollapsed ? "3.5rem" : "14rem"
        }}
      >

        <div className="p-4 text-white font-semibold">
          {!sidebarCollapsed && "Settings"}
        </div>


        <nav className="flex-1 space-y-2 px-3">

          {navigation.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 transition ${
                  sidebarCollapsed
                    ? "justify-center"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                }`}
                title={sidebarCollapsed ? item.label : undefined}
              >

                <Icon className="size-5" />

                {!sidebarCollapsed && (
                  <span>
                    {item.label}
                  </span>
                )}

              </Link>
            );
          })}

        </nav>


        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="m-3 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-zinc-400 hover:text-white hover:bg-zinc-800"
        >

          {sidebarCollapsed ? (
            <ChevronRight />
          ) : (
            <>
              <ChevronLeft />
              Collapse
            </>
          )}

        </button>

      </aside>

    {/* Main Content */}
    <main className="flex-1 min-w-0">
      <div className="px-4 py-6 lg:px-8 lg:py-8">
        {/* Mobile Settings Toolbar */}
        <div className="lg:hidden flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-white">
            Settings
          </h1>
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-zinc-400 hover:text-white hover:bg-zinc-800"
            aria-label="Open settings menu"
          >
            ☰
          </button>
        </div>
        {children}
      </div>
    </main>
    </div>
  </div>
);
}
