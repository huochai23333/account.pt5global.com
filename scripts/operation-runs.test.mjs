import assert from "node:assert/strict";
import test from "node:test";

import { getOperationRun, requireSucceededOperationRun, waitForOperationTerminal } from "../lib/operation-runs.ts";

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

test("查询必须匹配原运行编号并拒绝无法核对的计数", async () => {
  // 数据库回执里的计数是非负整数；缺值和布尔值不能借由 Number() 变成零。
  const client = { rpc: async () => ({ data: completeRun, error: null }) };
  assert.deepEqual(await getOperationRun(client, completeRun.operationId), completeRun);
  await assert.rejects(getOperationRun(client, "00000000-0000-4000-8000-000000000002"), /operation_run_id_mismatch/);
  for (const failedCount of [null, false, -1, 0.5, "0"]) {
    const wrong = { rpc: async () => ({ data: { ...completeRun, failedCount }, error: null }) };
    await assert.rejects(getOperationRun(wrong, completeRun.operationId), /operation_number_invalid/);
  }
});

test("等待窗口结束时，以最后一次读回的实际状态为准", async () => {
  for (const [status, kind] of [["succeeded", "terminal"], ["running", "confirming"]]) {
    const client = { rpc: async () => ({ data: { ...completeRun, status }, error: null }) };
    const result = await waitForOperationTerminal(client, completeRun.operationId, { timeoutMs: 0 });
    assert.equal(result.kind, kind);
    assert.equal(result.run.status, status);
  }
});
