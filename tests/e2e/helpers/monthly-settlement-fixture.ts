import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

type MonthlyRole = "administrator" | "finance" | "salesman";
type MonthlyAccount = { email: string; password: string; role: MonthlyRole; workspacePath: string };

/** 运行前就生成全部归属编号；任何准备步骤失败，收尾仍能精确找到本次已写入的部分。 */
export function createMonthlySettlementFixture(now = new Date()) {
  const token = randomUUID();
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
  const monthStart = `${date.slice(0, 7)}-01`;
  const previousDate = new Date(new Date(`${monthStart}T00:00:00Z`).getTime() - 86_400_000).toISOString().slice(0, 10);
  return {
    token, date, monthStart, previousDate, customerId: randomUUID(), orderId: randomUUID(),
    notes: [`monthly-unallocated-${token}`, `monthly-cny-${token}`, `monthly-usd-${token}`, `previous-month-${token}`, `cancelled-${token}`],
    userIds: [] as string[], accounts: [] as MonthlyAccount[],
  };
}
export type MonthlySettlementFixture = ReturnType<typeof createMonthlySettlementFixture>;

/** 创建专属三岗位、客户和订单；授权来自真实角色表，不用显示名称或自填metadata决定权限。 */
export async function prepareMonthlySettlementFixture(admin: SupabaseClient, fixture: MonthlySettlementFixture) {
  const { token, userIds, accounts, customerId, orderId, monthStart } = fixture;
  for (const role of ["administrator", "finance", "salesman"] as const) {
    const email = `monthly-${role}-${token}@pt5global.test`;
    const password = `Monthly!${randomUUID()}`;
    const { data, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { name: `Monthly ${role}`, business_board: "wholesale" },
    });
    if (error || !data.user) throw error ?? new Error("创建测试账号失败。");
    const userId = data.user.id;
    userIds.push(userId);
    const { data: roleRow, error: roleError } = await admin.from("user_roles").select("id").eq("role", role).single();
    if (roleError || !roleRow?.id) throw roleError ?? new Error("测试岗位不存在。");
    for (const result of [
      await admin.from("user_profiles").update({ status: "active" }).eq("user_id", userId).select("user_id").single(),
      await admin.from("user_roles_data").upsert({ user_id: userId, role_id: roleRow.id }).select("user_id").single(),
      await admin.from("user_workspace_business_access").upsert({ user_id: userId, business_key: "wholesale", is_enabled: true }).select("user_id").single(),
    ]) {
      if (result.error || result.data?.user_id !== userId) throw result.error ?? new Error("测试账号配置没有完整写入。");
    }
    accounts.push({ email, password, role, workspacePath: role === "administrator" ? "/admin" : `/${role}` });
  }
  const customer = await admin.from("wholesale_customers").insert({
    id: customerId, unique_name: `Monthly customer ${token}`, customer_kind: "sales_created",
    assigned_sales_user_id: userIds[2], created_by_user_id: userIds[0],
  }).select("id").single();
  if (customer.error || customer.data?.id !== customerId) throw customer.error ?? new Error("本次客户没有完整写入。");
  const order = await admin.from("wholesale_orders").insert({
    id: orderId, order_number: `MONTHLY-${token}`, customer_id: customerId,
    sales_user_id: userIds[2], created_by_user_id: userIds[0], order_month: monthStart,
    customer_payment_currency: "CNY", customer_payment_amount: 10000, settlement_exchange_rate: 1,
  }).select("id").single();
  if (order.error || order.data?.id !== orderId) throw order.error ?? new Error("本次订单没有完整写入。");
}

/** 月份/币种/取消四种余额样例只在页面基线确认后写入，金额预期不由被测统计函数生成。 */
export async function insertMonthlySettlementBalances(admin: SupabaseClient, fixture: MonthlySettlementFixture) {
  const { notes, customerId, token, userIds, date, previousDate } = fixture;
  const { data, error } = await admin.from("wholesale_settlement_releases").insert([
    { note: notes[1], release_amount: 124293.70, release_currency: "CNY", received_on: date, status: "pending" },
    { note: notes[2], release_amount: 50203.40, release_currency: "USD", received_on: date, status: "pending" },
    { note: notes[3], release_amount: 999, release_currency: "USD", received_on: previousDate, status: "pending" },
    { note: notes[4], release_amount: 88, release_currency: "USD", received_on: date, status: "cancelled" },
  ].map(row => ({
    ...row, customer_id: customerId, customer_name: `Monthly customer ${token}`, published_by_user_id: userIds[1],
    cancelled_by_user_id: row.status === "cancelled" ? userIds[1] : null,
    cancelled_at: row.status === "cancelled" ? new Date().toISOString() : null,
  }))).select("id,note");
  if (error) throw error;
  const expected = new Set(notes.slice(1));
  if (!Array.isArray(data) || data.length !== 4 || new Set(data.map(row => row.id)).size !== 4
    || new Set(data.map(row => row.note)).size !== 4 || data.some(row => !row.id || !expected.has(row.note))) {
    throw new Error("本次余额样例缺少准确写入凭证。");
  }
}
