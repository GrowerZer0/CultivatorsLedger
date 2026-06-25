'use client';

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceArea } from 'recharts';
import { THRESHOLDS_BY_STAGE, GrowStage } from '@/lib/telemetry-clients';

interface TelemetryPoint {
  id: string;
  loggedAt: Date; 
  runoff_ec: number;
  weight: number;
}

export default function RunoffAnalyticsChart({ 
  data, 
  stage 
}: { 
  data: TelemetryPoint[], 
  stage: GrowStage 
}) {
  const thresholds = THRESHOLDS_BY_STAGE[stage];
  
  const chartData = data.map(point => ({
    ...point,
    formattedTime: new Date(point.loggedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  })).reverse();

  return (
    <div className="w-full h-[400px] p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm">
      <div className="mb-4">
        <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">Runoff EC & Weights</h3>
        <p className="text-xs text-zinc-500">Target Range: {thresholds.ecMin} - {thresholds.ecMax} EC</p>
      </div>

      <ResponsiveContainer width="100%" height="80%">
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-100 dark:stroke-zinc-800" />
          <XAxis dataKey="formattedTime" className="text-xs" stroke="#71717a" />
          
          <YAxis yAxisId="left" orientation="left" stroke="#16a34a" domain={[0, 4]} />
          <YAxis yAxisId="right" orientation="right" stroke="#2563eb" />
          
          <Tooltip contentStyle={{ backgroundColor: '#18181b', borderRadius: '8px', border: 'none', color: '#fff' }} />
          <Legend />

          <ReferenceArea 
            yAxisId="left" 
            y1={thresholds.ecMin} 
            y2={thresholds.ecMax} 
            fill="#16a34a" 
            fillOpacity={0.1} 
          />

          <Line yAxisId="left" type="monotone" dataKey="runoff_ec" stroke="#16a34a" name="Runoff EC" strokeWidth={2} dot={{ r: 4 }} connectNulls={false} />
          <Line yAxisId="right" type="monotone" dataKey="weight" stroke="#2563eb" name="Weight (lbs)" strokeWidth={2} dot={{ r: 4 }} connectNulls={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}