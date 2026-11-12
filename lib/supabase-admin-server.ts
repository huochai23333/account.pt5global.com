import { createClient } from "@supabase/supabase-js";

import { getSupabaseEnv } from "./supabase";
import { timedSupabaseFetch } from "./server-performance";

// 仅供服务端已核验权限的调用链使用；服务密钥可绕过 RLS，不能进入 Client 或代替调用人的授权。
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
