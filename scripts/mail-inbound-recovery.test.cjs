/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

const cutover = "2026-09-01T08:00:00.000Z";
const published = "2026-09-01T09:00:00.000Z";
const startsAfter = `after:${Date.parse(cutover) / 1000}`;
const eventId = "inbound-fixture";
const mailboxId = "mailbox-fixture";
const expiration = String(Date.now() + 6 * 86_400_000);

// 只替换 HTTP、数据库和单封归档边界，运行真实 Gmail 分页、worker 与续订调度。
function loadMailSource(filename, boundaries) {
  const sourcePath = path.join(__dirname, "..", "lib", "mail", filename + ".ts");
  const source = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  const load = (name) => {
    if (Object.hasOwn(boundaries, name)) return boundaries[name];
    if (["./mail-inbound-errors", "./mail-google-api", "./mail-google-inbound"].includes(name)) {
      return loadMailSource(name.slice(2), boundaries);
    }
    throw new Error("未隔离的依赖：" + name);
  };
  vm.runInThisContext("(function(require,exports,fetch){" + source + "\n})", { filename: sourcePath })(load, exports, boundaries.fetch);
  return exports;
}

function createFixture() {
  const watch = { mailbox_id: mailboxId, history_id: "90", expiration: "2026-09-01T10:00:00Z" };
  const mailbox = { id: mailboxId, cutover_started_at: cutover, last_synced_at: null, status: "active" };
  const event = { id: eventId, mailbox_id: mailboxId, target_history_id: "130", published_at: published, status: "pending", attempt_count: 0 };
  const records = { watch, mailbox, event, messages: [], audit: [], pages: [] };
  const faults = { secondPage: null, archive: null, watchExpiration: expiration, loseCompletionReceipt: false };

  const db = {
    rpc(name, input) {
      if (name === "claim_mail_inbound_events") {
        assert.equal(event.status, "pending");
        event.status = "processing";
        event.attempt_count += 1;
        return Promise.resolve({ data: [{ ...event }], error: null });
      }
      assert.equal(name, "settle_mail_inbound_event");
      assert.equal(input.p_event_id, event.id);
      const receipt = { event_id: event.id, attempt_count: input.p_attempt, outcome: event.status, history_id: watch.history_id };
      // 真实事务、行锁与权限由独立 Docker 核验；这里用边界结果验证 worker 如何解释回执。
      if (event.status !== "completed") {
        assert.equal(input.p_attempt, event.attempt_count);
        assert.equal(event.status, "processing");
        event.status = input.p_outcome;
        receipt.outcome = event.status;
        if (input.p_outcome === "completed") {
          watch.history_id = input.p_history_id;
          receipt.history_id = watch.history_id;
          mailbox.last_synced_at = new Date().toISOString();
          if (input.p_recovered_since) records.audit.push(input);
          if (faults.loseCompletionReceipt) {
            return { single: async () => ({ data: null, error: new Error("模拟响应丢失") }) };
          }
        }
      }
      return { single: async () => ({ data: receipt, error: null }) };
    },
    from(table) {
      let action = "select";
      let patch;
      const builder = {};
      for (const method of ["select", "eq", "lt"]) builder[method] = () => builder;
      builder.update = (value) => { action = "update"; patch = value; return builder; };
      const read = (many) => {
        if (table === "mail_inbound_rejection_receipts") return { data: null, error: null };
        const row = {
          mail_shared_mailbox_watches: watch,
          mail_shared_mailboxes: mailbox,
          mail_inbound_events: event,
        }[table];
        assert.ok(row, table);
        if (action === "update") Object.assign(row, patch);
        return { data: many ? [{ ...row }] : { ...row }, error: null };
      };
      builder.single = builder.maybeSingle = () => Promise.resolve(read(false));
      builder.then = (resolve, reject) => Promise.resolve().then(() => read(true)).then(resolve, reject);
      return builder;
    },
  };
  const dependencies = {
    "server-only": {},
    "@/lib/supabase-admin-server": { getSupabaseServiceRoleClient: () => db },
    "./mail-env": { getMailEnv: () => ({ emailHashSecret: "fixture" }) },
    "./mail-security": { createBlindIndex: (value) => value },
    "./mail-google-credentials": {
      GoogleAuthorizationError: class extends Error {},
      getSharedAccessToken: async () => "fixture-token",
      renewSharedWatch: async () => ({ historyId: "200", expiration: faults.watchExpiration }),
    },
    "./mail-inbound-message": {
      async persistInboundMessage(id, _token, message) {
        assert.equal(id, mailboxId);
        if (faults.archive === message.id) throw new Error("模拟单封归档失败");
        if (!records.messages.includes(message.id)) records.messages.push(message.id);
      },
    },
    "./mail-storage": {},
    async fetch(address, init) {
      const url = new URL(address);
      assert.equal(init.headers.authorization, "Bearer fixture-token");
      if (url.pathname.endsWith("/history")) return new Response("", { status: 404 });
      if (url.pathname.endsWith("/messages")) {
        const page = url.searchParams.get("pageToken");
        records.pages.push({ page, query: url.searchParams.get("q") });
        if (!page) return Response.json({ messages: [{ id: "first" }], nextPageToken: "page-two" });
        if (faults.secondPage === "http") return new Response("retry", { status: 503 });
        if (faults.secondPage === "repeat") {
          if (records.pages.length > 2) throw new Error("不应重复请求同一分页令牌");
          return Response.json({ messages: [], nextPageToken: "page-two" });
        }
        return Response.json({ messages: [{ id: "first" }, { id: "second" }] });
      }
      const id = url.pathname.split("/").at(-1);
      return Response.json({ id, threadId: id });
    },
  };
  return { records, faults, dependencies, ...loadMailSource("mail-inbound-worker", dependencies) };
}

