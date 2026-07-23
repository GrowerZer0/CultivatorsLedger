'use client';

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { getBatch } from "@/app/actions";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export const dynamic = 'force-dynamic';

export default function BatchPage() {
  const params = useParams<{ id: string }>();
  const [batch, setBatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params?.id) {
      getBatch(params.id)
        .then((data) => setBatch(data))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [params]);

  if (loading) {
    return (
      <AppShell>
        <div className="flex h-[75vh] items-center justify-center text-zinc-400">
          Loading batch...
        </div>
      </AppShell>
    );
  }

  if (!batch) {
    return (
      <AppShell>
        <div className="flex h-[75vh] items-center justify-center text-zinc-400">
          Batch not found.
        </div>
      </AppShell>
    );
  }

  const avgDryBack =
    batch.dryBackLogs?.length > 0
      ? batch.dryBackLogs.reduce((acc: number, log: any) => acc + Number(log.dryBackPercent), 0) /
        batch.dryBackLogs.length
      : 0;

  const daysSinceStart = Math.floor(
    (Date.now() - new Date(batch.startDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  const chartData = batch.dryBackLogs?.map((log: any) => ({
    time: new Date(log.timestamp).toLocaleDateString(),
    dryBack: Number(log.dryBackPercent),
  })) || [];

  const exportCSV = () => {
    if (!batch?.dryBackLogs?.length) return;
    const headers = ['Date', 'Dry-Back %'];
    const rows = batch.dryBackLogs.map((log: any) => [
      new Date(log.timestamp).toLocaleDateString(),
      Number(log.dryBackPercent).toFixed(1),
    ]);
    const csvContent = [headers.join(','), ...rows.map((r: string[]) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${batch.name}_dryback_logs.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto p-4">
        <h1 className="text-3xl font-bold text-white mb-2">{batch.name}</h1>
        <p className="text-zinc-400 mb-6">
        <button
          onClick={exportCSV}
          className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded-full transition-colors"
        >
          Export CSV
        </button>
          {batch.cultivar} • Room: {batch.roomId}
        </p>

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
            <p className="text-2xl font-bold text-white">{batch.dryBackLogs?.length || 0}</p>
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