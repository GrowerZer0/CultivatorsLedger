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
  { href: "/settings/hardware", label: "Hardware", icon: Cpu },
  { href: "/settings/nutrients", label: "Nutrients", icon: FlaskConical },
  { href: "/settings/facility", label: "Facility", icon: Building },
  { href: "/settings/system", label: "System", icon: Sliders },
  { href: "/settings/profile", label: "Profile", icon: User },
];

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="flex">
        {/* Desktop Sidebar */}
        <aside
          className="hidden lg:flex lg:flex-col lg:flex-shrink-0 transition-all duration-200 bg-zinc-900 border-r border-zinc-800"
          style={{ width: sidebarCollapsed ? '3.5rem' : '14rem' }}
        >
          <div className="flex flex-col h-full">
            <div className="p-4 border-b border-zinc-800">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                {!sidebarCollapsed && <span>Settings</span>}
              </h2>
            </div>
            <nav className="flex-1 overflow-y-auto p-4 space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition ${
                      sidebarCollapsed
                        ? "justify-center"
                        : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                    }`}
                    title={sidebarCollapsed ? item.label : undefined}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0 text-zinc-400" />
                    {!sidebarCollapsed && <span className="truncate font-medium">{item.label}</span>}
                  </Link>
                );
              })}
            </nav>
            <div className="p-4 border-t border-zinc-800">
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition"
                aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {sidebarCollapsed ? (
                  <ChevronRight className="w-5 h-5" />
                ) : (
                  <>
                    <ChevronLeft className="w-5 h-5" />
                    <span>Collapse</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </aside>

        {/* Mobile Navigation - Bottom Tab Bar */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-zinc-900 border-t border-zinc-800">
          <div className="flex justify-around items-center h-14">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex flex-col items-center gap-1 text-zinc-500 hover:text-emerald-400 transition"
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Main Content */}
        <main
          className="flex-1 min-w-0 lg:pl-0"
          style={{ paddingBottom: '5rem' }} // Space for mobile bottom nav
        >
          <div className="max-w-full px-4 py-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
