import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createBrowserSupabaseFetch } from "./supabase-http-transport";

let supabaseClient: SupabaseClient | undefined;

export function getSupabaseEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  }

  if (!supabaseKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return { supabaseUrl, supabaseKey };
}

export function getSupabaseClient() {
  if (!supabaseClient) {
    const { supabaseUrl, supabaseKey } = getSupabaseEnv();

    // 服务端直连项目，浏览器经由本站发送请求；会话与权限来源仍是同一个 Supabase 项目。
    supabaseClient = createBrowserClient(supabaseUrl, supabaseKey, {
      global: typeof window === "undefined" ? undefined : {
        fetch: createBrowserSupabaseFetch(supabaseUrl),
      },
    });
  }

  return supabaseClient;
}

export function getBrowserSupabaseClient() {
  if (typeof window === "undefined") {
    return null;
  }

  return getSupabaseClient();
}
