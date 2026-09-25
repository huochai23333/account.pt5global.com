import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";

import { getSupabaseEnv } from "./supabase";

// React 的 cache 仅在当前服务端渲染请求内复用客户端，避免布局与页面分别读取 Auth 和权限。
// 不能改成模块级单例，否则不同用户的 Cookie 与会话可能互相串用。
export const getServerSupabaseClient = cache(async () => {
  const cookieStore = await cookies();
  const { supabaseUrl, supabaseKey } = getSupabaseEnv();

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot always persist cookies directly.
          // The proxy refresh path handles those writes for navigation requests.
        }
      },
    },
  });
});