test("历史过期后从启用时间遍历所有回补页，同一编号只归档一次", async () => {
  const { records, processInboundEventBatch } = createFixture();
  assert.deepEqual(await processInboundEventBatch(), { processedCount: 1, succeededCount: 1, failedCount: 0 });
  assert.deepEqual(records.pages, [{ page: null, query: startsAfter }, { page: "page-two", query: startsAfter }]);
  assert.deepEqual(records.messages, ["first", "second"]);
  assert.equal(records.watch.history_id, "130");
  assert.equal(records.event.status, "completed");
  assert.equal(records.audit.length, 1);
});

test("下一页失败或分页令牌重复时保留游标和上次同步时间", async () => {
  for (const fault of ["http", "repeat"]) {
    const { faults, records, processInboundEventBatch } = createFixture();
    const lastSynced = "2026-09-01T08:30:00.000Z";
    records.mailbox.last_synced_at = lastSynced;
    faults.secondPage = fault;
    assert.deepEqual(await processInboundEventBatch(), { processedCount: 1, succeededCount: 0, failedCount: 1 });
    assert.ok(records.pages.every((item) => item.query === `after:${Date.parse(lastSynced) / 1000}`));
    assert.equal(records.pages.length, 2);
    assert.deepEqual(records.messages, []);
    assert.deepEqual(records.audit, []);
    assert.equal(records.watch.history_id, "90");
    assert.equal(records.mailbox.last_synced_at, lastSynced);
    assert.equal(records.event.status, "failed");
  }
});

test("后续邮件归档失败时可重新回补，已处理的邮件不会重复保存", async () => {
  const { faults, records, processInboundEventBatch } = createFixture();
  faults.archive = "second";
  assert.deepEqual(await processInboundEventBatch(), { processedCount: 1, succeededCount: 0, failedCount: 1 });
  assert.deepEqual(records.messages, ["first"]);
  assert.deepEqual(records.audit, []);
  assert.equal(records.watch.history_id, "90");
  assert.equal(records.event.status, "failed");
  faults.archive = null;
  records.event.status = "pending";
  assert.deepEqual(await processInboundEventBatch(), { processedCount: 1, succeededCount: 1, failedCount: 0 });
  assert.deepEqual(records.messages, ["first", "second"]);
  assert.equal(records.audit.length, 1);
  assert.equal(records.watch.history_id, "130");
});

test("续订只延长 Watch，保留未处理来信使用的同步游标", async () => {
  const { records, dependencies } = createFixture();
  const { renewMailWatchIfNeeded } = loadMailSource("mail-maintenance", dependencies);
  assert.equal(await renewMailWatchIfNeeded(), 1);
  assert.equal(records.watch.expiration, new Date(Number(expiration)).toISOString());
  assert.equal(records.watch.history_id, "90");
});

test("供应商返回无效续订期限时保留原期限和游标", async () => {
  const { records, faults, dependencies } = createFixture();
  const { renewMailWatchIfNeeded } = loadMailSource("mail-maintenance", dependencies);
  faults.watchExpiration = "invalid";
  const original = records.watch.expiration;
  assert.equal(await renewMailWatchIfNeeded(), 0);
  assert.equal(records.watch.expiration, original);
  assert.equal(records.watch.history_id, "90");
  assert.match(records.watch.renewal_error, /有效的续订期限/);
});

test("完成事务的响应丢失时，失败入口读回同一领取的完成凭证", async () => {
  const { faults, records, processInboundEventBatch } = createFixture();
  faults.loseCompletionReceipt = true;
  assert.deepEqual(await processInboundEventBatch(), { processedCount: 1, succeededCount: 1, failedCount: 0 });
  assert.equal(records.event.status, "completed");
  assert.equal(records.watch.history_id, "130");
  assert.equal(records.audit.length, 1);
});
