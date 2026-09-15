import assert from "node:assert/strict";
import test from "node:test";

import { requireSucceededOperationRun } from "../lib/operation-runs.ts";

const completeRun = {
  attemptCount: 1,
  completedAt: "2026-09-15T04:00:00.000Z",
  createdAt: "2026-09-15T03:59:00.000Z",
  expectedCount: 2,
  failedCount: 0,
  lastErrorCode: null,
  lastErrorMessage: null,
  nextAttemptAt: null,
  operationId: "00000000-0000-4000-8000-000000000001",
  operationKey: "exchange-rate-sync",
  resultProof: { verifiedDates: ["2026-09-12"] },
  status: "succeeded",
  succeededCount: 2,
};

test("完整成功终态必须包含完成时间且数量一致", () => {
  assert.equal(requireSucceededOperationRun(completeRun), completeRun);

  for (const patch of [
    { completedAt: null },
    { failedCount: 1 },
    { succeededCount: 1 },
  ]) {
    assert.throws(
      () => requireSucceededOperationRun({ ...completeRun, ...patch }),
      /后台处理没有确认全部完成/,
    );
  }
});

test("部分失败、失败、需处理和跳过都不能冒充成功", () => {
  for (const status of [
    "partial_failed",
    "failed",
    "needs_attention",
    "skipped",
  ]) {
    assert.throws(
      () => requireSucceededOperationRun({ ...completeRun, status }),
      /后台处理没有确认全部完成/,
    );
  }
});
