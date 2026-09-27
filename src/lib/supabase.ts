import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const FALLBACK_URL = "https://kvnzhuwmgadqicixbzvb.supabase.co";
const FALLBACK_KEY = "sb_publishable_h5gDNPl6krj8av3fJnVMbw_QiHf1P01";

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (_client) return _client;
  const env = (import.meta as any).env ?? {};
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL || FALLBACK_URL;
  const key = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || FALLBACK_KEY;
  _client = createClient(url, key);
  return _client;
}
