import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const modules = new Map();
function load(name) {
  assert(
    [
      "wholesale-release-case",
      "wholesale-release-receipts",
      "wholesale-release-seed",
      "settlement-repair-sql",
      "settlement-repair-receipts",
    ].includes(name),
  );
  if (modules.has(name)) return modules.get(name);
  const file = new URL(`../../tests/test-support/${name}.ts`, import.meta.url);
  const js = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const exports = {};
  new Function("exports", "require", js)(exports, (dependency) =>
    dependency.startsWith("node:")
      ? require(dependency)
      : load(dependency.slice(2)),
  );
  modules.set(name, exports);
  return exports;
}
const { createWholesaleReleaseCase } = load("wholesale-release-case");
const { emptyRepairGraph } = load("settlement-repair-sql");
const row = (value) => ({ id: randomUUID(), _xmin: "200", ...value });

/** 模拟回执丢失和版本漂移。正式 SQL、金额与外键由隔离数据库另验。 */
function fixture({ occupied = false, loseCleanupReply = false } = {}) {
  const finance = randomUUID(),
    salesman = randomUUID();
  let graph = emptyRepairGraph(),
    deletes = 0,
    prepares = 0;
  if (occupied) graph.rates.push(row({ source: "manual" }));
  const job = createWholesaleReleaseCase((sql) => {
    if (sql.includes("'roles',"))
      return JSON.stringify({
        date: "2026-11-11",
        roles: [
          { role: "finance", id: finance },
          { role: "salesman", id: salesman },
        ],
      });
    if (sql.includes("insert into public.wholesale_customers")) {
      prepares++;
      const { seed } = job;
      const archive = row({
        customer_id: seed.customerId,
        user_id: null,
        kind: "customer",
      });
      graph = {
        ...emptyRepairGraph(),
        customers: [
          row({
            id: seed.customerId,
            unique_name: seed.customerName,
            assigned_sales_user_id: salesman,
            created_by_user_id: salesman,
          }),
        ],
        archives: [archive],
        folders: [
          row({
            archive_id: archive.id,
            system_key: "personal",
            parent_id: null,
          }),
        ],
        rates: [
          row({
            id: seed.rateId,
            original_currency: "USD",
            target_currency: "CNY",
            source: "manual",
            rate_date: seed.date,
            provider_rate_date: seed.date,
            daily_exchange_rate: 7.2,
            bank_quote: 720,
            bank_code: "BOC",
          }),
        ],
        orders: seed.orders.map((order, i) =>
          row({
            id: order.id,
            order_number: order.number,
            customer_id: seed.customerId,
            sales_user_id: salesman,
            created_by_user_id: salesman,
            customer_payment_currency: "USD",
            customer_payment_amount: order.amount,
            ordered_at: `2026-11-${i ? "10" : "09"}T01:00:00Z`,
          }),
        ),
        commissions: seed.orders.map((order) =>
          row({
            order_id: order.id,
            customer_id: seed.customerId,
            beneficiary_user_id: salesman,
            status: "pending",
          }),
        ),
      };
    } else if (sql.includes("settlement_repair_delete_count_releases")) {
      deletes++;
      const receipt = Object.fromEntries(
        Object.entries(graph).map(([name, rows]) => [name, rows.length]),
      );
      graph = emptyRepairGraph();
      if (loseCleanupReply) throw new Error("fixture_commit_reply_lost");
      return JSON.stringify(receipt);
    }
    return JSON.stringify(graph);
  });
  function publish() {
    job.begin("formal");
    const { seed } = job,
      requestId = randomUUID();
    const value = row({
      publication_request_id: requestId,
      note: seed.releases.formal.note,
      published_by_user_id: finance,
      customer_id: seed.customerId,
      customer_name: seed.customerName,
      release_amount: 3000,
      release_currency: "USD",
      received_on: seed.date,
      status: "pending",
      allocation_revision: 0,
      allocation_customer_id: null,
      cancelled_at: null,
    });
    graph.releases.push(value);
    job.published("formal", { id: value.id, requestId });
    return value;
  }
  return { job, publish, counts: () => ({ deletes, prepares }) };
}

test("空范围准备不把已有报价或外来数据采为夹具", () => {
  const { job, counts } = fixture({ occupied: true });
  assert.throws(() => job.prepare(), /wholesale_release_scope_occupied/);
  assert.equal(job.cleanup(), undefined);
  assert.deepEqual(counts(), { deletes: 0, prepares: 0 });
});

test("未确认的发布必须保留最后凭证，禁止盲目回收", () => {
  const { job, counts } = fixture();
  job.prepare();
  job.begin("formal");
  assert.throws(() => job.cleanup(), /wholesale_release_cleanup_unconfirmed/);
  assert.equal(job.evidence().inFlight, "formal");
  assert.equal(counts().deletes, 0);
});

test("相同发布和金额的行版本变化也会拒绝清理", () => {
  const { job, publish, counts } = fixture();
  job.prepare();
  const release = publish();
  release._xmin = "201";
  assert.throws(() => job.unchanged(), /wholesale_release_versions_changed/);
  assert.throws(() => job.cleanup(), /wholesale_release_cleanup_unconfirmed/);
  assert.equal(counts().deletes, 0);
});

test("回收可能已提交但回包丢失时拒绝再次删除", () => {
  const { job, publish, counts } = fixture({ loseCleanupReply: true });
  job.prepare();
  publish();
  assert.throws(() => job.cleanup(), /fixture_commit_reply_lost/);
  assert.throws(() => job.cleanup(), /wholesale_release_no_confirmed_snapshot/);
  assert.equal(counts().deletes, 1);
  assert.equal(job.evidence().cleaned, false);
});
