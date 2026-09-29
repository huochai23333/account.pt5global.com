import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { getSupabaseServiceRoleClient } from "@/lib/supabase-admin-server";
import { getMailEnv } from "./mail-env";
import { sha256 } from "./mail-security";
import type { MailIdentity } from "./mail-types";

type Receipt = { userId: string; stateHash: string; mailboxId: string; refreshHash: string; expiresAt: number };

function signature(value: string) {
  return createHmac("sha256", getMailEnv().emailHashSecret).update(`mail-connection:${value}`).digest("base64url");
}

/** 成功凭证不包含令牌；签名把登录人、本次授权和已保存的邮箱绑定在一起。 */
export async function createConnectionReceipt(identity: MailIdentity, state: string, mailboxId: string) {
  const { data, error } = await getSupabaseServiceRoleClient().from("mail_shared_mailbox_credentials")
    .select("refresh_token_enc").eq("mailbox_id", mailboxId).single();
  if (error || !data?.refresh_token_enc) throw new Error("公司邮箱连接结果暂时无法确认。");
  const receipt: Receipt = { userId: identity.userId, stateHash: sha256(state), mailboxId,
    refreshHash: sha256(data.refresh_token_enc), expiresAt: Date.now() + 10 * 60_000 };
  const payload = Buffer.from(JSON.stringify(receipt)).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export async function verifyConnectionReceipt(identity: MailIdentity, value?: string, state?: string) {
  if (identity.role !== "administrator" || !value || value.length > 2000) return null;
  const [payload, signed, extra] = value.split(".");
  if (!payload || !signed || extra) return null;
  const expected = Buffer.from(signature(payload));
  const actual = Buffer.from(signed);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  let receipt: Receipt;
  try { receipt = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Receipt; } catch { return null; }
  if (receipt.userId !== identity.userId || !(receipt.expiresAt > Date.now()) ||
    (state !== undefined && receipt.stateHash !== sha256(state))) return null;
  const db = getSupabaseServiceRoleClient();
  const [mailbox, credentials, watch] = await Promise.all([
    db.from("mail_shared_mailboxes").select("status").eq("id", receipt.mailboxId).maybeSingle(),
    db.from("mail_shared_mailbox_credentials").select("refresh_token_enc,scopes").eq("mailbox_id", receipt.mailboxId).maybeSingle(),
    db.from("mail_shared_mailbox_watches").select("expiration").eq("mailbox_id", receipt.mailboxId).maybeSingle(),
  ]);
  // 查询失败、凭据换版或邮箱被停用时，旧的成功提示不能继续充当连接成功的证据。
  if (mailbox.error || credentials.error || watch.error || mailbox.data?.status !== "active" ||
    !credentials.data?.refresh_token_enc || sha256(credentials.data.refresh_token_enc) !== receipt.refreshHash ||
    !credentials.data.scopes?.includes("https://www.googleapis.com/auth/gmail.modify") ||
    !(Date.parse(watch.data?.expiration ?? "") > Date.now())) return null;
  return receipt;
}
