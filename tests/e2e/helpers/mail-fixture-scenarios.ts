import {
  createBlindIndex,
  encryptMailValue,
} from "../../../lib/mail/mail-security";
import { insertMailFixtureRecords } from "./mail-fixture-records";
import {
  MAILBOX_ID,
  SALESMAN_ID,
  CONTENT_KEY,
  HASH_SECRET,
} from "./mail-fixture-identity";
import { randomUUID } from "node:crypto";
import { getMailAdmin } from "./mail-fixture-admin";

/** 同时间且超过两页的可见会话用于检验 ID 排序、完整总数和页间勾选清理。 */
export async function seedNumberedMailThreads(
  count = 45,
  intakeStatus: "active" | "quarantined" = "active",
) {
  const client = getMailAdmin();
  const now = new Date().toISOString();
  const rows = Array.from({ length: count }, (_, index) => ({
    id: randomUUID(),
    mailbox_id: MAILBOX_ID,
    provider_thread_id: `numbered-page-${randomUUID()}`,
    subject_enc: encryptMailValue(`Paging inquiry ${index}`, CONTENT_KEY),
    customer_email_enc: encryptMailValue("paging@example.com", CONTENT_KEY),
    customer_email_hash: createBlindIndex("paging@example.com", HASH_SECRET),
    assigned_user_id: SALESMAN_ID,
    state: "waiting_pt5",
    ref_code: `PAGING-${index}`,
    routing_source: "manual",
    last_message_at: now,
    last_inbound_at: now,
    intake_status: intakeStatus,
    quarantine_reason: intakeStatus === "quarantined" ? "本地分页测试" : null,
    quarantined_at: intakeStatus === "quarantined" ? now : null,
  }));
  await insertMailFixtureRecords(client, "mail_threads", rows);
  return rows.map((row) => row.id);
}

/** 历史清理用例只建立入站会话；没有任何 SENT 收件人凭证，因此应被识别为陌生会话。 */
export async function seedUnknownMailThread(input: {
  threadId: string;
  messageId: string;
  providerThreadId: string;
  blockDeletion?: boolean;
}) {
  const client = getMailAdmin();
  const now = new Date().toISOString();
  await insertMailFixtureRecords(
    client,
    "mail_threads",
    {
      id: input.threadId,
      mailbox_id: MAILBOX_ID,
      provider_thread_id: input.providerThreadId,
      subject_enc: encryptMailValue("Unknown historical message", CONTENT_KEY),
      customer_email_enc: encryptMailValue(
        "unknown-history@example.com",
        CONTENT_KEY,
      ),
      customer_email_hash: createBlindIndex(
        "unknown-history@example.com",
        HASH_SECRET,
      ),
      assigned_user_id: null,
      state: "waiting_pt5",
      ref_code: `PT5-2026-GENERAL-${input.threadId.slice(0, 8).toUpperCase()}`,
      routing_source: "unassigned",
      last_message_at: now,
      last_inbound_at: now,
    },
    "id",
  );

  await insertMailFixtureRecords(
    client,
    "mail_messages",
    {
      id: input.messageId,
      mailbox_id: MAILBOX_ID,
      thread_id: input.threadId,
      provider_message_id: `${input.providerThreadId}-message`,
      direction: "inbound",
      from_enc: encryptMailValue(
        "Unknown <unknown-history@example.com>",
        CONTENT_KEY,
      ),
      to_enc: encryptMailValue(
        JSON.stringify(["chinapt5@gmail.com"]),
        CONTENT_KEY,
      ),
      cc_enc: encryptMailValue("[]", CONTENT_KEY),
      bcc_enc: encryptMailValue("[]", CONTENT_KEY),
      subject_enc: encryptMailValue("Unknown historical message", CONTENT_KEY),
      text_body_enc: encryptMailValue(
        "This content must be deleted locally.",
        CONTENT_KEY,
      ),
      html_body_enc: encryptMailValue(
        "<p>This content must be deleted locally.</p>",
        CONTENT_KEY,
      ),
      raw_headers_enc: encryptMailValue("{}", CONTENT_KEY),
      occurred_at: now,
    },
    "id",
  );

  if (input.blockDeletion) {
    await insertMailFixtureRecords(
      client,
      "mail_outbound_jobs",
      {
        mailbox_id: MAILBOX_ID,
        actor_user_id: SALESMAN_ID,
        thread_id: input.threadId,
        idempotency_key: `block-${input.threadId}`,
        payload_enc: encryptMailValue("{}", CONTENT_KEY),
        status: "failed",
        last_error: "本地测试阻止删除",
      },
      "idempotency_key",
    );
  }
}
