import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

import { loginAs } from "./helpers/auth";
import { getLocalSupabaseAdminClient } from "./helpers/local-supabase-admin";

test("管理员从页面调整账号后，资料、身份、审计和登录信息一致", async ({ page }) => {
  const admin = getLocalSupabaseAdminClient();
  test.skip(!admin, "需要本地 Supabase 才能核对独立业务凭证。");
  if (!admin) return;

  const email = `e2e.account.${randomUUID()}@example.test`;
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    app_metadata: { role: "client", status: "active" },
    user_metadata: { name: "账号回归测试", business_board: "wholesale" },
  });
  expect(createError).toBeNull();
  const userId = created.user?.id;
  expect(userId).toBeTruthy();
  if (!userId) return;

  try {
    const { data: role, error: roleError } = await admin.from("user_roles")
      .select("id").eq("role", "client").single();
    expect(roleError).toBeNull();
    expect(role?.id).toBeTruthy();
    const { error: profileError } = await admin.from("user_profiles").upsert({
      user_id: userId, name: "账号回归测试", email, status: "active", city: "上海",
    });
    expect(profileError).toBeNull();
    const { error: userRoleError } = await admin.from("user_roles_data")
      .upsert({ user_id: userId, role_id: role?.id });
    expect(userRoleError).toBeNull();

    await loginAs(page, "administrator");
    await page.goto("/admin/accounts");
    await page.getByPlaceholder("搜索姓名、手机号、邮箱、城市、团队").fill(email);
    await page.getByRole("button", { name: "调整账号" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("combobox", { name: "调整为身份" }).click();
    await page.getByRole("option", { name: "运营" }).click();
    await dialog.getByRole("combobox", { name: "调整为状态" }).click();
    await page.getByRole("option", { name: "未启用" }).click();
    await dialog.getByRole("textbox", { name: "城市" }).fill("杭州");
    await dialog.getByRole("button", { name: "保存调整" }).click();
    await expect(dialog).toHaveCount(0);

    // 页面提示后另走服务角色读取权威表和 Auth，再刷新确认界面仍与落库一致。
    const { data: profile } = await admin.from("user_profiles")
      .select("status,city").eq("user_id", userId).single();
    expect(profile).toMatchObject({ status: "inactive", city: "杭州" });
    const { data: roleData } = await admin.from("user_roles_data")
      .select("user_roles(role)").eq("user_id", userId).single();
    expect((roleData?.user_roles as { role?: string } | null)?.role).toBe("operator");
    const { data: logs } = await admin.from("admin_user_account_change_logs")
      .select("id,next_role,next_status,next_city").eq("target_user_id", userId);
    expect(logs).toHaveLength(1);
    expect(logs?.[0]).toMatchObject({ next_role: "operator", next_status: "inactive", next_city: "杭州" });
    const { data: authUser } = await admin.auth.admin.getUserById(userId);
    expect(authUser.user?.app_metadata).toMatchObject({ role: "operator", status: "inactive" });
    const { data: sync } = await admin.from("admin_auth_metadata_sync")
      .select("sync_status").eq("user_id", userId).single();
    expect(sync?.sync_status).toBe("synced");

    await page.reload();
    await page.getByPlaceholder("搜索姓名、手机号、邮箱、城市、团队").fill(email);
    await expect(page.getByRole("row", { name: new RegExp(email) })).toContainText("杭州");

    // 故障注入：模拟数据库已提交，但登录资料仍为旧值；管理员刷新后应能完成补偿。
    const { error: staleAuthError } = await admin.auth.admin.updateUserById(userId, {
      app_metadata: { role: "client", status: "active" },
    });
    expect(staleAuthError).toBeNull();
    const { error: pendingError } = await admin.from("admin_auth_metadata_sync")
      .update({ sync_status: "pending", synced_at: null }).eq("user_id", userId);
    expect(pendingError).toBeNull();
    await page.reload();
    await page.getByPlaceholder("搜索姓名、手机号、邮箱、城市、团队").fill(email);
    await page.getByRole("button", { name: "调整账号" }).click();
    await page.getByRole("button", { name: "重试更新登录信息" }).click();
    await expect(page.getByText("登录信息已更新。")).toBeVisible();
    const { data: recoveredAuth } = await admin.auth.admin.getUserById(userId);
    expect(recoveredAuth.user?.app_metadata).toMatchObject({ role: "operator", status: "inactive" });
    const { data: recoveredSync } = await admin.from("admin_auth_metadata_sync")
      .select("sync_status").eq("user_id", userId).single();
    expect(recoveredSync?.sync_status).toBe("synced");
  } finally {
    // 注册触发器还会为批发客户建立关联；先删除这笔无订单的测试客户，Auth 才能级联清理账号。
    const { error: customerCleanupError } = await admin.from("wholesale_customers")
      .delete().eq("registered_user_id", userId);
    expect(customerCleanupError).toBeNull();
    const { error: userCleanupError } = await admin.auth.admin.deleteUser(userId);
    expect(userCleanupError).toBeNull();
  }
});
