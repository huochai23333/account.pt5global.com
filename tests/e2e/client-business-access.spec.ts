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
    candidateEmail: "local.promoter-client@bs.test",
    dialogName: "添加到批发业务",
    page,
    path: "/admin/wholesale/customers",
    successMessage: "客户已添加到批发业务。",
  });

  // Toast 只表示页面收到响应；独立服务端查询必须同时确认访问表和正式客户档案。
  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select("user_id")
    .eq("email", "local.promoter-client@bs.test")
    .single<{ user_id: string }>();
  if (profileError) throw profileError;

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
      .getByText("Local promoter client", { exact: true })
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await expectNoDocumentHorizontalOverflow(page);
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
