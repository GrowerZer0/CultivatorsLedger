"use client";

import { useState } from "react";
import { Leaf, Menu, X, Gauge, Weight, Droplets, Settings, LogOut, ThermometerSun, Droplet, Wind } from "lucide-react";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useTelemetry } from "@/lib/telemetry-context";
import AIChatWidget from "@/components/AIChatWidget";

  // Rooms & Locations state
  const [rooms, setRooms] = useState<any[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  // Batches state
  const [batches, setBatches] = useState<any[]>([]); // Using any[] temporarily, should be Batch[]
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  // Plants State
  const [plants, setPlants] = useState<Plant[]>([]); // Use the defined Plant type
  const [selectedPlantId, setSelectedPlantId] = useState<string | null>(null);

  const [containerGallons, setContainerGallons] = useState(5); // Default, will be overwritten by selection


// Define Plant type more accurately for local use
type Plant = {
  id: string;
  name: string;
  strain?: string | null;
  batchId?: string | null;
  roomId?: string | null;
  wetWeight?: number | null;
  dryTarget?: number | null;
  stage?: string | null; // Assuming stage exists for unit logic
  containerGallons?: number | null; // Assuming containerGallons also exists on Plant
};

type AppShellProps = {
  children: ReactNode;
  unitSystem?: "imperial" | "metric"; // Defaults to imperial (°F)
};

function getBatchDaysSinceStart(batch: any): number {
  if (!batch?.startDate) return 0;
  const start = new Date(batch.startDate).getTime();
  const now = new Date().getTime();
  const diffDays = Math.floor((now - start) / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays + 1);
}

function getBatchLogCount(batch: any): number {
  if (!batch?.dryBackLogs) return 0;
  return batch.dryBackLogs.length;
}

function getBatchAverage(batch: any): string {
  if (!batch?.dryBackLogs || batch.dryBackLogs.length === 0) return "0.0%";

  const total = batch.dryBackLogs.reduce((acc: number, log: any) => {
    const val = typeof log.dryBackPercent === "number" 
      ? log.dryBackPercent 
      : parseFloat(log.dryBackPercent) || 0;
    return acc + val;
  }, 0);

  const avg = total / batch.dryBackLogs.length;
  return `${Number(avg).toFixed(1)}%`;
}

export function AppShell({ children, unitSystem = "imperial" }: AppShellProps) {
  const router = useRouter(); 
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { data } = useTelemetry();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth/login";
  };

  const tabs = [
    { name: "Environment", href: "/", icon: Gauge, color: "text-canopy dark:text-emerald-400" },
    { name: "Weights", href: "/weights", icon: Weight, color: "text-canopy dark:text-emerald-400" },
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

              // --------------------------------------------
          // Plant & Tent Navigation Bar
          // --------------------------------------------
          interface RoomNavProps {
            rooms: { id: string; name: string }[];
            selectedRoomId: string | null;
            onSelectRoom: (roomId: string | null) => void;
          }
          
          function RoomNav({ rooms, selectedRoomId, onSelectRoom }: RoomNavProps) {
            return (
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
                <span className="text-[11px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider pr-1">
                  Location:
                </span>
                <button
                  onClick={() => onSelectRoom(null)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    selectedRoomId === null
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/20'
                      : 'bg-gray-100 dark:bg-zinc-900 text-gray-600 dark:text-zinc-400 border border-gray-200 dark:border-zinc-800 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  All Rooms
                </button>
                {rooms.map((room) => (
                  <button
                    key={room.id}
                    onClick={() => onSelectRoom(room.id)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      selectedRoomId === room.id
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/20'
                        : 'bg-gray-100 dark:bg-zinc-900 text-gray-600 dark:text-zinc-400 border border-gray-200 dark:border-zinc-800 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    {room.name}
                  </button>
                ))}
              </div>
            );
          }

  return (
    <main className="min-h-screen bg-[#f6f8f4] dark:bg-zinc-950 text-graphite dark:text-zinc-100 transition-colors duration-200">
      {/* Header */}
      <header className="border-b border-[#d9e2dc] dark:border-zinc-800 bg-white dark:bg-zinc-900 transition-colors duration-200 sticky top-0 z-40">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          
          {/* Brand Logo (left) */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="grid size-10 place-items-center rounded-md bg-canopy text-white">
              <Leaf aria-hidden="true" className="size-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-clay dark:text-orange-400">
                Single-grower command
              </p>
              <h1 className="text-xl font-semibold tracking-normal text-graphite dark:text-zinc-100">
                Cultivator's Ledger
              </h1>
            </div>
          </Link>

                    {/* Unified Navigation: Location, Batch, Plant */}
                    <div className="flex flex-col gap-3 pb-2 border-b border-gray-200 dark:border-zinc-800">
                      {/* Top Level: Location / Room Selector */}
                      <RoomNav rooms={rooms} selectedRoomId={selectedRoomId} onSelectRoom={setSelectedRoomId} />
          
                      {/* Middle Level: Batch Selector */}
                      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
                        <span className="text-[11px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider pr-1">
                          Batch:
                        </span>
                        <select
                          value={selectedBatchId || ''}
                          onChange={(e) => {
                            setSelectedBatchId(e.target.value || null);
                            setSelectedPlantId(null); // Reset plant selection when batch changes
                            setContainerGallons(plants.find((p) => p.batchId === e.target.value)?.containerGallons || 5); // Update container gallons
                          }}
                          className="bg-gray-100 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg px-3 py-1.5 text-xs font-bold text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white outline-none focus:border-emerald-500 transition-all"
                        >
                          <option value="">All Batches</option>
                          {batches
                            .filter((b) => !selectedRoomId || b.roomId === selectedRoomId)
                            .map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.name} ({b.cultivar})
                              </option>
                            ))}
                        </select>
                        <button
                          onClick={() => router.push('/settings')}
                          className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded-full transition-colors flex items-center gap-1"
                        >
                          Manage Facility
                        </button>
                      </div>
          
                      {/* Bottom Level: Plant Selector for selected Batch */}
                      {selectedBatchId && plants.filter(p => (!selectedBatchId || p.batchId === selectedBatchId) && (!selectedRoomId || p.roomId === selectedRoomId)).length > 0 && (
                        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
                          <span className="text-[11px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider pr-1">
                            Plant:
                          </span>
                          {plants
                            .filter((plant) => (!selectedBatchId || plant.batchId === selectedBatchId) && (!selectedRoomId || plant.roomId === selectedRoomId))
                            .map((plant) => (
                              <button
                                key={plant.id}
                                onClick={() => {
                                  setSelectedPlantId(plant.id);
                                  setContainerGallons(plant.containerGallons || 5); // Update container gallons on plant selection
                                }}
                                className={`px-3 py-1 text-xs font-semibold rounded-full transition-all flex items-center gap-1.5 ${
                                  selectedPlantId === plant.id
                                    ? 'bg-zinc-800 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-transparent text-gray-500 dark:text-zinc-400 border border-gray-200 dark:border-zinc-800 hover:text-gray-800 dark:hover:text-zinc-200'
                                }`}
                              >
                                <span>{plant.name}</span>
                                {plant.strain && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded border border-zinc-700 bg-zinc-900/60 opacity-80">
                                    {plant.strain}
                                  </span>
                                )}
                              </button>
                            ))}
                        </div>
                      )}
                      {/* Display batch stats only if a batch is selected */}
                      {selectedBatchId && (
                        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-zinc-400 pt-2 border-t border-gray-200 dark:border-zinc-800 mt-2">
                          <span>
                            Day {getBatchDaysSinceStart(selectedBatchId)}
                          </span>
                          <span>
                            {getBatchLogCount(selectedBatchId)} logs
                          </span>
                          <span className="text-emerald-400 font-mono">
                            Avg Dry-Back: {getBatchAverage(selectedBatchId)}
                          </span>
                        </div>
                      )}
                    </div>

          {/* Telemetry Header Pill (center) */}
          <div className="flex items-center gap-2 sm:gap-4 rounded-full border border-[#d9e2dc] dark:border-zinc-800 bg-mist/60 dark:bg-zinc-800/60 px-3 py-1.5 text-xs font-medium">
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

          {/* Hamburger (right) */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="grid size-10 place-items-center rounded-md border border-[#d9e2dc] dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-mist dark:hover:bg-zinc-800"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </header>

      {/* Dropdown Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}>
          <nav 
            className="absolute top-[73px] left-0 right-0 border-b border-[#d9e2dc] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 flex flex-col gap-2 shadow-lg animate-in slide-in-from-top-2 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
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

            <Link
              href="/settings"
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

      {/* AI Grow Coach – always visible, floating */}
      <AIChatWidget
        activeDryBack={data.activeDryBack || { dryBackPercent: 0, estimatedHoursUntilWater: 0, poundsUntilIrrigation: 0 }}
        reservoirDelta={data.reservoirDelta || { topOffGallons: 0, waterPercentToAdd: 0, nutrientsToAdd: [] }}
        latestEnvironment={data.latestEnvironment}
        latestRunoffEc={data.latestRunoffEc}
        activeSchedule={data.activeSchedule || { doses: [] }}
        leftoverGallons={data.leftoverGallons || 0}
        dailyWaterUse={data.dailyWaterUse}
        trendInsights={data.trendInsights}
        recoveryStatus={data.recoveryStatus}
      />
    </main>
  );
}