import assert from "node:assert/strict";
import test from "node:test";

import { requireOperatorReimbursementBatchReceipt } from "../lib/operator-reimbursement-receipts.ts";

test("RPC 无报错但影响 0 行时不能显示报销成功", () => {
  assert.throws(
    () =>
      requireOperatorReimbursementBatchReceipt(
        {
          period_end: "2026-09-24",
          period_start: "2026-08-25",
          reimbursed_total: 0,
          updated_count: 0,
        },
        "2026-08-25",
      ),
    /没有确认完成报销/,
  );
});

test("RPC 返回其它周期时不能显示报销成功", () => {
  assert.throws(
    () =>
      requireOperatorReimbursementBatchReceipt(
        {
          period_end: "2026-08-24",
          period_start: "2026-07-25",
          reimbursed_total: 88.66,
          updated_count: 1,
        },
        "2026-08-25",
      ),
    /没有确认完成报销/,
  );
});

test("同一周期的正数更新数量和金额形成报销凭证", () => {
  assert.deepEqual(
    requireOperatorReimbursementBatchReceipt(
      {
        period_end: "2026-09-24",
        period_start: "2026-08-25",
        reimbursed_total: "88.66",
        updated_count: "1",
      },
      "2026-08-25",
    ),
    {
      periodEnd: "2026-09-24",
      periodStart: "2026-08-25",
      reimbursedTotal: 88.66,
      updatedCount: 1,
    },
  );
});

// 单次只改变一项回执字段；正金额不能掩盖0行，正行数不能掩盖0金额。
const validBatch = { period_end: "2026-09-24", period_start: "2026-08-25", reimbursed_total: 88.66, updated_count: 1 };
for (const [field, wrong] of [
  ["updated_count", 0], ["updated_count", -1], ["updated_count", 1.5],
  ["reimbursed_total", 0], ["reimbursed_total", Number.NaN], ["reimbursed_total", Number.POSITIVE_INFINITY],
  ["period_start", "2026-07-25"], ["period_end", ""],
]) {
  test(`batch receipt rejects isolated ${field}=${String(wrong)}`, () => {
    assert.throws(() => requireOperatorReimbursementBatchReceipt({ ...validBatch, [field]: wrong }, "2026-08-25"));
  });
}
