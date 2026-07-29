import Link from "next/link";
import { Cpu, FlaskConical, Building, Sliders, User } from "lucide-react";
import { SectionPanel } from "@/components/layout/SectionPanel";
import { AppShell } from '@/components/layout/AppShell';

const navigation = [
  { href: "/settings/hardware", label: "Hardware", icon: Cpu, description: "Manage sensor integrations, API keys, and telemetry endpoints." },
  { href: "/settings/nutrients", label: "Nutrients", icon: FlaskConical, description: "Configure fertigation schedules, EC targets, and custom recipes." },
  { href: "/settings/facility", label: "Facility", icon: Building, description: "Organize rooms, tents, batches, and plant registry." },
  { href: "/settings/system", label: "System", icon: Sliders, description: "Set temperature units, UI preferences, and notifications." },
  { href: "/settings/profile", label: "Profile", icon: User, description: "Manage your account, subscription, and authentication." },
];

export default function SettingsHubPage() {
  return (
    <AppShell>
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">System Settings</h1>
        <p className="text-xs text-zinc-400 mt-1">Configure your cultivation environment, sensors, nutrients, and account.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="p-5 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-200 flex flex-col"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                  <Icon className="w-5 h-5 text-emerald-400" />
                </div>
                <h3 className="font-semibold text-white">{item.label}</h3>
              </div>
              <p className="text-xs text-zinc-400 flex-1">{item.description}</p>
              <div className="mt-4 flex items-center justify-between text-xs text-zinc-500">
                <span>Manage</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
    </AppShell>
  );
}
