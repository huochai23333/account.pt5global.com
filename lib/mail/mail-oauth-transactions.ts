import "server-only";

import { createHash } from "node:crypto";

import { getSupabaseServiceRoleClient } from "@/lib/supabase-admin-server";

import { getMailEnv } from "./mail-env";
import { getSafeMailReturnUrl } from "./mail-return-url";
import { MailConnectionError } from "./mail-connection-feedback";
import { decryptMailValue, encryptMailValue, randomToken, sha256 } from "./mail-security";
import type { MailIdentity } from "./mail-types";

export function createPkcePair() {
  const verifier = randomToken(48);
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

/** 浏览器拿到随机 state，数据库只保存摘要，并绑定发起人、供应商和有效期。 */
export async function createOAuthTransaction(input: {
  identity: MailIdentity;
  provider: "google" | "feishu";
  purpose: "shared_mailbox" | "member_feishu";
  returnUrl: string | null;
  pkceVerifier?: string;
}) {
  const state = randomToken();
  const env = getMailEnv();
  const { data, error } = await getSupabaseServiceRoleClient().from("mail_oauth_transactions").insert({
    state_hash: sha256(state),
    user_id: input.identity.userId,
    provider: input.provider,
    purpose: input.purpose,
    return_url: getSafeMailReturnUrl(input.returnUrl, env.siteUrl, input.provider, input.identity.role),
    pkce_verifier_enc: input.pkceVerifier ? encryptMailValue(input.pkceVerifier, env.credentialKey) : null,
    expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
  }).select("state_hash").single();
  if (error || data?.state_hash !== sha256(state)) throw new Error("授权状态没有确认创建。", { cause: error });
  return state;
}

export async function consumeOAuthTransaction(input: {
  state: string;
  provider: "google" | "feishu";
  identity: MailIdentity;
}) {
  const now = new Date().toISOString();
  const { data, error } = await getSupabaseServiceRoleClient().from("mail_oauth_transactions")
    .update({ consumed_at: now })
    .eq("state_hash", sha256(input.state))
    .eq("provider", input.provider)
    .eq("user_id", input.identity.userId)
    .is("consumed_at", null)
    .gt("expires_at", now)
    .select("purpose,return_url,pkce_verifier_enc")
    .maybeSingle();
  // 同一个授权链接只能领取一次；后续步骤失败也必须从页面重新发起，不能重放旧链接。
  if (error) throw new MailConnectionError("unavailable");
  if (!data) throw new MailConnectionError("state");
  return {
    purpose: data.purpose as "shared_mailbox" | "member_feishu",
    returnUrl: getSafeMailReturnUrl(data.return_url as string, getMailEnv().siteUrl, input.provider, input.identity.role),
    pkceVerifier: data.pkce_verifier_enc
      ? decryptMailValue(data.pkce_verifier_enc as string, getMailEnv().credentialKey)
      : null,
  };
}
