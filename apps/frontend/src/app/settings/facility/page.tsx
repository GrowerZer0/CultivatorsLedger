"use client";

import React, { useState, useEffect } from "react";
import { Plus, X, Trash2, Edit, Building, TreePine, Package } from "lucide-react";
import { SectionPanel } from "@/components/layout/SectionPanel";
import { getRooms, createRoom, deleteRoom } from "@/app/actions/facility-mgmt";
import { getBatches, createBatch, updateBatch, deleteBatch } from "@/app/actions/batch-mgmt";
import { getPlantsForBatch, createPlant, updatePlant, deletePlant } from "@/app/actions/plant-mgmt";

interface Room { id: string; name: string; type: string; }
interface Batch { id: string; name: string; cultivar: string; roomId?: string | null; isActive: boolean; startDate?: Date | string; }
interface Plant { id: string; name: string; strain?: string | null; batchId?: string | null; roomId?: string | null; wetWeight?: number | null; dryTarget?: number | null; }

export default function FacilitySettingsPage() {
  const [activeTab, setActiveTab] = useState<"rooms" | "batches" | "plants">("rooms");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Form states
  const [newRoomName, setNewRoomName] = useState("");
  const [newBatchName, setNewBatchName] = useState("");
  const [newBatchCultivar, setNewBatchCultivar] = useState("");
  const [newBatchRoom, setNewBatchRoom] = useState<string | null>(null);
  const [showNewBatchModal, setShowNewBatchModal] = useState(false);
  const [newPlantName, setNewPlantName] = useState("");
  const [newPlantStrain, setNewPlantStrain] = useState("");
  const [newPlantWet, setNewPlantWet] = useState<number | ''>("");
  const [newPlantDry, setNewPlantDry] = useState<number | ''>("");
  const [newPlantRoomId, setNewPlantRoomId] = useState<string | null>(null);
  const [newPlantBatchId, setNewPlantBatchId] = useState<string | null>(null);
  const [showPlantModal, setShowPlantModal] = useState(false);
  const [editingPlant, setEditingPlant] = useState<Plant | null>(null);

  const loadRooms = useCallback(async () => {
    try { const data = await getRooms(); setRooms(data || []); } catch (err) { console.error("Failed to load rooms:", err); }
  }, []);

  const loadBatches = useCallback(async () => {
    try {
      const data = await getBatches();
      const formatted = data.map(b => ({ ...b, startDate: new Date(b.startDate).toISOString() }));
      setBatches(formatted || []);
      if (formatted.length > 0 && !selectedBatchId) setSelectedBatchId(formatted[0].id);
    } catch (err) { console.error("Failed to load batches:", err); }
  }, [selectedBatchId]);

  const loadPlants = useCallback(async () => {
    if (selectedBatchId) {
      try { const data = await getPlantsForBatch(selectedBatchId); setPlants(data || []); } catch (err) { console.error("Failed to load plants:", err); }
    } else { setPlants([]); }
  }, [selectedBatchId]);

  useEffect(() => { loadRooms(); loadBatches(); }, [loadRooms, loadBatches]);
  useEffect(() => { loadPlants(); setLoading(false); }, [loadPlants]);

  // Room handlers
  async function handleAddRoom(e: React.FormEvent) { e.preventDefault(); if (!newRoomName) return; const res = await createRoom({ name: newRoomName, type: "tent" }); if (res.success && res.room) { setRooms([...rooms, res.room]); setNewRoomName(""); } }
  async function handleDeleteRoom(id: string) { if (!confirm("Delete this space? All associated plants will unbind.")) return; const res = await deleteRoom(id); if (res.success) setRooms(rooms.filter(r => r.id !== id)); }

  // Batch handlers
  async function handleCreateBatch() { if (!newBatchName || !newBatchCultivar) { alert("Batch name and cultivar are required."); return; } try { await createBatch({ name: newBatchName, cultivar: newBatchCultivar, roomId: newBatchRoom || undefined, startDate: new Date(), isActive: true }); setShowNewBatchModal(false); setNewBatchName(""); setNewBatchCultivar(""); loadBatches(); } catch (error) { console.error('Failed to create batch:', error); alert('Failed to create batch.'); } }
  async function handleUpdateBatchStatus(batchId: string, isActive: boolean) { try { await updateBatch(batchId, { isActive }); loadBatches(); } catch (error) { console.error('Failed to update batch status:', error); alert('Failed to update batch status.'); } }
  async function handleDeleteBatch(batchId: string) { if (!confirm("Are you sure you want to delete this batch and all associated plants and logs?")) return; try { await deleteBatch(batchId); loadBatches(); } catch (error) { console.error('Failed to delete batch:', error); alert('Failed to delete batch.'); } }

  // Plant handlers
  async function handleAddPlant() { if (!newPlantName || !newPlantBatchId) { alert("Plant name and batch are required."); return; } try { await createPlant({ name: newPlantName, batchId: newPlantBatchId, roomId: newPlantRoomId || undefined, strain: newPlantStrain || undefined, wetWeight: newPlantWet !== '' ? Number(newPlantWet) : undefined, dryTarget: newPlantDry !== '' ? Number(newPlantDry) : undefined }); setShowPlantModal(false); setNewPlantName(""); setNewPlantWet(""); setNewPlantDry(""); setNewPlantStrain(""); loadPlants(); } catch (error) { console.error('Failed to add plant:', error); alert('Failed to add plant.'); } }
  async function handleUpdatePlant() { if (!editingPlant || !newPlantName) { alert("Plant name is required."); return; } try { await updatePlant({ id: editingPlant.id, name: newPlantName, strain: newPlantStrain || undefined, roomId: newPlantRoomId || undefined, wetWeight: newPlantWet !== '' ? Number(newPlantWet) : null, dryTarget: newPlantDry !== '' ? Number(newPlantDry) : null }); setShowPlantModal(false); setEditingPlant(null); setNewPlantName(""); setNewPlantWet(""); setNewPlantDry(""); setNewPlantStrain(""); loadPlants(); } catch (error) { console.error('Failed to update plant:', error); alert('Failed to update plant.'); } }
  async function handleDeletePlant(plantId: string) { if (!confirm("Are you sure you want to delete this plant and all its associated logs?")) return; try { await deletePlant(plantId); loadPlants(); } catch (error) { console.error('Failed to delete plant:', error); alert('Failed to delete plant.'); } }

  if (loading) return <div className="text-xs text-zinc-500 py-8 text-center animate-pulse">Loading facility data...</div>;

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex border-b border-zinc-800 pb-2 gap-4 overflow-x-auto">
        <button onClick={() => setActiveTab("rooms")} className={`whitespace-nowrap text-sm font-bold pb-2 border-b-2 transition-colors ${activeTab === "rooms" ? "border-emerald-500 text-emerald-400" : "border-transparent text-zinc-400 hover:text-zinc-200"} flex items-center gap-1.5`}><Building className="w-4 h-4" /> Rooms & Tents ({rooms.length})</button>
        <button onClick={() => setActiveTab("batches")} className={`whitespace-nowrap text-sm font-bold pb-2 border-b-2 transition-colors ${activeTab === "batches" ? "border-emerald-500 text-emerald-400" : "border-transparent text-zinc-400 hover:text-zinc-200"} flex items-center gap-1.5`}<Package className="w-4 h-4" /> Batches ({batches.length})</button>
        <button onClick={() => setActiveTab("plants")} className={`whitespace-nowrap text-sm font-bold pb-2 border-b-2 transition-colors ${activeTab === "plants" ? "border-emerald-500 text-emerald-400" : "border-transparent text-zinc-400 hover:text-zinc-200"} flex items-center gap-1.5`}><TreePine className="w-4 h-4" /> Plants ({plants.length})</button>
      </div>

      {/* Rooms Tab */}
      {activeTab === "rooms" && (
        <SectionPanel title="Grow Spaces & Rooms">
          <form onSubmit={handleAddRoom} className="flex gap-2 mb-4">
            <input type="text" placeholder="e.g. Main Tent / Tent 1" value={newRoomName} onChange={e => setNewRoomName(e.target.value)} className="flex-1 text-sm p-2 rounded bg-zinc-950 border border-zinc-800 text-white outline-none focus:border-emerald-500" required />
            <button type="submit" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-sm transition-colors flex items-center gap-1.5"><Plus className="w-4 h-4" /> Add Room</button>
          </form>
          <div className="divide-y divide-zinc-800/60 border border-zinc-800 rounded-xl overflow-hidden">
            {rooms.map(room => (
              <div key={room.id} className="p-4 flex justify-between items-center bg-zinc-900/50">
                <div><h4 className="font-bold text-sm text-white">{room.name}</h4><p className="text-xs text-zinc-500">Type: {room.type}</p></div>
                <button onClick={() => handleDeleteRoom(room.id)} className="text-xs font-semibold text-red-400 hover:text-red-300 p-2 flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
              </div>
            ))}
            {rooms.length === 0 && <p className="p-4 text-xs text-zinc-500 text-center">No rooms configured. Add your first grow space above.</p>}
          </div>
        </SectionPanel>
      )}

      {/* Batches Tab */}
      {activeTab === "batches" && (
        <SectionPanel title="Active Crop Batches">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-xs text-zinc-400">Organize your canopy into tracked batches with associated cultivars and grow rooms.</p>
              <button onClick={() => { setNewBatchRoom(rooms[0]?.id || null); setShowNewBatchModal(true); }} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1.5"><Plus className="w-4 h-4" /> Create New Batch</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {batches.map(batch => (
                <div key={batch.id} onClick={() => setSelectedBatchId(batch.id)} className={`cursor-pointer p-4 rounded-xl border transition ${selectedBatchId === batch.id ? "bg-zinc-900 border-emerald-500/50 shadow-lg shadow-emerald-500/5" : "bg-zinc-900/60 border-zinc-800 hover:border-zinc-700"}`}>
                  <div className="flex justify-between items-start mb-2"><h4 className="text-sm font-bold text-white">{batch.name}</h4><span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${batch.isActive ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-800 text-zinc-500"}`}>{batch.isActive ? "Active" : "Archived"}</span></div>
                  <p className="text-xs text-zinc-400">Cultivar: <span className="text-zinc-200 font-medium">{batch.cultivar}</span></p>
                  <p className="text-xs text-zinc-500 mt-1">Started: {batch.startDate ? new Date(batch.startDate).toLocaleDateString() : 'N/A'}</p>
                  <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-zinc-800/60">
                    <button onClick={e => { e.stopPropagation(); handleUpdateBatchStatus(batch.id, !batch.isActive); }} className="text-[11px] text-zinc-400 hover:text-white transition">{batch.isActive ? "Archive" : "Activate"}</button>
                    <button onClick={e => { e.stopPropagation(); handleDeleteBatch(batch.id); }} className="text-[11px] text-red-400 hover:text-red-300 transition">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SectionPanel>
      )}

      {/* Plants Tab */}
      {activeTab === "plants" && (
        <SectionPanel title={`Plants in Selected Batch`}>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-xs text-zinc-400">Manage individual plant telemetry metrics and target thresholds.</p>
              <button onClick={() => { setNewPlantBatchId(selectedBatchId); setNewPlantRoomId(rooms[0]?.id || null); setShowPlantModal(true); }} disabled={!selectedBatchId} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white transition flex items-center gap-1.5"><Plus className="w-4 h-4" /> Add Plant to Batch</button>
            </div>
            {plants.length === 0 ? (
              <div className="text-xs text-zinc-500 py-8 text-center border border-dashed border-zinc-800 rounded-xl">No plants registered for this batch. Select a batch and add plants above.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead><tr className="border-b border-zinc-800 text-zinc-400 font-semibold"><th className="py-2.5 px-3">Plant ID / Tag</th><th className="py-2.5 px-3">Strain</th><th className="py-2.5 px-3">Wet Weight</th><th className="py-2.5 px-3">Dry Target</th><th className="py-2.5 px-3 text-right">Actions</th></tr></thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {plants.map(plant => (
                      <tr key={plant.id} className="hover:bg-zinc-900/40">
                        <td className="py-3 px-3 font-medium text-white">{plant.name}</td>
                        <td className="py-3 px-3 text-zinc-400">{plant.strain || "--"}</td>
                        <td className="py-3 px-3 text-zinc-300">{plant.wetWeight ? `${plant.wetWeight} g` : "--"}</td>
                        <td className="py-3 px-3 text-zinc-300">{plant.dryTarget ? `${plant.dryTarget} g` : "--"}</td>
                        <td className="py-3 px-3 text-right space-x-2">
                          <button onClick={() => { setEditingPlant(plant); setNewPlantName(plant.name); setNewPlantStrain(plant.strain || ''); setNewPlantWet(plant.wetWeight ?? ''); setNewPlantDry(plant.dryTarget ?? ''); setShowPlantModal(true); }} className="text-zinc-400 hover:text-white transition"><Edit className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDeletePlant(plant.id)} className="text-red-400 hover:text-red-300 transition"><Trash2 className="w-3.5 h-3.5" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </SectionPanel>
      )}

      {/* Create Batch Modal */}
      {showNewBatchModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3"><h3 className="text-sm font-bold text-white">Register New Crop Batch</h3><button onClick={() => setShowNewBatchModal(false)} className="text-zinc-400 hover:text-white"><X className="w-4 h-4" /></button></div>
            <div className="space-y-3">
              <div><label className="text-xs font-medium text-zinc-300">Batch Name / Identifier</label><input type="text" placeholder="e.g. Batch #2026-07-B" value={newBatchName} onChange={e => setNewBatchName(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white mt-1 focus:border-emerald-500 outline-none" /></div>
              <div><label className="text-xs font-medium text-zinc-300">Cultivar / Strain</label><input type="text" placeholder="e.g. Blueberry Muffin" value={newBatchCultivar} onChange={e => setNewBatchCultivar(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white mt-1 focus:border-emerald-500 outline-none" /></div>
              <div><label className="text-xs font-medium text-zinc-300">Assigned Room</label><select value={newBatchRoom || ''} onChange={e => setNewBatchRoom(e.target.value || null)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white mt-1 focus:border-emerald-500 outline-none"><option value="">Unassigned</option>{rooms.map(room => <option key={room.id} value={room.id}>{room.name}</option>)}</select></div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800"><button onClick={() => setShowNewBatchModal(false)} className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white">Cancel</button><button onClick={handleCreateBatch} className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white">Create Batch</button></div>
          </div>
        </div>
      )}

      {/* Add/Edit Plant Modal */}
      {showPlantModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3"><h3 className="text-sm font-bold text-white">{editingPlant ? "Edit Plant Metadata" : "Register Plant in Batch"}</h3><button onClick={() => { setShowPlantModal(false); setEditingPlant(null); }} className="text-zinc-400 hover:text-white"><X className="w-4 h-4" /></button></div>
            <div className="space-y-3">
              <div><label className="text-xs font-medium text-zinc-300">Plant Tag / ID</label><input type="text" placeholder="e.g. Plant #01" value={newPlantName} onChange={e => setNewPlantName(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white mt-1 focus:border-emerald-500 outline-none" /></div>
              <div><label className="text-xs font-medium text-zinc-300">Strain Override</label><input type="text" placeholder="e.g. Blueberry Muffin Pheno #2" value={newPlantStrain} onChange={e => setNewPlantStrain(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white mt-1 focus:border-emerald-500 outline-none" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-zinc-300">Wet Weight (g)</label><input type="number" placeholder="0.0" value={newPlantWet} onChange={e => setNewPlantWet(e.target.value ? Number(e.target.value) : '')} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white mt-1 focus:border-emerald-500 outline-none" /></div>
                <div><label className="text-xs font-medium text-zinc-300">Dry Target (g)</label><input type="number" placeholder="0.0" value={newPlantDry} onChange={e => setNewPlantDry(e.target.value ? Number(e.target.value) : '')} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white mt-1 focus:border-emerald-500 outline-none" /></div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800"><button onClick={() => { setShowPlantModal(false); setEditingPlant(null); }} className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white">Cancel</button><button onClick={editingPlant ? handleUpdatePlant : handleAddPlant} className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white">{editingPlant ? "Update Plant" : "Save Plant"}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
