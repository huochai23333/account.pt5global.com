import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Request } from "@playwright/test";
import { runLocalSupabaseSql } from "./local-supabase";

/** 只复用本次页面已经发送的会话能力；不读取账号文件、服务密钥或持久化令牌。 */
export function createAttachmentCapability(actorId: string) {
  let authorization = "",
    apiKey = "";
  let verified: Promise<SupabaseClient> | undefined;
  function origin() {
    // SQL端口每次检查真实专属API/DB标签、端口映射、网络和off/0/0，不能靠字符串猜项目。
    runLocalSupabaseSql("select 1;");
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
    assert(
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
        !url.username &&
        !url.password,
      "attachment_capability_requires_local_origin",
    );
    return url.origin;
  }
  return {
    capture(request: Pick<Request, "url" | "headers">) {
      assert.equal(
        new URL(request.url()).origin,
        origin(),
        "attachment_capability_foreign_origin",
      );
      const headers = request.headers();
      assert(
        /^Bearer\s+\S+$/i.test(headers.authorization ?? "") && headers.apikey,
        "attachment_capability_headers_missing",
      );
      if (
        authorization !== headers.authorization ||
        apiKey !== headers.apikey
      ) {
        authorization = headers.authorization;
        apiKey = headers.apikey;
        verified = undefined;
      }
    },
    async client() {
      const apiOrigin = origin();
      assert(authorization && apiKey, "attachment_capability_not_captured");
      if (!verified) {
        verified = (async () => {
          const client = createClient(apiOrigin, apiKey, {
            auth: {
              autoRefreshToken: false,
              persistSession: false,
              detectSessionInUrl: false,
            },
            global: { headers: { Authorization: authorization } },
          });
          const { data, error } = await client.auth.getUser(
            authorization.replace(/^Bearer\s+/i, ""),
          );
          // 身份必须由同一项目的真实Auth确认，不能信任请求路径、显示名称或客户端元数据。
          if (error || data.user?.id !== actorId)
            throw new Error("attachment_capability_actor_unconfirmed");
          return client;
        })();
      }
      return verified;
    },
  };
}
