// components/HardwareLoginForm.tsx
'use client';

import { useState } from 'react';

export default function HardwareLoginForm({ profileId }: { profileId: string }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [brand, setBrand] = useState('Nanolux'); // Example controller integration option
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  const handleHardwareSync = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      const response = await fetch('/api/hardware/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, controllerBrand: brand, profileId }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to authenticate controller.');

      setStatus({ success: true, message: data.message });
    } catch (err: any) {
      setStatus({ success: false, message: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 mb-1">
        Link Climate Controller
      </h2>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
        Log in with your hardware provider account to seamlessly route environment tracking.
      </p>

      <form onSubmit={handleHardwareSync} className="space-y-4">
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-zinc-500 mb-1">Hardware Brand</label>
          <select 
            value={brand} 
            onChange={(e) => setBrand(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100"
          >
            <option value="Nanolux">Nanolux Cloud</option>
            <option value="TrolMaster">TrolMaster Hydro-X</option>
            <option value="Agrowtek">Agrowtek GrowControl</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-zinc-500 mb-1">Account Email / Username</label>
          <input 
            type="text" 
            required
            value={username} 
            onChange={(e) => setUsername(e.target.value)}
            placeholder="grower@facility.com"
            className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100"
          />
        </div>

        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-zinc-500 mb-1">Account Password</label>
          <input 
            type="password" 
            required
            value={password} 
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100"
          />
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium text-sm rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? 'Authenticating and Syncing...' : 'Securely Connect Account'}
        </button>
      </form>

      {status && (
        <div className={`mt-4 p-3 rounded-lg text-sm ${status.success ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {status.message}
        </div>
      )}
    </div>
  );
}