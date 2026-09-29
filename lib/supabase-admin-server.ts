import { createClient } from "@supabase/supabase-js";

import { getSupabaseEnv } from "./supabase";
import { timedSupabaseFetch } from "./server-performance";

export function getSupabaseServiceRoleClient() {
  const { supabaseUrl } = getSupabaseEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    global: { fetch: timedSupabaseFetch },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
