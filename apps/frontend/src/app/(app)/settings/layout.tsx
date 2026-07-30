'use client'

import Link from "next/link";
import { ReactNode, useState } from "react";
import {
  Cpu,
  FlaskConical,
  Building,
  Sliders,
  User,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { usePathname } from "next/navigation";

const navigationGroups = [
  {
    label: "Account",
    items: [
      {
        href: "/settings/profile",
        label: "Profile",
        icon: User,
      },
    ],
  },
  {
    label: "Facility",
    items: [
      {
        href: "/settings/facility",
        label: "Facility",
        icon: Building,
      },
      {
        href: "/settings/hardware",
        label: "Hardware",
        icon: Cpu,
      },
    ],
  },
  {
    label: "Cultivation",
    items: [
      {
        href: "/settings/nutrients",
        label: "Nutrients",
        icon: FlaskConical,
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        href: "/settings/system",
        label: "System",
        icon: Sliders,
      },
    ],
  },
];


export default function SettingsLayout({
  children,
}: {
  children: ReactNode;
}) {

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const pathname = usePathname();


  return (

    <div className="flex min-h-screen">


      {/* Desktop Settings Sidebar */}
      <aside
        className="hidden lg:flex flex-col flex-shrink-0 bg-zinc-900 border-r border-zinc-800 transition-all duration-200"
        style={{
          width: sidebarCollapsed ? "3.5rem" : "14rem",
        }}
      >

        <div className="p-4 text-white font-semibold">
          {!sidebarCollapsed && "Settings"}
        </div>


        <nav className="flex-1 space-y-5 px-3">

          {navigationGroups.map((group) => (

            <div key={group.label}>

              {!sidebarCollapsed && (
                <div className="px-3 mb-2 text-xs font-semibold uppercase text-zinc-500">
                  {group.label}
                </div>
              )}


              {group.items.map((item) => {

                const Icon = item.icon;
                const isActive = pathname === item.href;


                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={sidebarCollapsed ? item.label : undefined}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 transition ${
                      isActive
                        ? "bg-zinc-800 text-white"
                        : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                    } ${
                      sidebarCollapsed
                        ? "justify-center"
                        : ""
                    }`}
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

            </div>

          ))}

        </nav>


        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="m-3 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-zinc-400 hover:text-white hover:bg-zinc-800"
          aria-label={
            sidebarCollapsed
              ? "Expand sidebar"
              : "Collapse sidebar"
          }
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


      {/* Settings Content */}
      <main className="flex-1 min-w-0">

        <div className="px-4 py-6 lg:px-8 lg:py-8">

          {children}

        </div>

      </main>


    </div>

  );
}