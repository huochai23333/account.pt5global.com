import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createBlindIndex,
  encryptMailValue,
} from "../../../lib/mail/mail-security";
import { insertMailFixtureRecords } from "./mail-fixture-records";
import {
  MAILBOX_ID,
  CONTENT_KEY,
  CREDENTIAL_KEY,
  HASH_SECRET,
} from "./mail-fixture-identity";

/** 邮箱、密文凭据和必填通知游标按依赖顺序建立；不请求 Google。 */
export async function seedMailFixtureMailbox(
  client: SupabaseClient,
  now: string,
) {
  await insertMailFixtureRecords(
    client,
    "mail_shared_mailboxes",
    {
      id: MAILBOX_ID,
      provider_subject: "local-shared-mailbox",
      email_enc: encryptMailValue("chinapt5@gmail.com", CONTENT_KEY),
      email_hash: createBlindIndex("chinapt5@gmail.com", HASH_SECRET),
      email_masked: "ch*******@gmail.com",
      status: "active",
      cutover_started_at: now,
      last_healthy_at: now,
    },
    "id",
  );
  await insertMailFixtureRecords(
    client,
    "mail_shared_mailbox_credentials",
    {
      mailbox_id: MAILBOX_ID,
      access_token_enc: encryptMailValue("local-access-token", CREDENTIAL_KEY),
      refresh_token_enc: encryptMailValue(
        "local-refresh-token",
        CREDENTIAL_KEY,
      ),
      access_token_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      scopes: ["https://www.googleapis.com/auth/gmail.modify"],
    },
    "mailbox_id",
  );
  await insertMailFixtureRecords(
    client,
    "mail_shared_mailbox_watches",
    {
      mailbox_id: MAILBOX_ID,
      history_id: "100",
      expiration: new Date(Date.now() + 6 * 24 * 60 * 60_000).toISOString(),
      topic_name: "projects/local/topics/pt5-mail",
      last_renewed_at: now,
    },
    "mailbox_id",
  );
}
