import { getBatch } from "@/app/actions";
import { notFound } from "next/navigation";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { AppShell } from "@/components/layout/AppShell";

export default async function BatchPage({ params }: { params: { id: string } }) {
  const batch = await getBatch(params.id);
  if (!batch) notFound();

  const avgDryBack = batch.dryBackLogs.length > 0
    ? batch.dryBackLogs.reduce((acc, log) => acc + Number(log.dryBackPercent), 0) / batch.dryBackLogs.length
    : 0;

  const daysSinceStart = Math.floor((Date.now() - new Date(batch.startDate).getTime()) / (1000 * 60 * 60 * 24));

  const chartData = batch.dryBackLogs.map((log) => ({
    time: new Date(log.timestamp).toLocaleDateString(),
    dryBack: Number(log.dryBackPercent),
  }));

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto p-4">
        <h1 className="text-3xl font-bold text-white mb-2">{batch.name}</h1>
        <p className="text-zinc-400 mb-6">{batch.cultivar} • Room: {batch.roomId}</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
            <p className="text-sm text-zinc-500">Days Since Start</p>
            <p className="text-2xl font-bold text-white">{daysSinceStart}</p>
          </div>
          <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
            <p className="text-sm text-zinc-500">Average Dry-Back</p>
            <p className="text-2xl font-bold text-white">{avgDryBack.toFixed(1)}%</p>
          </div>
          <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
            <p className="text-sm text-zinc-500">Logs Recorded</p>
            <p className="text-2xl font-bold text-white">{batch.dryBackLogs.length}</p>
          </div>
        </div>

        <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
          <h2 className="text-sm font-bold text-zinc-400 mb-3">Dry-Back Trend</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <XAxis dataKey="time" stroke="#4B5563" fontSize={12} />
              <YAxis stroke="#4B5563" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151' }} />
              <Line type="monotone" dataKey="dryBack" stroke="#10B981" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </AppShell>
  );
}