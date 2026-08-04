//apps/frontend/src/app/auth/reset-password/ResetPasswordContent.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isValidToken, setIsValidToken] = useState(true);

  useEffect(() => {
    const accessToken = searchParams.get('access_token');
    if (!accessToken) {
      setIsValidToken(false);
      setMessage({ type: 'error', text: 'Invalid or missing reset token. Please request a new link.' });
      return;
    }
    supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: searchParams.get('refresh_token') || '',
    }).then(({ error }) => {
      if (error) {
        setIsValidToken(false);
        setMessage({ type: 'error', text: error.message });
      }
    });
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }
    if (password.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }
    setLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: 'Password updated successfully! Redirecting to login...' });
      setTimeout(() => {
        supabase.auth.signOut();
        router.push('/auth/login?message=Password reset successful. Please log in.');
      }, 2000);
    }
    setLoading(false);
  };

  if (!isValidToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-950 px-4">
        <div className="w-full max-w-md text-center">
          <h2 className="text-2xl font-bold text-red-500">Invalid Reset Link</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-zinc-400">
            This link may have expired or been used. Please request a new password reset.
          </p>
          <Link href="/auth/forgot-password" className="mt-4 inline-block text-emerald-600 dark:text-emerald-400 hover:underline">
            Request new link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-950 px-4">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white">Set New Password</h2>
          <p className="mt-2 text-sm text-center text-gray-600 dark:text-zinc-400">
            Enter your new password below.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {message && (
            <div className={`p-3 rounded-lg text-sm ${
              message.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400'
                : 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400'
            }`}>
              {message.text}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300">New Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2 text-gray-900 dark:text-white outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300">Confirm Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2 text-gray-900 dark:text-white outline-none focus:border-emerald-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-white font-bold hover:bg-emerald-500 transition-colors disabled:opacity-50"
          >
            {loading ? 'Updating...' : 'Update Password'}
          </button>

          <p className="text-sm text-center text-gray-600 dark:text-zinc-400">
            <Link href="/auth/login" className="text-emerald-600 dark:text-emerald-400 hover:underline">
              Back to login
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}