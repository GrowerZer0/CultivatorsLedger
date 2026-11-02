import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Cultivator's Ledger",
};

export default function PrivacyPage() {
  return (
    <article className="prose prose-zinc dark:prose-invert max-w-none">
      <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">Privacy Policy</h1>
      <p className="text-sm text-zinc-500 mb-8">Last updated: November 2, 2026</p>

      <section className="space-y-4 text-zinc-700 dark:text-zinc-300">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white mt-6">1. Information We Collect</h2>
        <p>
          We collect information you provide directly to us, such as your email address, name, and any data you input regarding your plants, rooms, batches, and grow logs. If you subscribe, we also collect billing information (processed securely via Stripe).
        </p>

        <h2 className="text-xl font-bold text-zinc-900 dark:text-white mt-6">2. How We Use Your Information</h2>
        <p>
          We use the information we collect to provide, maintain, and improve the Service, process transactions, send technical notices and support messages, and respond to your comments and questions.
        </p>

        <h2 className="text-xl font-bold text-zinc-900 dark:text-white mt-6">3. Sharing of Information</h2>
        <p>
          We do not sell your personal information. We may share information with third-party vendors (like Stripe for payments or Supabase for database hosting) who need access to such information to carry out work on our behalf.
        </p>

        <h2 className="text-xl font-bold text-zinc-900 dark:text-white mt-6">4. Data Retention</h2>
        <p>
          We retain your personal data for as long as your account is active or as needed to provide you services. You can request deletion of your account and associated data at any time by contacting support.
        </p>

        <h2 className="text-xl font-bold text-zinc-900 dark:text-white mt-6">5. Security</h2>
        <p>
          We take reasonable measures to help protect information about you from loss, theft, misuse and unauthorized access, disclosure, alteration and destruction. However, no internet or email transmission is ever fully secure or error free.
        </p>

        <h2 className="text-xl font-bold text-zinc-900 dark:text-white mt-6">6. Contact Us</h2>
        <p>
          If you have any questions about this Privacy Policy, please contact us at privacy@cultivatorsledger.com.
        </p>
      </section>
    </article>
  );
}