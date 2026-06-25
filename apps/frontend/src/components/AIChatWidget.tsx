"use client";

import { X } from "lucide-react";
import { AnyActionArg, useMemo, useState } from "react";
import {
  type EnvironmentReading,
  type FeedSchedule,
  type ReservoirDelta
} from "@/lib/cultivation";

interface AIChatWidgetProps {
  activeDryBack: {
    dryBackPercent: number;
    estimatedHoursUntilWater: number;
    poundsUntilIrrigation: number;
  };
  reservoirDelta: ReservoirDelta;
  latestEnvironment?: EnvironmentReading;
  latestRunoffEc?: number;
  activeSchedule: FeedSchedule;
  leftoverGallons: number;
}

type BuddyMessage = {
  role: "grower" | "buddy";
  content: string;
  image?: string;
};

/**
 * BRAND ASSET: Custom Premium Canopy Leaf Icon SVG Component
 */
function CanopyLogoIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2.2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      {/* Precision targeting crosshair outer brackets */}
      <path d="M5 3H3v2M19 3h2v2M5 21H3v-2M19 21h2v-2" strokeOpacity="0.4" />
      {/* Sleek agricultural organic central leaf centerline and canopy curve */}
      <path d="M12 22V2c0 0-8 4.5-8 10s4 8 8 10z" fill="currentColor" fillOpacity="0.15" />
      <path d="M12 2c0 0 8 4.5 8 10s-4 8-8 10" />
      <path d="M12 8c2.5 1 4.5 3 5 5" />
      <path d="M12 13c-2 0-3.5-1.5-4-3" />
    </svg>
  );
}

