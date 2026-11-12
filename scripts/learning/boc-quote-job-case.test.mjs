import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createBocQuoteJobCase } from "../../tests/test-support/boc-quote-job-case.ts";

const today = "2026-11-11";
const quotedAt = today + "T00:01:00+08:00";
const manual = { trigger: "manual", baseCurrencies: ["USD"] };
const preview = { trigger: "recalculation_rates" };
const row = (fields) => ({ id: randomUUID(), _xmin: "100", ...fields });

function prepare() {
  const owner = randomUUID();
  const graph = {
    rates: [],
    runs: [],
    attempts: [],
    alerts: [],
    transport: [],
    verifications: [],
  };
  // 端口只模拟快照和插入后的四份类型行，真实锁和DELETE由隔离 PostgreSQL 核对。
  const job = createBocQuoteJobCase(
    (sql) => {
      if (sql.includes("insert into public.boc_quote_verifications")) {
        graph.verifications = ["USD", "EUR"].flatMap((currency) =>
          ["current", "historical"].map((quote_kind) =>
            row({
              currency,
              quote_kind,
              history_complete: true,
              boc_url:
                "https://www.boc.cn/sourcedb/whpj/?local-fixture-only=" + owner,
            }),
          ),
        );
      } else assert.match(sql, /^select jsonb_build_object/);
      return JSON.stringify(graph);
    },
    owner,
    today,
  );
  job.prepare();
  function appendRun(payload = manual, status = "succeeded") {
    const run = row({
      request_payload: payload,
      status,
      operation_key: "exchange-rate-sync",
      trigger_source: "manual",
      requested_by_user_id: null,
      next_attempt_at: null,
      completed_at: quotedAt,
      attempt_count: 1,
      result_proof: { records: [], diagnostic: "fixture-detail-do-not-attach" },
    });
    graph.runs.push(run);
    const attempt = row({
      operation_run_id: run.id,
      status,
      completed_at: quotedAt,
      transport_request_id: null,
    });
    graph.attempts.push(attempt);
    return { run, attempt };
  }
  function addQuote(run) {
    const rate = row({
      original_currency: "USD",
      target_currency: "CNY",
      rate_date: today,
      daily_exchange_rate: 7,
      source: "nowapi",
      bank_code: "BOC",
      quote_type: "spot_buy",
      provider_updated_at: quotedAt,
    });
    graph.rates.push(rate);
    run.result_proof.records.push({
      rateRecordId: rate.id,
      baseCurrency: "USD",
      targetCurrency: "CNY",
      rateDate: today,
      rate: 7,
      quotedAt,
    });
    return rate;
  }
  return { job, graph, appendRun, addQuote };
}

test("真实服务身份没有申请人，任务凭证可认领报价且附件仅含摘要", () => {
  const { job, appendRun, addQuote } = prepare();
  const { run } = appendRun();
  const rate = addQuote(run);
  job.recordOperation(run.id, manual, "succeeded");
  job.capture();
  const evidence = job.evidence();
  assert.equal(evidence.captured.rates[0].id, rate.id);
  assert.equal(evidence.captured.runs[0].status, "succeeded");
  assert.equal(evidence.realBankVerification, false);
  assert(!JSON.stringify(evidence).includes("fixture-detail-do-not-attach"));
});

test("后台编号虽相同，触发内容或响应终态不相符仍拒绝", () => {
  for (const [payload, status] of [
    [preview, "succeeded"],
    [manual, "skipped"],
  ]) {
    const { job, appendRun } = prepare();
    const { run } = appendRun();
    job.recordOperation(run.id, payload, status);
    assert.throws(() => job.capture(), /boc_suite_run_not_owned_or_terminal/);
    assert.deepEqual(job.evidence().captured.runs, []);
  }
});

test("未知任务、重复回包和未终态运行各自拒绝", () => {
  const { job, appendRun } = prepare();
  const { run } = appendRun(manual, "running");
  assert.throws(() => job.capture(), /boc_suite_run_not_owned_or_terminal/);
  job.recordOperation(run.id, manual, "running");
  assert.throws(
    () => job.recordOperation(run.id, manual, "running"),
    /boc_suite_response_operation_invalid/,
  );
  assert.throws(() => job.capture(), /boc_suite_run_not_owned_or_terminal/);
});

test("同一编号的报价必须同时匹配日期、值和发布时间", () => {
  for (const field of ["rateDate", "rate", "quotedAt"]) {
    const { job, appendRun, addQuote } = prepare();
    const { run } = appendRun();
    addQuote(run);
    run.result_proof.records[0][field] = null;
    job.recordOperation(run.id, manual, "succeeded");
    assert.throws(() => job.capture(), /boc_suite_quote_receipt_missing/);
    assert.deepEqual(job.evidence().captured.rates, []);
  }
});

test("终态任务缺尝试或出现额外传输行时保留现场", () => {
  const { job, graph, appendRun } = prepare();
  const { run, attempt } = appendRun();
  job.recordOperation(run.id, manual, "succeeded");
  graph.attempts.pop();
  assert.throws(() => job.capture(), /boc_suite_attempt_not_terminal/);
  graph.attempts.push(attempt);
  graph.transport.push({ id: 41, _xmin: "100" });
  assert.throws(() => job.capture(), /boc_suite_foreign_transport/);
});

test("后续预览不能重新认领先前尝试的新版本", () => {
  const { job, appendRun, addQuote } = prepare();
  const first = appendRun();
  addQuote(first.run);
  job.recordOperation(first.run.id, manual, "succeeded");
  job.capture();
  const second = appendRun(preview, "skipped");
  job.recordOperation(second.run.id, preview, "skipped");
  first.attempt._xmin = "101";
  assert.throws(() => job.capture(), /boc_suite_prior_receipt_changed/);
  assert.equal(job.evidence().captured.attempts[0].version, "100");
});
