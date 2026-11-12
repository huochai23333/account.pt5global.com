import type { SupabaseClient } from "@supabase/supabase-js";
import { clearMailFixtureTable } from "./mail-fixture-records";

// 先清子记录再清父记录；这里只重建专属实例的邮件数据，不处理 Auth 或其他业务表。
const tables = [
  "mail_inbound_ignore_receipts",
  "mail_outbound_recipients",
  "mail_audit_events",
  "mail_oauth_transactions",
  "mail_inbound_events",
  "mail_notifications",
  "mail_outbound_jobs",
  "mail_thread_reads",
  "mail_attachments",
  "mail_uploads",
  "mail_messages",
  "mail_assignment_events",
  "mail_threads",
  "mail_feishu_bindings",
  "mail_intake_rules",
  "mail_agent_profiles",
  "mail_shared_mailbox_watches",
  "mail_shared_mailbox_credentials",
  "mail_shared_mailboxes",
];
const keys: Record<string, string> = {
  mail_oauth_transactions: "state_hash",
  mail_thread_reads: "thread_id",
  mail_agent_profiles: "user_id",
  mail_feishu_bindings: "user_id",
  mail_shared_mailbox_watches: "mailbox_id",
  mail_shared_mailbox_credentials: "mailbox_id",
};

export async function clearIntegratedMailFixture(client: SupabaseClient) {
  for (const table of tables)
    await clearMailFixtureTable(client, table, keys[table] ?? "id");
}
