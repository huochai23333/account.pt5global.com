import assert from "node:assert/strict";
import test from "node:test";
import { readHistoricalExchangeRateBatch, readManualExchangeRateBatch } from "../lib/exchange-rate-sync-results.ts";

const date = "2026-11-05";
const manualRow = { baseCurrency: "XTS", targetCurrency: "CNY", rateDate: date, ok: true };
const manualBatch = {
  operationId: "test-run", operationStatus: "succeeded", outcome: "succeeded",
  results: [manualRow], successCount: 1, failedCount: 0,
};

test("手动同步只接受请求币种和正确的当日报价", () => {
  assert.equal(readManualExchangeRateBatch(manualBatch, ["XTS"], [date]).successCount, 1);
  const successWithoutFailureCount = { ...manualBatch, failedCount: undefined };
  assert.equal(readManualExchangeRateBatch(successWithoutFailureCount, ["XTS"], ["2026-11-04", date]).failedCount, 0);
  assert.throws(() => readManualExchangeRateBatch(manualBatch, ["XTS", "XUA"], [date]), /仍未确认/);
  assert.throws(() => readManualExchangeRateBatch(manualBatch, ["XUA"], [date]), /仍未确认/);
  assert.throws(() => readManualExchangeRateBatch(manualBatch, ["XTS"], ["2026-11-06"]), /仍未确认/);
});

test("重复的币种和不匹配的结果统计不会被当作成功", () => {
  assert.throws(() => readManualExchangeRateBatch({ ...manualBatch, results: [manualRow, manualRow], successCount: 2 }, ["XTS", "XUA"], [date]), /仍未确认/);
  assert.throws(() => readManualExchangeRateBatch({ ...manualBatch, successCount: 2 }, ["XTS"], [date]), /仍未确认/);
  assert.throws(() => readManualExchangeRateBatch({ ...manualBatch, operationStatus: "queued" }, ["XTS"], [date]), /仍未确认/);
});

test("待重试或待人工处理的部分结果按实际明细保留", () => {
  const results = [manualRow, { baseCurrency: "XUA", targetCurrency: "CNY", ok: false }];
  const partial = { ...manualBatch, outcome: "partial_failed", results, failedCount: 1 };
  for (const operationStatus of ["queued", "needs_attention", "partial_failed"]) {
    assert.equal(readManualExchangeRateBatch({ ...partial, operationStatus }, ["XTS", "XUA"], [date]).outcome, "partial_failed");
  }
});

test("历史回执覆盖整个币种与日期组合，重复日期不能顶替缺项", () => {
  const first = { baseCurrency: "XTS", targetCurrency: "CNY", rateDate: "2026-11-04", status: "skipped" };
  const second = { ...first, rateDate: date, status: "inserted" };
  const input = { baseCurrencies: ["XTS"], fromDate: "2026-11-04", toDate: date };
  const batch = { operationId: "test-run", outcome: "succeeded", operationStatus: "succeeded", results: [first, second], insertedCount: 1, skippedCount: 1, failedCount: 0 };
  assert.equal(readHistoricalExchangeRateBatch(batch, input).results.length, 2);
  assert.throws(() => readHistoricalExchangeRateBatch({ ...batch, results: [first, { ...second, rateDate: first.rateDate }] }, input), /仍未确认/);
  assert.throws(() => readHistoricalExchangeRateBatch({ ...batch, skippedCount: 0 }, input), /仍未确认/);
  assert.throws(() => readHistoricalExchangeRateBatch(batch, { ...input, fromDate: "2026-10-01" }), /仍未确认/);
});
