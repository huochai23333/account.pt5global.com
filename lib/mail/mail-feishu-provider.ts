import "server-only";

import { getSupabaseServiceRoleClient } from "@/lib/supabase-admin-server";
import { getMailEnv } from "./mail-env";
import { encryptMailValue } from "./mail-security";
import type { MailIdentity } from "./mail-types";

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} 尚未配置。`);
  return value;
}

/** 授权码仅在服务端换取人员身份；令牌和第三方异常不会进入返回网址或页面。 */
export async function getFeishuIdentity(code: string) {
  // 服务端换取令牌不能由浏览器拦截；仅本地复用外部边界地址，生产固定访问飞书官方接口。
  const apiBase = process.env.NODE_ENV !== "production" && process.env.MAIL_FEISHU_API_BASE_URL
    ? process.env.MAIL_FEISHU_API_BASE_URL.replace(/\/$/, "") : "https://open.feishu.cn";
  const redirectUri = `${getMailEnv().siteUrl}/api/mail/oauth/feishu/callback`;
  const tokenResponse = await fetch(`${apiBase}/open-apis/authen/v2/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: requireEnv("FEISHU_APP_ID"),
      client_secret: requireEnv("FEISHU_APP_SECRET"),
      code,
      redirect_uri: redirectUri,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const token = (await tokenResponse.json()) as { access_token?: string; error_description?: string };
  if (!tokenResponse.ok || !token.access_token) throw new Error(token.error_description ?? "飞书授权交换失败。");
  const profileResponse = await fetch(`${apiBase}/open-apis/authen/v1/user_info`, {
    headers: { authorization: `Bearer ${token.access_token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const profile = (await profileResponse.json()) as {
    code?: number;
    msg?: string;
    data?: { open_id?: string; name?: string; en_name?: string };
  };
  if (!profileResponse.ok || profile.code !== 0 || !profile.data?.open_id) throw new Error(profile.msg ?? "无法读取飞书人员身份。");
  return { openId: profile.data.open_id, displayName: profile.data.name ?? profile.data.en_name ?? "飞书用户" };
}

/** 保存必须返回对应账号与飞书人员编号；函数返回正常或影响零行都不能独自证明成功。 */
export async function bindFeishuIdentity(identity: MailIdentity, openId: string, displayName: string) {
  const { data, error } = await getSupabaseServiceRoleClient().from("mail_feishu_bindings").upsert({
    user_id: identity.userId,
    open_id: openId,
    display_name_enc: encryptMailValue(displayName, getMailEnv().contentKey),
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" }).select("user_id,open_id").single();
  if (error || data?.user_id !== identity.userId || data.open_id !== openId) {
    throw new Error("飞书身份没有确认绑定，可能已经属于其他账号。", { cause: error });
  }
}
