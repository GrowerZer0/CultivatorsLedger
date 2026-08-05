"use client";

import { useState, useEffect } from "react";
import { SectionPanel } from "@/components/layout/SectionPanel";
import { getTierInfo, getTierPlantLimit, tierHasFeature } from "@/lib/features-client";
import { createPortalSession, createCheckoutSession } from "@/server/actions/stripe";
import { Check, Loader2, Zap } from "lucide-react";

export default function BillingSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<"FREE" | "GROWER">("FREE");
  const [plantCount, setPlantCount] = useState(0);
  const [plantLimit, setPlantLimit] = useState(0);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useEffect(() => {
    async function loadBilling() {
      try {
        // Fetch billing data from API
        const response = await fetch("/api/user/billing");
        const data = await response.json();

        setTier(data.tier || "FREE");
        setPlantCount(data.plantCount || 0);
        setPlantLimit(data.plantLimit || 3);
        setSubscriptionStatus(data.subscriptionStatus);
        setTrialEndsAt(data.trialEndsAt);
      } catch (err) {
        console.error("Failed to load billing:", err);
      } finally {
        setLoading(false);
      }
    }
    loadBilling();
  }, []);

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    const result = await createPortalSession();
    if (result.success && result.url) {
      window.location.href = result.url;
    } else {
      alert(result.error || "Failed to open billing portal");
    }
    setPortalLoading(false);
  };

  const handleUpgrade = async () => {
    setCheckoutLoading(true);
    const result = await createCheckoutSession();
    if (result.success && result.url) {
      window.location.href = result.url;
    } else {
      alert(result.error || "Failed to start checkout");
    }
    setCheckoutLoading(false);
  };

  if (loading) {
    return <div className="text-xs text-zinc-500 py-8 text-center animate-pulse">Loading billing...</div>;
  }

  return (
    <SectionPanel title="Billing & Subscription">
      <div className="space-y-6 max-w-2xl">
        {/* Current Tier */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-semibold text-white">Current Tier</h4>
              <p className="text-2xl font-bold text-emerald-400 mt-1">
                {tier === "GROWER" ? "🌱 Grower" : "🌿 Free"}
              </p>
              {tier === "GROWER" && subscriptionStatus === "trialing" && trialEndsAt && (
                <p className="text-xs text-zinc-400 mt-1">
                  Trial ends {new Date(trialEndsAt).toLocaleDateString()}
                </p>
              )}
              {tier === "GROWER" && subscriptionStatus === "active" && (
                <p className="text-xs text-emerald-400 mt-1">✓ Active subscription</p>
              )}
              {tier === "FREE" && (
                <p className="text-xs text-zinc-400 mt-1">
                  {plantCount}/{plantLimit} plants used
                </p>
              )}
            </div>
            {tier === "FREE" ? (
              <button
                onClick={handleUpgrade}
                disabled={checkoutLoading}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {checkoutLoading ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
                Upgrade to Grower
              </button>
            ) : (
              <button
                onClick={handleManageSubscription}
                disabled={portalLoading}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {portalLoading ? <Loader2 className="size-4 animate-spin" /> : null}
                Manage Subscription
              </button>
            )}
          </div>
        </div>

        {/* Feature Comparison */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h4 className="text-sm font-semibold text-white mb-4">What You Get</h4>
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-sm">
              <Check className="size-4 text-emerald-500" />
              <span className="text-zinc-300">Track up to {tier === "GROWER" ? "∞" : "3"} plants</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Check className={`size-4 ${tier === "GROWER" ? "text-emerald-500" : "text-zinc-600"}`} />
              <span className={tier === "GROWER" ? "text-zinc-300" : "text-zinc-500"}>
                {tier === "GROWER" ? "Unlimited" : "5"} AI insights per month
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Check className={`size-4 ${tier === "GROWER" ? "text-emerald-500" : "text-zinc-600"}`} />
              <span className={tier === "GROWER" ? "text-zinc-300" : "text-zinc-500"}>
                {tier === "GROWER" ? "✓" : "✗"} Photo uploads
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Check className={`size-4 ${tier === "GROWER" ? "text-emerald-500" : "text-zinc-600"}`} />
              <span className={tier === "GROWER" ? "text-zinc-300" : "text-zinc-500"}>
                {tier === "GROWER" ? "✓" : "✗"} Dry-back charts per room
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Check className={`size-4 ${tier === "GROWER" ? "text-emerald-500" : "text-zinc-600"}`} />
              <span className={tier === "GROWER" ? "text-zinc-300" : "text-zinc-500"}>
                {tier === "GROWER" ? "✓" : "✗"} CSV export
              </span>
            </div>
          </div>
        </div>

        {/* Upgrade Benefits (if free) */}
        {tier === "FREE" && (
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
            <p className="text-sm text-zinc-300">
              🚀 Upgrade to Grower for unlimited plants, AI insights, and premium features.
              Plus, get a <span className="font-bold text-emerald-400">14-day free trial</span>!
            </p>
          </div>
        )}
      </div>
    </SectionPanel>
  );
}