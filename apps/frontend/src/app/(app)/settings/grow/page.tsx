"use client";

import { useState } from "react";
import { SectionPanel } from "@/components/layout/SectionPanel";
import { DrybackSettingsCard } from "@/components/settings/DrybackSettingsCard";
import { FeedLinesEditor } from "@/components/settings/FeedLinesEditor";

type Tab = "stages" | "feedlines";

export default function GrowSettingsPage() {
  const [tab, setTab] = useState<Tab>("stages");

  return (
    <SectionPanel title="Grow Settings">
      <div className="space-y-6">
        <div className="flex border-b border-zinc-800 pb-2 gap-4">
          <button
            onClick={() => setTab("stages")}
            className={`text-sm font-bold pb-2 border-b-2 transition-colors ${
              tab === "stages"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Stage Dryback
          </button>
          <button
            onClick={() => setTab("feedlines")}
            className={`text-sm font-bold pb-2 border-b-2 transition-colors ${
              tab === "feedlines"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Feed Lines
          </button>
        </div>

        {tab === "stages" && <DrybackSettingsCard />}
        {tab === "feedlines" && <FeedLinesEditor />}
      </div>
    </SectionPanel>
  );
}