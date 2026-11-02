import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — Cultivator's Ledger",
};

export default function TermsPage() {
  return (
    <article className="prose prose-zinc dark:prose-invert max-w-none">
      <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">Terms of Service</h1>
      <p className="text-sm text-zinc-500 mb-8">Last updated: November 2, 2026</p>

      <section className="space-y-4 text-zinc-700 dark:text-zinc-300">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white mt-6">1. Agreement to Terms</h2>
        <p>
          By accessing or using Cultivator's Ledger ("the Service"), you agree to be bound by these Terms of Service. If you disagree with any part of the terms, you may not access the Service.
        </p>

        <h2 className="text-xl font-bold text-zinc-900 dark:text-white mt-6">2. Description of Service</h2>
        <p>
          Cultivator's Ledger provides software for tracking plant growth, weight, environmental metrics, and cultivation analytics. The Service is provided "as is" and is intended for informational and record-keeping purposes only.
        </p>
        <p>
          <strong>No Guarantee of Results:</strong> We do not guarantee any specific agricultural, horticultural, or financial results. Plant growth and yields depend on numerous factors outside our control.
        </p>

        <h2 className="text-xl font-bold text-zinc-900 dark:text-white mt-6">3. User Accounts and Subscriptions</h2>
        <p>
          You must provide accurate information when creating an account. Subscriptions to the Grower tier are billed on a recurring basis via our payment processor, Stripe. You may cancel your subscription at any time via the Billing settings, but refunds are not provided for partial billing periods.
        </p>

        <h2 className="text-xl font-bold text-zinc-900 dark:text-white mt-6">4. Acceptable Use</h2>
        <p>
          You agree not to use the Service for any unlawful purpose or in violation of any local, state, national, or international law, including laws regarding the cultivation of controlled substances.
        </p>

        <h2 className="text-xl font-bold text-zinc-900 dark:text-white mt-6">5. Limitation of Liability</h2>
        <p>
          In no event shall Cultivator's Ledger, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Service.
        </p>

        <h2 className="text-xl font-bold text-zinc-900 dark:text-white mt-6">6. Changes</h2>
        <p>
          We reserve the right, at our sole discretion, to modify or replace these Terms at any time. We will provide notice of any material changes.
        </p>
      </section>
    </article>
  );
}