import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { createTaskType, deactivateTaskType, updateTaskType } from "../../lib/admin-task-type-management";
import type { TaskTypeCatalogRecord } from "../../lib/admin-tasks-types";

const input = {
  displayName: " Customer follow-up ",
  description: " Training example ",
  defaultCommissionAmountRmb: 25.125,
};
const saved: TaskTypeCatalogRecord = {
  code: "task_type_example",
  display_name: "Customer follow-up",
  description: "Training example",
  default_commission_amount_rmb: "25.125",
  is_active: true,
  sort_order: 10,
};

function taskTypeClient({
  receipt = saved,
  readback = saved,
  writeError = null,
}: {
  receipt?: Partial<TaskTypeCatalogRecord> | null;
  readback?: Partial<TaskTypeCatalogRecord> | null;
  writeError?: Error | null;
} = {}) {
  const calls: unknown[] = [];
  // 函数返回值和目录读取是两个独立结果，便于注入错编码和过期状态。
  const client = {
    rpc(name: string, params: unknown) {
      calls.push([name, params]);
      return { single: async () => ({ data: receipt, error: writeError }) };
    },
    from(table: string) {
      return {
        select: () => ({
          eq: (column: string, code: string) => ({
            maybeSingle: async () => {
              calls.push([table, column, code]);
              return { data: readback, error: null };
            },
          }),
        }),
      };
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

test("创建后用生成的编码独立读回全部表单字段", async () => {
  const { client, calls } = taskTypeClient();
  await expect(createTaskType(client, input)).resolves.toMatchObject({
    code: saved.code,
    displayName: "Customer follow-up",
    description: "Training example",
    defaultCommissionAmountRmb: 25.125,
    isActive: true,
  });
  expect(calls).toEqual([
    ["create_task_type", { p_display_name: input.displayName, p_description: "Training example", p_default_commission_amount_rmb: 25.125 }],
    ["task_type_catalog", "code", saved.code],
  ]);
});

test("编辑必须返回原编码且读回的字段完全匹配", async () => {
  const { client } = taskTypeClient();
  await expect(updateTaskType(client, { ...input, code: saved.code! })).resolves.toMatchObject({ code: saved.code });
  for (const fixture of [
    taskTypeClient({ receipt: { ...saved, code: "different-type" } }),
    taskTypeClient({ readback: { ...saved, display_name: "Old name" } }),
    taskTypeClient({ readback: { ...saved, default_commission_amount_rmb: 24 } }),
    taskTypeClient({ readback: null }),
  ]) {
    await expect(updateTaskType(fixture.client, { ...input, code: saved.code! }))
      .rejects.toThrow("task type write not confirmed");
  }
});

test("停用须读回明确的停用状态，缺字段和仍启用均失败", async () => {
  const inactive = { ...saved, is_active: false };
  const { client } = taskTypeClient({ receipt: inactive, readback: inactive });
  await expect(deactivateTaskType(client, saved.code!)).resolves.toMatchObject({ isActive: false });
  for (const readback of [saved, { ...inactive, is_active: undefined }, { ...inactive, code: "wrong" }]) {
    const fixture = taskTypeClient({ receipt: inactive, readback });
    await expect(deactivateTaskType(fixture.client, saved.code!)).rejects.toThrow("task type write not confirmed");
  }
});

test("空金额、空回执及权限失败均不能进入成功分支", async () => {
  for (const receipt of [null, { ...saved, default_commission_amount_rmb: "" }]) {
    const { client, calls } = taskTypeClient({ receipt });
    await expect(createTaskType(client, { ...input, defaultCommissionAmountRmb: 0 }))
      .rejects.toThrow("task type write not confirmed");
    expect(calls).toHaveLength(1);
  }
  const error = new Error("only administrator can update task type");
  const { client, calls } = taskTypeClient({ writeError: error });
  await expect(deactivateTaskType(client, saved.code!)).rejects.toBe(error);
  expect(calls).toHaveLength(1);
});
