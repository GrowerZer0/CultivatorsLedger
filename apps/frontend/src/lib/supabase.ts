import { createClient } from '@supabase/supabase-js';

let supabaseClient: any = null;

export function getSupabaseClient() {
  if (!supabaseClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase environment variables are missing');
    }
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  }
  return supabaseClient;
}

// For backward compatibility, you can also export a default client
// that lazily initializes:
export const supabase = new Proxy({} as any, {
  get: (_, prop) => {
    const client = getSupabaseClient();
    return client[prop];
  },
});