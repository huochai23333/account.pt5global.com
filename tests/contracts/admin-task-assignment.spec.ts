import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { changeTaskFormType, createEmptyTaskForm } from "../../components/dashboard/admin-tasks/admin-tasks-utils";
import { updateAdminTaskAssignment } from "../../lib/admin-task-mutations";
import type { TaskTargetRole, TaskTypeOption } from "../../lib/admin-tasks-types";

const taskId = "review-task";
const targetRoles: TaskTargetRole[] = ["operator", "salesman"];

function assignmentClient(
  reads: Array<Array<{ task_id: string; target_role: TaskTargetRole }>>,
  writeError: Error | null = null,
) {
  const events: unknown[] = [];
  // 模拟数据库边界，明确区分改派前、函数响应和独立改派后读回。
  const client = {
    from(table: string) {
      expect(table).toBe("task_target_roles");
      return {
        select: () => ({
          in(column: string, ids: string[]) {
            events.push([table, column, ids]);
            return { returns: async () => ({ data: reads.shift(), error: null }) };
          },
        }),
      };
    },
    async rpc(name: string, input: unknown) {
      events.push([name, input]);
      return { data: null, error: writeError };
    },
  } as unknown as SupabaseClient;
  return { client, events };
}

function rows(...roles: TaskTargetRole[]) {
  return roles.map((target_role) => ({ task_id: taskId, target_role }));
}

test("改派后读回完整角色集合，顺序不同也能确认", async () => {
  const { client, events } = assignmentClient([rows("finance"), rows("salesman", "operator")]);
  await expect(updateAdminTaskAssignment(client, { taskId, targetRoles })).resolves.toEqual({
    status: "saved", targetRoles: ["salesman", "operator"],
  });
  expect(events).toEqual([
    ["task_target_roles", "task_id", [taskId]],
    ["set_task_target_roles", { p_task_id: taskId, p_target_roles: targetRoles }],
    ["task_target_roles", "task_id", [taskId]],
  ]);
});

test("函数无异常但角色未变、数量相同但角色不同或属于另一任务都不得确认", async () => {
  for (const wrong of [
    rows("finance"),
    rows("finance", "salesman"),
    [],
    rows(...targetRoles).map((row) => ({ ...row, task_id: "other-task" })),
  ]) {
    const { client } = assignmentClient([rows("finance"), wrong]);
    await expect(updateAdminTaskAssignment(client, { taskId, targetRoles }))
      .rejects.toThrow("task target roles not confirmed");
  }
});

test("已是目标集合时跳过写入，数据库拒绝时保留原错误", async () => {
  const unchanged = assignmentClient([rows(...targetRoles)]);
  await expect(updateAdminTaskAssignment(unchanged.client, { taskId, targetRoles })).resolves.toEqual({
    status: "unchanged", targetRoles,
  });
  expect(unchanged.events).toHaveLength(1);

  const error = new Error("task target roles can only be changed before acceptance");
  const denied = assignmentClient([rows("finance")], error);
  await expect(updateAdminTaskAssignment(denied.client, { taskId, targetRoles })).rejects.toBe(error);
  expect(denied.events).toHaveLength(2);
});

test("新建和编辑切换任务类型只替换空白或旧默认金额", () => {
  const options: TaskTypeOption[] = [
    { code: "basic", displayName: "Basic", defaultCommissionAmountRmb: 20, isActive: true, description: null, sortOrder: 1 },
    { code: "advanced", displayName: "Advanced", defaultCommissionAmountRmb: 40, isActive: true, description: null, sortOrder: 2 },
  ];
  const form = createEmptyTaskForm(options);
  expect(changeTaskFormType(form, "advanced", options).commissionAmount).toBe("40.00");
  expect(changeTaskFormType({ ...form, commissionAmount: "" }, "advanced", options).commissionAmount).toBe("40.00");
  expect(changeTaskFormType({ ...form, commissionAmount: "23.00" }, "advanced", options).commissionAmount).toBe("23.00");
});
