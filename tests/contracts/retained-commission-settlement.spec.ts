import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import {
  markCommissionRecordAsPaid,
  markTaskCommissionRecordAsPaid,
} from "../../lib/commission-settlement";

const id = "b6200000-0000-4000-8000-000000000004";
const paidRow = {
  id,
  settlement_status: "paid",
  settled_at: "2026-11-05T22:28:54Z",
  settlement_note: null as string | null,
};

function fixture({
  receipt = id as string | null,
  row = paidRow as typeof paidRow | null,
  readError = null as Error | null,
  writeError = null as Error | null,
} = {}) {
  // 分开记录写入回执与读回结果，防止测试用同一个响应证明结算成功。
  const writes: Array<{ name: string; params: Record<string, unknown> }> = [];
  const reads: Array<{ table: string; column: string; value: string }> = [];
  const supabase = {
    rpc(name: string, params: Record<string, unknown>) {
      writes.push({ name, params });
      return Promise.resolve({ data: receipt, error: writeError });
    },
    from(table: string) {
      return {
        select: () => ({
          eq(column: string, value: string) {
            reads.push({ table, column, value });
            return { maybeSingle: () => Promise.resolve({ data: row, error: readError }) };
          },
        }),
      };
    },
  } as unknown as SupabaseClient;
  return { supabase, writes, reads };
}

test("订单佣金按回执编号读回已结算原记录", async () => {
  const { supabase, reads, writes } = fixture();
  await expect(markCommissionRecordAsPaid(supabase, { commissionRecordId: id })).resolves.toBe(id);
  expect(writes).toEqual([{
    name: "update_commission_settlement",
    params: {
      p_commission_record_id: id,
      p_settlement_status: "paid",
      p_settled_at: null,
      p_settlement_note: null,
    },
  }]);
  expect(reads).toEqual([{ table: "commission_record", column: "id", value: id }]);
});

test("任务佣金读回任务表并核对规范化的结算说明", async () => {
  const { supabase, reads, writes } = fixture({
    row: { ...paidRow, settlement_note: "内部核对" },
  });
  await expect(markTaskCommissionRecordAsPaid(supabase, {
    taskCommissionRecordId: id,
    settlementNote: " 内部核对 ",
  })).resolves.toBe(id);
  expect(writes[0]).toMatchObject({
    name: "update_task_commission_settlement",
    params: { p_task_commission_record_id: id, p_settlement_note: "内部核对" },
  });
  expect(reads).toEqual([{ table: "task_commission_record", column: "id", value: id }]);
});

test("回执为空或错配时无法凭请求编号宣布成功", async () => {
  for (const receipt of [null, "another-record"]) {
    const { supabase, reads } = fixture({ receipt });
    await expect(markCommissionRecordAsPaid(supabase, { commissionRecordId: id }))
      .rejects.toThrow("commission settlement not confirmed");
    expect(reads).toEqual([]);
  }
});

test("正确回执也必须核对可见记录、状态、时间和说明", async () => {
  for (const row of [
    null,
    { ...paidRow, id: "another-record" },
    { ...paidRow, settlement_status: "pending" },
    { ...paidRow, settled_at: "invalid" },
    { ...paidRow, settlement_note: "concurrently changed" },
  ]) {
    const { supabase } = fixture({ row });
    await expect(markTaskCommissionRecordAsPaid(supabase, { taskCommissionRecordId: id }))
      .rejects.toThrow("commission settlement not confirmed");
  }
  const { supabase } = fixture({ readError: new Error("offline") });
  await expect(markTaskCommissionRecordAsPaid(supabase, { taskCommissionRecordId: id }))
    .rejects.toThrow("commission settlement not confirmed");
});

test("已变化的记录拒绝默认重复结算并保留数据库错误", async () => {
  const writeError = new Error("commission settlement no longer pending");
  const { supabase, reads, writes } = fixture({ writeError });
  await expect(markCommissionRecordAsPaid(supabase, { commissionRecordId: id }))
    .rejects.toBe(writeError);
  expect(reads).toEqual([]);
  expect(writes).toHaveLength(1);
});
