import { expect, test } from "@playwright/test";

import { filterAdminCommissions } from "../../components/dashboard/commission/admin-commission-view-model";
import { validateTaskDraft } from "../../components/dashboard/tasks/task-form-validation";
import { getTaskScopeWithTeamLabel } from "../../components/dashboard/tasks/tasks-display";
import { normalizeCommissionRow } from "../../lib/admin-commission-normalizers";

const id = "b6200000-0000-4000-8000-000000000004";

test("历史订单佣金按当前语言关键词和具体状态共同筛选", () => {
  const orderId = "order-row";
  const raw = {
    id,
    order_overview_id: orderId,
    beneficiary_user_id: "staff-1",
    commission_category: "manual_adjustment",
    source_customer_user_id: null,
    source_salesman_user_id: null,
    order_amount_rmb_snapshot: "100",
    cost_amount_rmb_snapshot: null,
    service_fee_amount_rmb_snapshot: null,
    commission_amount_rmb: "12.50",
    calculation_snapshot: { revision: 2 },
    settlement_status: "pending",
    settled_at: null,
    settlement_note: null,
    created_at: null,
    updated_at: null,
  } as const;
  const orders = new Map([[orderId, {
    id: orderId,
    order_number: "  PT5-100  ",
    order_status: " completed ",
    deleted_at: null,
    completed_at: null,
  }]]);
  const pending = normalizeCommissionRow(raw, orders, new Map());
  const paid = normalizeCommissionRow({ ...raw, id: "paid-id", settlement_status: "paid" }, orders, new Map());
  expect(pending).toMatchObject({
    id,
    orderNumber: "PT5-100",
    orderStatus: "completed",
    orderAmountRmb: 100,
    commissionAmountRmb: 12.5,
    calculationSnapshot: { revision: 2 },
  });

  const filters = {
    beneficiaryUserId: "staff-1",
    category: "manual_adjustment",
    orderNumber: " pt5-10 ",
    searchText: "  MANUAL   adjustment ",
    settlementStatus: "pending",
  } as const;
  const translate = (key: string) =>
    key === "shared.categories.manualAdjustment" ? "Manual adjustment" : key;
  // 同订单的已结算记录仍须服从状态筛选，关键词可以匹配用户看到的翻译。
  expect(filterAdminCommissions([paid, pending], filters, translate)).toEqual([pending]);
});

test("团队任务标签使用完整分隔符，公开任务忽略团队名称", () => {
  const zh = (key: string) => ({ "scope.team": "团队", "scope.public": "公开" })[key] ?? key;
  const en = (key: string) => ({ "scope.team": "Team", "scope.public": "Public" })[key] ?? key;
  expect(getTaskScopeWithTeamLabel("team", "PT5", zh)).toBe("团队 · PT5");
  expect(getTaskScopeWithTeamLabel("team", "PT5", en)).toBe("Team · PT5");
  expect(getTaskScopeWithTeamLabel("team", null, en)).toBe("Team");
  expect(getTaskScopeWithTeamLabel("public", "PT5", zh)).toBe("公开");
});

test("任务不限人数时忽略旧上限，限额模式校验同一个输入", () => {
  const draft = {
    taskName: "学习夹具",
    taskTypeCode: "fixture",
    commissionAmount: "",
    acceptanceLimit: "1.5",
    acceptanceUnlimited: true,
    targetRoles: ["salesman" as const],
  };
  const key = (value: string) => value;
  // 表单会保留切换前的输入，只有当前选中限额时才校验它。
  expect(validateTaskDraft(draft, key)).toBeNull();
  expect(validateTaskDraft({ ...draft, acceptanceUnlimited: false }, key))
    .toBe("validation.acceptanceLimitInvalid");
  expect(validateTaskDraft({ ...draft, acceptanceUnlimited: false, acceptanceLimit: "2" }, key))
    .toBeNull();
});
