"use client";                                                                   
                                                                                
import { useState, useEffect } from "react";                                    
import { SectionPanel } from "@/components/layout/SectionPanel";                
import { ThemeToggle } from "@/components/ThemeToggle";                         
import { getSystemSettings, updateTempUnitPreference } from                     
"@/app/actions/system-settings";      
                                                                                
export default function SystemSettingsPage() {                                  
  const [preferredTempUnit, setPreferredTempUnit] = useState<"C" | "F">("C");   
  const [loading, setLoading] = useState(true);                              
  useEffect(() => {                                                             
    async function loadSettings() {                                             
      try {                                                                     
        const settings = await getSystemSettings();                             
        setPreferredTempUnit(settings.preferredTempUnit === "F" ? "F" : "C");   
      } catch (err) {                                                           
        console.error("Failed to load system settings:", err);                  
      } finally {                                                               
        setLoading(false);                                                      
      }                                                                         
    }                                                                           
    loadSettings();                                                             
  }, []);                                                                       
                                                                                
  async function handleTempUnitToggle(unit: "C" | "F") {                        
    setPreferredTempUnit(unit);                                                 
    await updateTempUnitPreference(unit);                                       
  }                                                                             
                                                                                
  if (loading) return <div className="text-xs text-zinc-500 py-8 text-center    
animate-pulse">Loading system preferences...</div>;                             
                                                                                
 return (
    <SectionPanel title="System Preferences & Displays">
      <div className="space-y-6 max-w-xl">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-white">Temperature Scale</h4>
            <p className="text-xs text-zinc-400">Choose preferred telemetry temperature display unit.</p>
          </div>
          <div className="flex bg-zinc-900 border border-zinc-800 p-1 rounded-lg">
            <button
              onClick={() => handleTempUnitToggle("C")}
              className={`px-3 py-1 text-xs font-bold rounded ${
                preferredTempUnit === "C" ? "bg-emerald-600 text-white" : "text-zinc-400 hover:text-white"
              }`}
            >
              °C
            </button>
            <button
              onClick={() => handleTempUnitToggle("F")}
              className={`px-3 py-1 text-xs font-bold rounded ${
                preferredTempUnit === "F" ? "bg-emerald-600 text-white" : "text-zinc-400 hover:text-white"
              }`}
            >
              °F
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-zinc-800 pt-4">
          <div>
            <h4 className="text-sm font-semibold text-white">UI Color Mode</h4>
            <p className="text-xs text-zinc-400">Toggle dark and light visual mode.</p>
          </div>
          <ThemeToggle />
        </div>
        <div className="border-t border-zinc-800 pt-4">
          <h4 className="text-sm font-semibold text-white">Data & Privacy</h4>
          <p className="text-xs text-zinc-400 mt-1">Manage your data export, deletion, and privacy settings.</p>
          <div className="mt-3 flex gap-2">
            <button className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition">
              Export All Data
            </button>
            <button className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition">
              Delete Account
            </button>
          </div>
        </div>
      </div>
    </SectionPanel>
  );
}