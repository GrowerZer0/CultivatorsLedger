// src/lib/session.ts
import { supabase } from '@/lib/supabase';

export async function getUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
}