"use client";
import { useState, useEffect, Suspense } from "react";
import { getBatches, getBatchesForComparison } from "@/app/actions";
import { AppShell } from "@/components/layout/AppShell";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

export const dynamic = 'force-dynamic'; // Prevents static prerendering errors during build

export default function BatchComparePage() {
  const [batches, setBatches] = useState<any[]>([]);
  const [batchA, setBatchA] = useState<string>('');
  const [batchB, setBatchB] = useState<string>('');
  const [comparisonData, setComparisonData] = useState<any[]>([]);

  useEffect(() => {
    getBatches().then(setBatches);
  }, []);

  useEffect(() => {
    if (batchA && batchB) {
      getBatchesForComparison([batchA, batchB]).then((data) => {
        // Merge logs from both batches by date
        const logsA = data.find(b => b.id === batchA)?.dryBackLogs || [];
        const logsB = data.find(b => b.id === batchB)?.dryBackLogs || [];
        const combined = logsA.map((log, i) => ({
          date: new Date(log.timestamp).toLocaleDateString(),
          [batchA]: Number(log.dryBackPercent),
          [batchB]: logsB[i] ? Number(logsB[i].dryBackPercent) : null,
        }));
        setComparisonData(combined);
      });
    }
  }, [batchA, batchB]);

  return (
    <Suspense fallback={<div>Loading comparison...</div>}>
    <AppShell>
      <div className="max-w-4xl mx-auto p-4">
        <h1 className="text-2xl font-bold text-white mb-4">Batch Comparison</h1>
        <div className="flex gap-4 mb-6">
          <select
            value={batchA}
            onChange={(e) => setBatchA(e.target.value)}
            className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white"
          >
            <option value="">Select Batch A</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <select
            value={batchB}
            onChange={(e) => setBatchB(e.target.value)}
            className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white"
          >
            <option value="">Select Batch B</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        {comparisonData.length > 0 && (
          <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={comparisonData}>
                <XAxis dataKey="date" stroke="#4B5563" fontSize={12} />
                <YAxis stroke="#4B5563" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151' }} />
                <Legend />
                <Line type="monotone" dataKey={batchA} stroke="#10B981" strokeWidth={2} />
                <Line type="monotone" dataKey={batchB} stroke="#F97316" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </AppShell>
  </Suspense>
  );
}