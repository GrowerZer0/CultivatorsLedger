import { getSensorById, updateSensorAssignment } from "@/server/actions/sensorconfig";
import { db } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Cpu, Link as LinkIcon } from "lucide-react";

export default async function SensorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sensor = await getSensorById(id);
  if (!sensor) notFound();

  const userId = await getUserId();
  
  // Fetch lists for the dropdowns
  const [plants, rooms] = await Promise.all([
    db.plant.findMany({ where: { userId }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
db.room.findMany({ where: { userId, deletedAt: null }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);

  // Server Action to handle the form submission
  async function handleUpdate(formData: FormData) {
    "use server";
    const type = formData.get("type") as "plant" | "room";
    const targetId = formData.get("targetId") as string || null;
    await updateSensorAssignment(sensor!.id, type, targetId);
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/settings/hardware" className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800">
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Cpu className="size-6 text-emerald-500" />
            {sensor.name}
          </h1>
          <p className="text-sm text-zinc-500 capitalize">{sensor.type.replace("-", " ")}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-6">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <LinkIcon className="size-5 text-zinc-400" /> Assignment
        </h2>
        <p className="text-sm text-zinc-500">
          Link this sensor to a specific plant (for weight sensors) or a room (for climate sensors).
        </p>

        <form action={handleUpdate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Plant Dropdown */}
            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700">
              <label className="text-xs font-bold uppercase text-zinc-500 mb-2 block">Assign to Plant</label>
              <select 
                name="targetId" 
                defaultValue={sensor.plantId || ""}
                className="w-full p-2 bg-white dark:bg-zinc-900 border rounded-lg text-sm mb-2"
              >
                <option value="">No Plant</option>
                {plants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button 
                name="type" 
                value="plant" 
                type="submit"
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors"
              >
                Save Plant Assignment
              </button>
            </div>

            {/* Room Dropdown */}
            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700">
              <label className="text-xs font-bold uppercase text-zinc-500 mb-2 block">Assign to Room</label>
              <select 
                name="targetId" 
                defaultValue={sensor.roomId || ""}
                className="w-full p-2 bg-white dark:bg-zinc-900 border rounded-lg text-sm mb-2"
              >
                <option value="">No Room</option>
                {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <button 
                name="type" 
                value="room" 
                type="submit"
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-colors"
              >
                Save Room Assignment
              </button>
            </div>

          </div>
        </form>
        
        {/* Current Status Display */}
        <div className="p-4 border-t border-zinc-100 dark:border-zinc-800">
          <h3 className="text-sm font-bold mb-2">Current Status</h3>
          {sensor.plantId && <p className="text-sm text-emerald-600">Linked to Plant: {sensor.plant?.name}</p>}
          {sensor.roomId && <p className="text-sm text-blue-600">Linked to Room: {sensor.room?.name}</p>}
          {!sensor.plantId && !sensor.roomId && <p className="text-sm text-amber-600">Unassigned</p>}
        </div>
      </div>
    </div>
  );
}