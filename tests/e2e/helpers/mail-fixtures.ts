import { createBlindIndex, encryptMailValue } from "../../../lib/mail/mail-security";

import { getLocalSupabaseAdminClient } from "./local-supabase-admin";

export const MAILBOX_ID = "81000000-0000-4000-8000-000000000001";
export const THREAD_ID = "82000000-0000-4000-8000-000000000001";
export const MESSAGE_ID = "83000000-0000-4000-8000-000000000001";
export const SALESMAN_ID = "55555555-5555-4555-8555-555555555555";
export const PEER_SALESMAN_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const CONTENT_KEY = "97be123d5f21b84baed23125dcbf8f9541fe9424306f2ab57a4ce9d491454534";
const CREDENTIAL_KEY = "2a2e90de83c14a5bc9678b616e107c6b51d31fc568b5021d7d4cf564f09e655f";
const HASH_SECRET = "local-mail-hash-secret-for-pt5-regression-only";

/** 每个邮件用例都从相同权威记录开始，避免前一条用例的转交或删除污染下一条。 */
export async function resetIntegratedMailFixture() {
  const supabase = getLocalSupabaseAdminClient();
  if (!supabase) throw new Error("邮件回归只能连接本地 Supabase。");
  for (const table of [
    "mail_audit_events", "mail_oauth_transactions", "mail_inbound_events", "mail_notifications",
    "mail_outbound_jobs", "mail_thread_reads", "mail_attachments", "mail_uploads",
    "mail_messages", "mail_assignment_events", "mail_threads", "mail_feishu_bindings",
    "mail_agent_profiles", "mail_shared_mailbox_watches", "mail_shared_mailbox_credentials",
    "mail_shared_mailboxes",
  ]) {
    const key = ({
      mail_oauth_transactions: "state_hash",
      mail_thread_reads: "thread_id",
      mail_agent_profiles: "user_id",
      mail_feishu_bindings: "user_id",
      mail_shared_mailbox_watches: "mailbox_id",
      mail_shared_mailbox_credentials: "mailbox_id",
    } as Record<string, string>)[table] ?? "id";
    const { error } = await supabase.from(table).delete().not(key, "is", null);
    if (error) throw new Error(`无法清理 ${table}: ${error.message}`);
  }
  const now = new Date().toISOString();
  const mailbox = await supabase.from("mail_shared_mailboxes").insert({ id: MAILBOX_ID, provider_subject: "local-shared-mailbox", email_enc: encryptMailValue("chinapt5@gmail.com", CONTENT_KEY), email_hash: createBlindIndex("chinapt5@gmail.com", HASH_SECRET), email_masked: "ch*******@gmail.com", status: "active", cutover_started_at: now, last_healthy_at: now });
  if (mailbox.error) throw new Error(mailbox.error.message);
  const credentials = await supabase.from("mail_shared_mailbox_credentials").insert({ mailbox_id: MAILBOX_ID, access_token_enc: encryptMailValue("local-access-token", CREDENTIAL_KEY), refresh_token_enc: encryptMailValue("local-refresh-token", CREDENTIAL_KEY), access_token_expires_at: new Date(Date.now() + 3_600_000).toISOString(), scopes: ["https://www.googleapis.com/auth/gmail.modify"] });
  if (credentials.error) throw new Error(credentials.error.message);
  const profiles = await supabase.from("mail_agent_profiles").insert([
    { user_id: SALESMAN_ID, alias_local_part: "local-sales", ref_prefix: "LOCAL", sender_display_name_enc: encryptMailValue("PT5 Sales", CONTENT_KEY), signature_html_enc: encryptMailValue("<p>PT5 Team</p>", CONTENT_KEY), enabled: true },
    { user_id: PEER_SALESMAN_ID, alias_local_part: "peer-sales", ref_prefix: "PEER", sender_display_name_enc: encryptMailValue("PT5 Peer", CONTENT_KEY), signature_html_enc: encryptMailValue("<p>PT5 Team</p>", CONTENT_KEY), enabled: true },
  ]);
  if (profiles.error) throw new Error(profiles.error.message);
  const bindings = await supabase.from("mail_feishu_bindings").insert([
    { user_id: SALESMAN_ID, open_id: "local-sales-open-id", display_name_enc: encryptMailValue("PT5 Sales", CONTENT_KEY) },
    { user_id: PEER_SALESMAN_ID, open_id: "peer-sales-open-id", display_name_enc: encryptMailValue("PT5 Peer", CONTENT_KEY) },
  ]);
  if (bindings.error) throw new Error(bindings.error.message);
  const thread = await supabase.from("mail_threads").insert({ id: THREAD_ID, mailbox_id: MAILBOX_ID, provider_thread_id: "gmail-thread-seeded", subject_enc: encryptMailValue("New wholesale inquiry", CONTENT_KEY), customer_email_enc: encryptMailValue("buyer@example.com", CONTENT_KEY), customer_email_hash: createBlindIndex("buyer@example.com", HASH_SECRET), assigned_user_id: SALESMAN_ID, state: "waiting_pt5", ref_code: "PT5-2026-LOCAL-ABC12345", routing_source: "alias", last_message_at: now, last_inbound_at: now });
  if (thread.error) throw new Error(thread.error.message);
  const message = await supabase.from("mail_messages").insert({ id: MESSAGE_ID, mailbox_id: MAILBOX_ID, thread_id: THREAD_ID, provider_message_id: "gmail-inbound-seeded", direction: "inbound", from_enc: encryptMailValue("Buyer <buyer@example.com>", CONTENT_KEY), to_enc: encryptMailValue(JSON.stringify(["chinapt5+local-sales@gmail.com"]), CONTENT_KEY), cc_enc: encryptMailValue("[]", CONTENT_KEY), bcc_enc: encryptMailValue("[]", CONTENT_KEY), subject_enc: encryptMailValue("New wholesale inquiry", CONTENT_KEY), text_body_enc: encryptMailValue("Hello, we need a quote for 500 units.", CONTENT_KEY), html_body_enc: encryptMailValue("<p>Hello, we need a quote for 500 units.</p>", CONTENT_KEY), raw_headers_enc: encryptMailValue(JSON.stringify({ "message-id": "<seeded@example.com>" }), CONTENT_KEY), occurred_at: now });
  if (message.error) throw new Error(message.error.message);
}

export function getMailAdmin() {
  const supabase = getLocalSupabaseAdminClient();
  if (!supabase) throw new Error("邮件回归只能连接本地 Supabase。");
  return supabase;
}
