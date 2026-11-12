import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const loaded = new Map();
// 只加载两个实际凭证模块及其 SQL 构造。端口用合成快照，无容器、账号或供应商请求。
function load(name) {
  assert(
    [
      "settlement-repair-case",
      "settlement-repair-receipts",
      "settlement-repair-sql",
    ].includes(name),
  );
  if (loaded.has(name)) return loaded.get(name);
  const file = new URL(`../../tests/test-support/${name}.ts`, import.meta.url);
  const script = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const exports = {};
  new Function("exports", "require", script)(exports, (dependency) =>
    dependency.startsWith("node:")
      ? require(dependency)
      : load(dependency.slice(2)),
  );
  loaded.set(name, exports);
  return exports;
}
const { emptyRepairGraph } = load("settlement-repair-sql");
const { requireRepairedRate, requireRepairAllocation } = load(
  "settlement-repair-receipts",
);
const { createSettlementRepairCase } = load("settlement-repair-case");
const date = "2026-11-10",
  completed = date + "T23:59:59+08:00";
const row = (fields) => ({ id: randomUUID(), _xmin: "150", ...fields });
function terminal() {
  const fixture = { actor: randomUUID(), date, orderId: randomUUID() };
  const releaseId = randomUUID(),
    operationId = randomUUID(),
    transportRequestId = 41;
  const dispatch = { operationId, transportRequestId };
  const target = {
    baseCurrency: "USD",
    rateDate: date,
    settlementReleaseId: releaseId,
  };
  const rate = row({
    original_currency: "USD",
    target_currency: "CNY",
    rate_date: date,
    provider_rate_date: date,
    source: "nowapi",
    bank_code: "BOC",
    quote_type: "spot_buy",
    is_day_final: true,
    bank_quote: 669.93,
    daily_exchange_rate: 6.6993,
    provider_updated_at: completed,
  });
  const run = row({
    id: operationId,
    operation_key: "exchange-rate-sync",
    trigger_source: "event",
    requested_by_user_id: fixture.actor,
    idempotency_key: `settlement-rate:${releaseId}:${date}`,
    status: "succeeded",
    expected_count: 1,
    succeeded_count: 1,
    failed_count: 0,
    attempt_count: 1,
    next_attempt_at: null,
    completed_at: completed,
    request_payload: { ...target, trigger: "settlement_repair" },
    result_proof: {
      ...target,
      rateRecordId: rate.id,
      source: "nowapi",
      verifiedDates: [date],
    },
  });
  const shared = {
    order_id: fixture.orderId,
    settled_on: date,
    exchange_rate_id: rate.id,
    exchange_rate_quoted_at: completed,
    buying_exchange_rate: 6.6993,
    settlement_exchange_rate: 6.632307,
    created_by_user_id: fixture.actor,
  };
  const settlement = row({
    ...shared,
    source_settlement_release_id: releaseId,
    settlement_amount: 10,
    settlement_rmb_amount: 66.32,
  });
  const graph = {
    ...emptyRepairGraph(),
    rates: [rate],
    runs: [run],
    attempts: [
      row({
        operation_run_id: operationId,
        attempt_number: 1,
        status: "succeeded",
        completed_at: completed,
        transport_request_id: transportRequestId,
      }),
    ],
    responses: [
      row({
        id: transportRequestId,
        status_code: 200,
        error_msg: null,
        timed_out: false,
      }),
    ],
    orders: [
      row({
        id: fixture.orderId,
        status: "partial_settled",
        customer_payment_rmb_amount: 66.32,
      }),
    ],
    settlements: [settlement],
    allocations: [
      row({
        ...shared,
        release_id: releaseId,
        settlement_id: settlement.id,
        status: "active",
        allocation_amount: 10,
      }),
    ],
  };
  return { graph, fixture, releaseId, dispatch, rate };
}

test("完整关联报价与实际结汇凭证可以逐层核对", () => {
  const { graph, fixture, releaseId, dispatch, rate } = terminal();
  assert.equal(requireRepairedRate(graph, fixture, releaseId, dispatch), rate);
  requireRepairAllocation(graph, fixture, releaseId, rate);
});

test("HTTP成功仍拒绝外来任务、错误运输编号和未终态尝试", () => {
  for (const field of ["id", "status", "transport", "attempt"]) {
    const { graph, fixture, releaseId, dispatch } = terminal();
    if (field === "id") graph.runs[0].id = randomUUID();
    if (field === "status") graph.runs[0].status = "partial_failed";
    if (field === "transport") graph.responses[0].id += 1;
    if (field === "attempt") graph.attempts[0].status = "running";
    assert.throws(
      () => requireRepairedRate(graph, fixture, releaseId, dispatch),
      /settlement_repair_task_proof/,
    );
  }
});

test("错日、非日末或另一个报价编号都不能确认补价", () => {
  for (const field of [
    "rateRecordId",
    "verifiedDates",
    "provider_rate_date",
    "is_day_final",
  ]) {
    const { graph, fixture, releaseId, dispatch } = terminal();
    if (field === "rateRecordId")
      graph.runs[0].result_proof.rateRecordId = randomUUID();
    if (field === "verifiedDates")
      graph.runs[0].result_proof.verifiedDates = ["2026-11-09"];
    if (field === "provider_rate_date")
      graph.rates[0].provider_rate_date = "2026-11-09";
    if (field === "is_day_final") graph.rates[0].is_day_final = false;
    assert.throws(
      () => requireRepairedRate(graph, fixture, releaseId, dispatch),
      /settlement_repair_(rate_proof|exact_quote)/,
    );
  }
});

test("修订号之外仍检查分配与结汇实际金额及同一报价", () => {
  for (const field of [
    "exchange_rate_id",
    "settlement_amount",
    "settlement_rmb_amount",
  ]) {
    const { graph, fixture, releaseId, rate } = terminal();
    graph.settlements[0][field] = null;
    assert.throws(
      () => requireRepairAllocation(graph, fixture, releaseId, rate),
      /settlement_repair_allocation_/,
    );
  }
});

test("已有报价或业务图时只读拒绝准备", () => {
  const statements = [];
  const existing = { ...emptyRepairGraph(), rates: [row({})] };
  const actor = randomUUID();
  const job = createSettlementRepairCase((sql) => {
    statements.push(sql);
    return JSON.stringify(statements.length === 1 ? [actor] : existing);
  }, date);
  assert.throws(() => job.prepare(), /settlement_repair_scope_occupied/);
  assert.equal(job.cleanup(), undefined);
  assert.equal(statements.length, 2);
  assert(statements.every((sql) => sql.startsWith("select")));
});