export default function AIChatWidget({
  activeDryBack,
  reservoirDelta,
  latestEnvironment,
  latestRunoffEc,
  activeSchedule,
  leftoverGallons
}: AIChatWidgetProps) {
  const [buddyMessages, setBuddyMessages] = useState<BuddyMessage[]>([
    {
      role: "buddy",
      content:
        "I can see the current dry-back trend, reservoir delta, and synced environment. Ask me to sanity-check the next irrigation or mix."
    }
  ]);
  const [buddyDraft, setBuddyDraft] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const contextSummary = useMemo(() => {
    const climate = latestEnvironment
      ? `${latestEnvironment.temperatureF.toFixed(1)} F, ${latestEnvironment.humidity}% RH, ${latestEnvironment.vpd.toFixed(2)} VPD${
          latestEnvironment.lightPpfd ? `, ${latestEnvironment.lightPpfd} PPFD` : ""
        }`
      : "No recent environment reading is synced";

    const runoff = latestRunoffEc !== undefined ? `${latestRunoffEc.toFixed(2)} EC` : "No runoff EC logged";
    const doseList = reservoirDelta.nutrientsToAdd
      .map((dose) => `${dose.product}: ${dose.totalMl} ml`)
      .join(", ");

    return {
      climate,
      runoff,
      doseList: doseList || "No nutrients currently listed",
      dryBack: `${activeDryBack.dryBackPercent.toFixed(1)}% dry-back, ${activeDryBack.poundsUntilIrrigation.toFixed(
        1
      )} lb until irrigation target, about ${activeDryBack.estimatedHoursUntilWater} hr remaining`,
      reservoir: `${reservoirDelta.topOffGallons} gal top-off, ${reservoirDelta.waterPercentToAdd}% of the tank, ${leftoverGallons} gal leftover`
    };
  }, [activeDryBack, activeSchedule, latestEnvironment, latestRunoffEc, leftoverGallons, reservoirDelta]);

  /**
   * FORM SUBMISSION HANDLER
   */
  async function handleFormSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = buddyDraft.trim();
    
    // Permit empty strings if an image payload is primed and waiting
    if (!trimmed && !selectedImage) return;
    if (isPending) return;

    const imageToSubmit = selectedImage;
    const growerMessage: BuddyMessage = {
      role: "grower",
      content: trimmed || "", 
      image: imageToSubmit || undefined,
    };

    setBuddyMessages((prev) => [...prev, growerMessage] as BuddyMessage[]);
    
    setBuddyDraft("");
    setSelectedImage(null);
    setIsPending(true);

    try {
      const finalParts: any[] = [];
      
      if (trimmed) {
        finalParts.push({ text: trimmed });
      }

      if (imageToSubmit) {
        finalParts.push({
          inlineData: {
            data: imageToSubmit.split(",")[1],
            mimeType: imageToSubmit.split(";")[0].split(":")[1]
          }
        });
      }

      const history = [
        ...buddyMessages.map((m) => ({
          role: m.role === "grower" ? ("user" as const) : ("model" as const),
          parts: [{ text: m.content || "" }],
        })),
        { role: "user" as const, parts: finalParts },
      ];

      const context = {
        activeDryBack,
        reservoirDelta,
        latestEnvironment: latestEnvironment
          ? {
              temperatureF: latestEnvironment.temperatureF,
              humidity: latestEnvironment.humidity,
              vpd: latestEnvironment.vpd,
            }
          : undefined,
        latestRunoffEc,
      };

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history, context }),
      });

      if (!response.ok) throw new Error("Cultivation node offline");

      const data = await response.json();

      setBuddyMessages((prev) => [
        ...prev,
        { role: "buddy", content: data.text },
      ] as BuddyMessage[]);
    } catch (error) {
      setBuddyMessages((prev) => [
        ...prev,
        {
          role: "buddy",
          content: "Sorry, I lost connection to the facility telemetry. Please check your network and try again.",
        },
      ] as BuddyMessage[]); 
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      {/* 1. Floating Action Button (FAB) */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 flex size-14 items-center justify-center rounded-full bg-canopy text-white shadow-2xl transition-all hover:scale-110 active:scale-95"
        aria-label={isOpen ? "Close assistant" : "Open assistant"}
      >
        {isOpen ? <X className="size-6" /> : <CanopyLogoIcon className="size-6" />}
      </button>

      {/* 2. Floating Chat Window Layer */}
      {isOpen && (
        <section className="fixed bottom-24 right-6 z-50 flex h-[520px] w-[380px] max-w-[calc(100vw-48px)] flex-col overflow-hidden rounded-2xl border border-[#cad6cf] dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl transition-all duration-200">
          
          {/* Header Bar */}
          <div className="flex items-center gap-2 bg-[#f4f1ea] dark:bg-zinc-800 px-4 py-3 border-b border-[#cad6cf] dark:border-zinc-800">
            <CanopyLogoIcon className="size-5 text-canopy dark:text-emerald-400" />
            <div>
              <h3 className="text-sm font-semibold text-graphite dark:text-zinc-100">Canopy Intelligence Core</h3>
              <p className="text-xs text-[#66736b] dark:text-zinc-400">Telemetry-locked crop-steering agent</p>
            </div>
          </div>

          {/* Context Snapshot Banner */}
          <div className="bg-mist dark:bg-zinc-950/40 p-3 border-b border-[#cad6cf] dark:border-zinc-800 text-[11px] leading-relaxed text-[#526059] dark:text-zinc-300 grid grid-cols-2 gap-1 font-medium">
            <div>🌿 Dry-Back: {activeDryBack.dryBackPercent.toFixed(0)}%</div>
            <div>🎛️ VPD: {latestEnvironment?.vpd.toFixed(2) ?? "N/A"} kPa</div>
            <div>🛢️ Top-Off: {reservoirDelta.topOffGallons} gal</div>
            <div>📉 Runoff: {latestRunoffEc ?? "N/A"} EC</div>
          </div>

          {/* Chat Messages Log */}
          <div className="flex-1 flex flex-col gap-3 overflow-y-auto bg-[#fbfcfa] dark:bg-zinc-950/20 p-4">
            {buddyMessages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed shadow-sm ${
                  message.role === "grower"
                    ? "ml-auto bg-canopy text-white rounded-br-none"
                    : "bg-mist dark:bg-zinc-800 text-[#34423a] dark:text-zinc-200 rounded-bl-none border border-[#e3ebe7] dark:border-zinc-700/60"
                }`}
              >
                {message.image && (
                  <img 
                    src={message.image} 
                    alt="Uploaded growth data" 
                    className="mb-1.5 max-h-40 w-full rounded-lg object-cover border border-white/20"
                  />
                )}
                {message.content && <div>{message.content}</div>}
              </div>
            ))}

            {/* Live Thinking Skeleton Indicator */}
            {isPending && (
              <div className="max-w-[85%] rounded-xl rounded-bl-none border border-[#e3ebe7] dark:border-zinc-800 bg-mist dark:bg-zinc-800 px-3 py-2 text-sm text-[#34423a] dark:text-zinc-200 shadow-sm mr-auto animate-pulse flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="size-1.5 bg-canopy rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="size-1.5 bg-canopy rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="size-1.5 bg-canopy rounded-full animate-bounce"></span>
                </div>
                <span className="text-xs text-[#66736b] dark:text-zinc-400 font-medium">Analyzing room context...</span>
              </div>
            )}
          </div>

          {/* Input & Image Upload Form Wrapper */}
          <form 
            onSubmit={handleFormSubmit}
            className="p-3 bg-white dark:bg-zinc-900 border-t border-[#cad6cf] dark:border-zinc-800"
          >
            {/* Image Preview Thumbnail */}
            {selectedImage && (
              <div className="mb-2 flex items-center gap-2 rounded-md bg-mist dark:bg-zinc-950 p-1.5 border border-[#cad6cf] dark:border-zinc-800 max-w-max">
                <img 
                  src={selectedImage} 
                  alt="Upload preview" 
                  className="size-8 rounded object-cover" 
                />
                <button
                  type="button"
                  onClick={() => setSelectedImage(null)}
                  className="text-xs font-semibold text-clay dark:text-orange-400 hover:underline px-1"
                >
                  Remove
                </button>
              </div>
            )}

            <div className="flex gap-2">
              {/* File Input Wrapper */}
              <label className="grid size-10 place-items-center rounded-md border border-[#cad6cf] dark:border-zinc-800 bg-[#f4f1ea] dark:bg-zinc-800 text-[#526059] dark:text-zinc-300 cursor-pointer hover:bg-[#e8e4da] dark:hover:bg-zinc-700 transition-all shrink-0">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="size-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z"
                  />
                </svg>
                <input
                  id="buddy-image-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setSelectedImage(reader.result as string);
                        document.getElementById("buddy-text-input")?.focus();
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </label>

              <input
                id="buddy-text-input"
                disabled={isPending}
                className={`min-w-0 flex-1 rounded-md border border-[#cad6cf] dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-slate-900 dark:text-zinc-100 outline-none focus:border-canopy ${
                  isPending ? "opacity-50 cursor-not-allowed" : ""
                }`}
                value={buddyDraft}
                onChange={(event) => setBuddyDraft(event.target.value)}
                placeholder={isPending ? "Analyzing metrics..." : "Ask about metrics..."}
              />

              <button
                type="submit"
                disabled={isPending}
                className={`grid size-10 place-items-center rounded-md bg-clay text-white hover:opacity-90 transition-all ${
                  isPending ? "opacity-50" : ""
                }`}
              >
                <CanopyLogoIcon className={`size-5 ${isPending ? "animate-pulse" : ''}`} />
              </button>
            </div>
          </form>
        </section>
      )}
    </>
  );
}