import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createBlindIndex,
  encryptMailValue,
} from "../../../lib/mail/mail-security";
import { insertMailFixtureRecords } from "./mail-fixture-records";
import {
  MAILBOX_ID,
  THREAD_ID,
  MESSAGE_ID,
  OUTBOUND_MESSAGE_ID,
  SALESMAN_ID,
  CONTENT_KEY,
  HASH_SECRET,
} from "./mail-fixture-identity";

/** 先建会话和历史出站凭证，再建来信；已联系记录是来信白名单的业务依据。 */
export async function seedMailFixtureConversation(
  client: SupabaseClient,
  now: string,
) {
  const outboundAt = new Date(Date.now() - 60_000).toISOString();
  await insertMailFixtureRecords(
    client,
    "mail_threads",
    {
      id: THREAD_ID,
      mailbox_id: MAILBOX_ID,
      provider_thread_id: "gmail-thread-seeded",
      subject_enc: encryptMailValue("New wholesale inquiry", CONTENT_KEY),
      customer_email_enc: encryptMailValue("buyer@example.com", CONTENT_KEY),
      customer_email_hash: createBlindIndex("buyer@example.com", HASH_SECRET),
      assigned_user_id: SALESMAN_ID,
      state: "waiting_pt5",
      ref_code: "PT5-2026-LOCAL-ABC12345",
      routing_source: "alias",
      last_message_at: now,
      last_inbound_at: now,
    },
    "id",
  );
  await insertMailFixtureRecords(
    client,
    "mail_messages",
    {
      id: OUTBOUND_MESSAGE_ID,
      mailbox_id: MAILBOX_ID,
      thread_id: THREAD_ID,
      provider_message_id: "gmail-outbound-seeded",
      direction: "outbound",
      actor_user_id: SALESMAN_ID,
      from_enc: encryptMailValue("PT5 Sales <chinapt5@gmail.com>", CONTENT_KEY),
      to_enc: encryptMailValue(
        JSON.stringify(["buyer@example.com"]),
        CONTENT_KEY,
      ),
      cc_enc: encryptMailValue("[]", CONTENT_KEY),
      bcc_enc: encryptMailValue("[]", CONTENT_KEY),
      subject_enc: encryptMailValue("New wholesale inquiry", CONTENT_KEY),
      text_body_enc: encryptMailValue("Hello from PT5.", CONTENT_KEY),
      html_body_enc: encryptMailValue("<p>Hello from PT5.</p>", CONTENT_KEY),
      raw_headers_enc: encryptMailValue(
        JSON.stringify({ "message-id": "<outbound-seeded@example.com>" }),
        CONTENT_KEY,
      ),
      occurred_at: outboundAt,
    },
    "id",
  );
  await insertMailFixtureRecords(
    client,
    "mail_outbound_recipients",
    {
      mailbox_id: MAILBOX_ID,
      message_id: OUTBOUND_MESSAGE_ID,
      thread_id: THREAD_ID,
      actor_user_id: SALESMAN_ID,
      email_hash: createBlindIndex("buyer@example.com", HASH_SECRET),
      recipient_kind: "to",
      occurred_at: outboundAt,
    },
    "message_id",
  );
  await insertMailFixtureRecords(
    client,
    "mail_messages",
    {
      id: MESSAGE_ID,
      mailbox_id: MAILBOX_ID,
      thread_id: THREAD_ID,
      provider_message_id: "gmail-inbound-seeded",
      direction: "inbound",
      from_enc: encryptMailValue("Buyer <buyer@example.com>", CONTENT_KEY),
      to_enc: encryptMailValue(
        JSON.stringify(["chinapt5+local-sales@gmail.com"]),
        CONTENT_KEY,
      ),
      cc_enc: encryptMailValue("[]", CONTENT_KEY),
      bcc_enc: encryptMailValue("[]", CONTENT_KEY),
      subject_enc: encryptMailValue("New wholesale inquiry", CONTENT_KEY),
      text_body_enc: encryptMailValue(
        "Hello, we need a quote for 500 units.",
        CONTENT_KEY,
      ),
      html_body_enc: encryptMailValue(
        "<p>Hello, we need a quote for 500 units.</p>",
        CONTENT_KEY,
      ),
      raw_headers_enc: encryptMailValue(
        JSON.stringify({ "message-id": "<seeded@example.com>" }),
        CONTENT_KEY,
      ),
      occurred_at: now,
    },
    "id",
  );
}
