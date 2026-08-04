//apps/frontend/src/app/%28app%29/settings/profile/page.tsx
"use client";
import { useState, useEffect } from "react";
import { SectionPanel } from "@/components/layout/SectionPanel";
import { getUserProfile, updateUserProfile } from "@/server/actions/profile";
import { supabase } from "@/lib/supabase";
export default function ProfileSettingsPage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [formData, setFormData] = useState({
    displayName: "",
    email: "",
    timezone: "UTC",
    language: "en",
  });

  // Change Password States
  const [changePassword, setChangePassword] = useState(false);
const [currentPassword, setCurrentPassword] = useState('');
const [newPassword, setNewPassword] = useState('');
const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Load user profile on component mount
  useEffect(() => {
    async function loadProfile() {
      try {
        const data = await getUserProfile();
        if (data) {
          setProfile(data);
          setFormData({
            displayName: data.displayName || "",
            email: data.email || "",
            timezone: data.timezone || "UTC",
            language: data.language || "en",
          });
        }
      } catch (err) {
        console.error("Failed to load profile:", err);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);
  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      await updateUserProfile(formData);
      setMessage({ type: "success", text: "Profile updated successfully." });
      // Refresh profile
      const data = await getUserProfile();
      if (data) setProfile(data);
    } catch (err) {
      console.error("Failed to save profile:", err);
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred.";
      setMessage({ type: "error", text: errorMessage });
    } finally {
      setSaving(false);
    }
  }
  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = "/auth/login";
  }
  if (loading) return <div className="text-xs text-zinc-500 py-8 text-center animate-pulse">Loading profile...</div>;
  return (
    <SectionPanel title="Profile & Account">
      <div className="space-y-6 max-w-xl">
        {message && (
          <div className={`p-3 rounded-lg text-xs ${message.type === "success" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
            {message.text}
          </div>
        )}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-white">Account Information</h4>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="text-xs font-medium text-zinc-300">Display Name</label>
              <input
                type="text"
                value={formData.displayName}
                onChange={e => setFormData({ ...formData, displayName: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white mt-1 focus:border-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-300">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white mt-1 focus:border-emerald-500 outline-none"
                disabled
              />
              <p className="text-[10px] text-zinc-500 mt-1">Email changes require re-authentication.</p>
            </div>
          </div>
        </div>
        <div className="border-t border-zinc-800 pt-4 space-y-4">
          <h4 className="text-sm font-semibold text-white">Preferences</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-zinc-300">Timezone</label>
              <select
                value={formData.timezone}
                onChange={e => setFormData({ ...formData, timezone: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white mt-1 focus:border-emerald-500 outline-none"
              >
                <option value="UTC">UTC</option>
                <option value="America/New_York">Eastern Time (US)</option>
                <option value="America/Chicago">Central Time (US)</option>
                <option value="America/Denver">Mountain Time (US)</option>
                <option value="America/Los_Angeles">Pacific Time (US)</option>
                <option value="Europe/London">London</option>
                <option value="Europe/Paris">Paris</option>
                <option value="Asia/Tokyo">Tokyo</option>
                <option value="Australia/Sydney">Sydney</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-300">Language</label>
              <select
                value={formData.language}
                onChange={e => setFormData({ ...formData, language: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white mt-1 focus:border-emerald-500 outline-none"
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="it">Italian</option>
                <option value="pt">Portuguese</option>
                <option value="ru">Russian</option>
                <option value="zh">Chinese</option>
                <option value="ja">Japanese</option>
              </select>
            </div>
          </div>
        </div>
        <div className="border-t border-zinc-800 pt-4 space-y-4">
          <h4 className="text-sm font-semibold text-white">Subscription</h4>
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-white">Grower Tier</p>
                <p className="text-xs text-zinc-400">$12.99/month • Active</p>
              </div>
              <span className="px-2 py-1 text-[10px] font-bold bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/20">Active</span>
            </div>
            <p className="text-xs text-zinc-500 mt-2">Manage your subscription in the billing portal.</p>
            <button className="mt-3 px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition">Manage Billing</button>
          </div>
        </div>
        // Add state
const [changePassword, setChangePassword] = useState(false);
const [currentPassword, setCurrentPassword] = useState('');
const [newPassword, setNewPassword] = useState('');
const [confirmNewPassword, setConfirmNewPassword] = useState('');

// In the JSX, add a new section below the subscription section:
<div className="border-t border-zinc-800 pt-4 space-y-4">
  <h4 className="text-sm font-semibold text-white">Change Password</h4>
  {!changePassword ? (
    <button
      onClick={() => setChangePassword(true)}
      className="px-4 py-2 text-sm font-semibold rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition"
    >
      Change Password
    </button>
  ) : (
    <div className="space-y-3">
      <input
        type="password"
        placeholder="Current password"
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white focus:border-emerald-500 outline-none"
      />
      <input
        type="password"
        placeholder="New password (min 6 chars)"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white focus:border-emerald-500 outline-none"
      />
      <input
        type="password"
        placeholder="Confirm new password"
        value={confirmNewPassword}
        onChange={(e) => setConfirmNewPassword(e.target.value)}
        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white focus:border-emerald-500 outline-none"
      />
      <div className="flex gap-2">
        <button
          onClick={async () => {
            if (newPassword !== confirmNewPassword) {
              alert('Passwords do not match');
              return;
            }
            if (newPassword.length < 6) {
              alert('Password must be at least 6 characters');
              return;
            }
            // Re-authenticate with current password first (optional but recommended)
            // For simplicity, we'll directly update. Supabase requires session.
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) {
              alert(error.message);
            } else {
              alert('Password updated successfully.');
              setChangePassword(false);
              setCurrentPassword('');
              setNewPassword('');
              setConfirmNewPassword('');
            }
          }}
          className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition"
        >
          Save Password
        </button>
        <button
          onClick={() => {
            setChangePassword(false);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmNewPassword('');
          }}
          className="px-4 py-2 text-sm font-semibold rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition"
        >
          Cancel
        </button>
      </div>
    </div>
  )}
</div>
        <div className="pt-4">
          <button onClick={handleSave} disabled={saving} className="w-full px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white transition">
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
        <div className="border-t border-zinc-800 pt-4">
          <button onClick={handleSignOut} className="w-full px-4 py-2 text-sm font-semibold rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition">Sign Out</button>
        </div>
      </div>
    </SectionPanel>
  );
}
