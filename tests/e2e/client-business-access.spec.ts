import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import {
  expectNotForbiddenPage,
  expectWorkspaceShell,
  loginAs,
} from "./helpers/auth";
import { getLocalSupabaseAdminClient } from "./helpers/local-supabase-admin";

test("administrator is blocked from tourism and can add a verified wholesale client", async ({
  page,
}) => {
  const admin = getLocalSupabaseAdminClient();
  test.skip(!admin, "必须连接本地 Docker Supabase 才能核对客户业务权限凭证。");
  if (!admin) return;

  // 每次准备一个新的已验证客户，避免上次回归留下的权限让候选列表为空。
  const candidateEmail = `e2e.client-business.${randomUUID()}@example.test`;
  const candidateName = "业务客户回归测试";
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: candidateEmail,
    email_confirm: true,
    app_metadata: { role: "client", status: "active" },
    user_metadata: { name: candidateName, business_board: "wholesale" },
  });
  expect(createError).toBeNull();
  const userId = created.user?.id;
  expect(userId).toBeTruthy();
  if (!userId) return;

  try {
    // 注册触发器会先赋予所选业务；本测试要从“尚未加入”的状态验证管理员添加流程。
    const { error: initialCustomerError } = await admin.from("wholesale_customers")
      .delete().eq("registered_user_id", userId);
    expect(initialCustomerError).toBeNull();
    const { error: initialAccessError } = await admin.from("user_workspace_business_access")
      .delete().eq("user_id", userId).eq("business_key", "wholesale");
    expect(initialAccessError).toBeNull();
    const { data: role, error: roleError } = await admin.from("user_roles")
      .select("id").eq("role", "client").single();
    expect(roleError).toBeNull();
    const { error: profileError } = await admin.from("user_profiles").upsert({
      user_id: userId, name: candidateName, email: candidateEmail, status: "active", city: "上海",
    });
    expect(profileError).toBeNull();
    const { error: userRoleError } = await admin.from("user_roles_data")
      .upsert({ user_id: userId, role_id: role?.id });
    expect(userRoleError).toBeNull();

    await page.setViewportSize({ height: 844, width: 390 });
    await loginAs(page, "administrator");

  // 旅游业务已经停用；旧地址必须进入说明页，不能继续保留一个看似可写的旧入口。
    await page.goto("/admin/tourism/customers");
    await expect(page).toHaveURL(
      /\/business-unavailable\?business=tourism$/,
    );
    await expect(
      page.getByRole("heading", { name: "旅游业务暂时停止服务" }),
    ).toBeVisible();

    await addClientFromBusinessPage({
      candidateEmail,
      dialogName: "添加到批发业务",
      page,
      path: "/admin/wholesale/customers",
      successMessage: "客户已添加到批发业务。",
    });

  // Toast 只表示页面收到响应；独立服务端查询必须同时确认访问表和正式客户档案。
    const { data: profile, error: savedProfileError } = await admin
      .from("user_profiles")
      .select("user_id")
      .eq("email", candidateEmail)
      .single<{ user_id: string }>();
    if (savedProfileError) throw savedProfileError;

    const [{ data: access, error: accessError }, { data: customer, error: customerError }] =
      await Promise.all([
      admin
        .from("user_workspace_business_access")
        .select("business_key,is_enabled")
        .eq("user_id", profile.user_id)
        .eq("business_key", "wholesale")
        .single<{ business_key: string; is_enabled: boolean }>(),
      admin
        .from("wholesale_customers")
        .select("id,registered_user_id")
        .eq("registered_user_id", profile.user_id)
        .single<{ id: string; registered_user_id: string }>(),
      ]);
    if (accessError) throw accessError;
    if (customerError) throw customerError;
    expect(access).toEqual({ business_key: "wholesale", is_enabled: true });
    expect(customer.id).toEqual(expect.any(String));
    expect(customer.registered_user_id).toBe(profile.user_id);

    await page.reload();
    await expect(
      page
        .getByText(candidateName, { exact: true })
        .filter({ visible: true })
        .first(),
    ).toBeVisible();
    await expectNoDocumentHorizontalOverflow(page);
  } finally {
    // 先删除没有订单的临时客户，再删除测试 Auth 用户，避免影响下次回归的候选资格。
    const { error: customerCleanupError } = await admin.from("wholesale_customers")
      .delete().eq("registered_user_id", userId);
    expect(customerCleanupError).toBeNull();
    const { error: userCleanupError } = await admin.auth.admin.deleteUser(userId);
    expect(userCleanupError).toBeNull();
  }
});

async function addClientFromBusinessPage({
  candidateEmail,
  dialogName,
  page,
  path,
  successMessage,
}: {
  candidateEmail: string;
  dialogName: string;
  page: Page;
  path: string;
  successMessage: string;
}) {
  await page.goto(path);
  await expectWorkspaceShell(page);
  await expectNotForbiddenPage(page);
  await page.getByRole("button", { name: "添加客户", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: dialogName });
  await dialog
    .getByRole("searchbox", { name: "搜索客户" })
    .fill(candidateEmail);
  await expect(
    dialog.getByText(candidateEmail, { exact: false }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "添加客户", exact: true }).click();

  await expect(page.getByText(successMessage)).toBeVisible();
  await expect(dialog).toHaveCount(0);
}

async function expectNoDocumentHorizontalOverflow(page: Page) {
  const overflowPixels = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );

  expect(overflowPixels).toBeLessThanOrEqual(2);
}
