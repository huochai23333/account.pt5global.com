import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { getRegressionAccount, type RegressionRole } from "./helpers/accounts";
import { loginAs } from "./helpers/auth";
import { getLocalSupabaseAdminClient, readLocalEnvValue } from "./helpers/local-supabase-admin";

test("岗位首页的关键待处理数量与数据库及目标页面一致", async ({ page }) => {
  test.setTimeout(120_000);
  const url = readLocalEnvValue("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = readLocalEnvValue("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const admin = getLocalSupabaseAdminClient();
  test.skip(!url || !anonKey || !admin, "需要本地数据库核对岗位待办。");
  if (!url || !anonKey || !admin) return;

  for (const role of ["administrator", "salesman", "finance", "operator", "client"] as const satisfies readonly RegressionRole[]) {
    const account = getRegressionAccount(role);
    const db = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: signedIn, error: signInError } = await db.auth.signInWithPassword({ email: account.email, password: account.password });
    expect(signInError).toBeNull();
    const userId = signedIn.user?.id;
    expect(userId).toBeTruthy();

    let key: "mail" | "settlements" | "reimbursements" | "creditOrders";
    let count: number | null;
    if (role === "administrator" || role === "salesman") {
      key = "mail";
      let query = admin.from("mail_threads").select("id", { count: "exact", head: true })
        .eq("intake_status", "active").eq("state", "waiting_pt5").is("deleted_at", null);
      if (role === "salesman") query = query.eq("assigned_user_id", userId!);
      const result = await query;
      expect(result.error).toBeNull();
      count = result.count;
    } else if (role === "finance") {
      key = "settlements";
      const result = await db.from("wholesale_settlement_releases").select("id", { count: "exact", head: true }).eq("status", "pending");
      expect(result.error).toBeNull();
      count = result.count;
    } else if (role === "operator") {
      key = "reimbursements";
      const result = await db.from("operator_reimbursements").select("id", { count: "exact", head: true }).eq("operator_user_id", userId!).eq("status", "unreimbursed");
      expect(result.error).toBeNull();
      count = result.count;
    } else {
      key = "creditOrders";
      const result = await db.from("customer_inventory_orders").select("id", { count: "exact", head: true }).eq("payment_status", "awaiting_payment");
      expect(result.error).toBeNull();
      count = result.count;
    }
    expect(count).not.toBeNull();
    await loginAs(page, role);
    await page.goto(`${account.workspacePath}/home`);
    await expect(page.getByTestId(`role-task-count-${key}`)).toHaveText(`待处理 ${count}`);
    await page.getByTestId(`role-task-count-${key}`).click();
    await expect(page).toHaveURL(new RegExp(`${account.workspacePath}/(?:mail|wholesale/settlement-releases|reimbursements|wholesale/inventory-orders)$`));
    await page.goto("/auth/sign-out?next=%2Flogin");
    await page.getByRole("button", { name: "退出登录" }).click();
  }
});
