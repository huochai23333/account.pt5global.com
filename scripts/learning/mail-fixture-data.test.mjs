import assert from "node:assert/strict";
import test from "node:test";
import {
  identity,
  mailbox,
  agents,
  messages,
  reset,
  security,
  mailFixtureStore,
  jsonResponse,
} from "../../tests/test-support/mail-fixture-store.mjs";

test("邮箱密文、凭据与通知游标关联同一邮箱，必填主题和有效期完整", async () => {
  const { client, rows, calls } = mailFixtureStore();
  const now = new Date().toISOString();
  await mailbox.seedMailFixtureMailbox(client, now);
  const [account] = rows.mail_shared_mailboxes,
    [credentials] = rows.mail_shared_mailbox_credentials,
    [watch] = rows.mail_shared_mailbox_watches;
  assert.equal(account.id, identity.MAILBOX_ID);
  assert.equal(credentials.mailbox_id, account.id);
  assert.equal(watch.mailbox_id, account.id);
  assert.equal(
    security.decryptMailValue(account.email_enc, identity.CONTENT_KEY),
    "chinapt5@gmail.com",
  );
  assert.equal(
    security.decryptMailValue(
      credentials.access_token_enc,
      identity.CREDENTIAL_KEY,
    ),
    "local-access-token",
  );
  assert.equal(
    security.decryptMailValue(
      credentials.refresh_token_enc,
      identity.CREDENTIAL_KEY,
    ),
    "local-refresh-token",
  );
  assert.equal(watch.topic_name, "projects/local/topics/pt5-mail");
  assert.equal(watch.history_id, "100");
  assert(
    Date.parse(watch.expiration) >
      Date.parse(credentials.access_token_expires_at),
  );
  assert(Date.parse(credentials.access_token_expires_at) > Date.parse(now));
  assert.equal(calls.filter((call) => call.method === "GET").length, 3);
});

test("发件资料与飞书身份属于两名业务员，管理员留给实际应用建档", async () => {
  const { client, rows } = mailFixtureStore();
  await agents.seedMailFixtureAgents(client);
  const ids = [identity.SALESMAN_ID, identity.PEER_SALESMAN_ID].sort();
  assert.deepEqual(
    rows.mail_agent_profiles.map((row) => row.user_id).sort(),
    ids,
  );
  assert.deepEqual(
    rows.mail_feishu_bindings.map((row) => row.user_id).sort(),
    ids,
  );
  assert(
    !rows.mail_agent_profiles.some((row) => row.user_id === identity.ADMIN_ID),
  );
  assert.equal(
    new Set(rows.mail_agent_profiles.map((row) => row.alias_local_part)).size,
    2,
  );
  assert.equal(
    security.decryptMailValue(
      rows.mail_agent_profiles[0].signature_html_enc,
      identity.CONTENT_KEY,
    ),
    "<p>PT5 Team</p>",
  );
});

test("入站会话有历史出站收件人凭证，编号、归属和时间一致", async () => {
  const { client, rows, calls } = mailFixtureStore();
  const now = new Date().toISOString();
  await messages.seedMailFixtureConversation(client, now);
  const [thread] = rows.mail_threads,
    [recipient] = rows.mail_outbound_recipients;
  const outbound = rows.mail_messages.find(
    (row) => row.direction === "outbound",
  );
  const inbound = rows.mail_messages.find((row) => row.direction === "inbound");
  assert.equal(thread.id, identity.THREAD_ID);
  assert.equal(outbound.id, identity.OUTBOUND_MESSAGE_ID);
  assert.equal(inbound.id, identity.MESSAGE_ID);
  for (const row of [thread, recipient, outbound, inbound])
    assert.equal(row.mailbox_id, identity.MAILBOX_ID);
  for (const row of [recipient, outbound, inbound])
    assert.equal(row.thread_id, thread.id);
  assert.equal(thread.assigned_user_id, outbound.actor_user_id);
  assert.equal(recipient.actor_user_id, outbound.actor_user_id);
  assert.equal(recipient.message_id, outbound.id);
  assert.equal(recipient.email_hash, thread.customer_email_hash);
  assert(Date.parse(outbound.occurred_at) < Date.parse(inbound.occurred_at));
  assert.equal(recipient.occurred_at, outbound.occurred_at);
  assert.equal(
    security.decryptMailValue(inbound.text_body_enc, identity.CONTENT_KEY),
    "Hello, we need a quote for 500 units.",
  );
  assert.deepEqual(
    calls.filter((call) => call.method === "POST").map((call) => call.table),
    [
      "mail_threads",
      "mail_messages",
      "mail_outbound_recipients",
      "mail_messages",
    ],
  );
});

test("基础数据准备缺少中间凭证时，不继续创建后续关联", async () => {
  const { client, calls } = mailFixtureStore({
    override: (call) =>
      call.table === "mail_shared_mailbox_credentials" && call.method === "GET"
        ? jsonResponse([])
        : undefined,
  });
  await assert.rejects(
    mailbox.seedMailFixtureMailbox(client, new Date().toISOString()),
    /独立查回/,
  );
  assert(!calls.some((call) => call.table === "mail_shared_mailbox_watches"));
});

test("整表清理保持原十九张表顺序及六个非 id 主键，不触及其他业务", async () => {
  const { client, calls } = mailFixtureStore({
    initial: { unrelated: [{ id: "keep" }] },
  });
  await reset.clearIntegratedMailFixture(client);
  const deletes = calls.filter((call) => call.method === "DELETE");
  assert.equal(deletes.length, 19);
  assert.equal(calls.length, 38);
  assert.equal(deletes[0].table, "mail_inbound_ignore_receipts");
  assert.equal(deletes.at(-1).table, "mail_shared_mailboxes");
  assert.equal(deletes.filter((call) => call.query.has("id")).length, 13);
  assert(!calls.some((call) => call.table === "unrelated"));
});
