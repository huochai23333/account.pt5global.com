import { expect, test } from "@playwright/test";

import { getRegressionAccount } from "./helpers/accounts";
import { loginAs, loginWithAccount } from "./helpers/auth";
import { getLocalSupabaseAdminClient } from "./helpers/local-supabase-admin";

// 用例组织与断言留在 spec，公共页面步骤和浏览器存储夹具分别维护。
import {
  addClientAndSwitchBackToAdministrator,
  openMyPage,
  submitLogin,
  expectAccountSwitcherLayoutToFit,
} from "./helpers/account-switcher-ui";
import {
  expireStoredAccount,
  replaceStoredSessionWithInvalidTokens,
  readStoredAccountSummary,
  readPendingLoginSummary,
} from "./helpers/account-switcher-storage";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

test.describe("common account switching", () => {
  test("顶部菜单可添加账号，并以服务端身份核对一键切换", async ({ page }) => {
    test.setTimeout(120_000);
    const admin = getLocalSupabaseAdminClient();
    test.skip(!admin, "需要本地数据库独立核对账号身份。");
    if (!admin) return;

    const administrator = await loginAs(page, "administrator");
    await page.getByTestId("workspace-account-menu-trigger").click();
    await page.getByTestId("workspace-account-switch").click();
    await expect(page).toHaveURL(/\/login(?:[?#].*)?$/, { timeout: 30_000 });
    await expect(page.getByText(/请登录另一个账号/)).toBeVisible();
    expect(await readPendingLoginSummary(page)).toMatchObject({
      currentEmail: administrator.email,
      kind: "add",
    });

    const client = getRegressionAccount("client");
    await loginWithAccount(page, client);
    await page.getByTestId("workspace-account-menu-trigger").click();
    await page.getByTestId("workspace-account-switch").click();
    await expect(page).toHaveURL(/\/admin\/home(?:[?#].*)?$/, { timeout: 30_000 });
    await page.getByTestId("workspace-account-menu-trigger").click();
    await page.getByTestId("workspace-account-switch").click();
    await expect(page).toHaveURL(/\/client\/home(?:[?#].*)?$/, { timeout: 30_000 });

    // 工作区布局会在服务端重新验证 Auth 用户与数据库角色；另行查询权威表核对目标账号。
    const { data: profile, error: profileError } = await admin
      .from("user_profiles")
      .select("user_id,email")
      .eq("email", client.email)
      .single<{ user_id: string; email: string }>();
    if (profileError) throw profileError;
    const { data: roleLink, error: roleLinkError } = await admin
      .from("user_roles_data")
      .select("role_id")
      .eq("user_id", profile.user_id)
      .single<{ role_id: string }>();
    if (roleLinkError) throw roleLinkError;
    const { data: role, error: roleError } = await admin
      .from("user_roles")
      .select("role")
      .eq("id", roleLink.role_id)
      .single<{ role: string }>();
    if (roleError) throw roleError;
    expect(profile.email).toBe(client.email);
    expect(role.role).toBe("client");

    await page.reload();
    await expect(page).toHaveURL(/\/client\/home(?:[?#].*)?$/);
    await page.goto("/client/my");
    await expect(page.getByText(client.email, { exact: true }).first()).toBeVisible();
  });

  test("菜单遇到损坏的备用会话时拒绝切换并要求重新登录", async ({ page }) => {
    await addClientAndSwitchBackToAdministrator(page);
    await replaceStoredSessionWithInvalidTokens(page);
    await page.reload();

    await page.getByTestId("workspace-account-menu-trigger").click();
    await page.getByTestId("workspace-account-switch").click();
    await expect(page.getByText(/需要重新登录后才能继续切换/)).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/my(?:[?#].*)?$/);
    expect(await readStoredAccountSummary(page)).toMatchObject({
      hasSession: false,
      state: "reauthentication-required",
    });

    await page.getByTestId("workspace-account-switch").click();
    await expect(page).toHaveURL(/\/login(?:[?#].*)?$/, { timeout: 30_000 });
    expect(await readPendingLoginSummary(page)).toMatchObject({ kind: "reauthenticate" });
  });

  test("菜单遇到已过期的备用会话时直接进入目标账号重新登录", async ({ page }) => {
    const client = getRegressionAccount("client");
    await addClientAndSwitchBackToAdministrator(page);
    await expireStoredAccount(page);
    await page.reload();

    await page.getByTestId("workspace-account-menu-trigger").click();
    await page.getByTestId("workspace-account-switch").click();
    await expect(page).toHaveURL(/\/login(?:[?#].*)?$/, { timeout: 30_000 });
    expect(await readPendingLoginSummary(page)).toMatchObject({
      kind: "reauthenticate",
      targetEmail: client.email,
    });
    expect(await readStoredAccountSummary(page)).toMatchObject({
      hasSession: false,
      state: "reauthentication-required",
    });
  });

  test("remembers the alternate account after reopening the browser", async ({
    browser,
  }) => {
    const firstContext = await browser.newContext({ baseURL: BASE_URL });
    let client: ReturnType<typeof getRegressionAccount>;
    let browserState: Awaited<ReturnType<typeof firstContext.storageState>>;
    // 首次登录、断言或保存状态失败时，也关闭本用例创建的上下文。
    try {
      const firstPage = await firstContext.newPage();
      ({ client } = await addClientAndSwitchBackToAdministrator(firstPage));

      const savedBeforeRestart = await readStoredAccountSummary(firstPage);
      expect(savedBeforeRestart).toMatchObject({
        email: client.email,
        hasSession: true,
        state: "ready",
      });
      expect(savedBeforeRestart?.remainingDays).toBeGreaterThanOrEqual(29);
      expect(await readPendingLoginSummary(firstPage)).toBeNull();

      // storageState 保存 Cookie 和 localStorage，下一上下文据此模拟重新打开。
      browserState = await firstContext.storageState();
    } finally {
      await firstContext.close();
    }

    const reopenedContext = await browser.newContext({
      baseURL: BASE_URL,
      storageState: browserState,
    });
    try {
      const reopenedPage = await reopenedContext.newPage();
      await openMyPage(reopenedPage, "/admin/my");
      await expect(
        reopenedPage.getByText(client.email, { exact: true }),
      ).toBeVisible();

      await reopenedPage.getByRole("button", { name: /^切换$/ }).click();
      await expect(reopenedPage).toHaveURL(/\/client\/home(?:[?#].*)?$/, {
        timeout: 30_000,
      });
    } finally {
      await reopenedContext.close();
    }
  });

  test("keeps account identity but removes session tokens after 30 days", async ({
    page,
  }) => {
    const client = getRegressionAccount("client");
    const wrongAccount = getRegressionAccount("salesman");

    const { administrator } =
      await addClientAndSwitchBackToAdministrator(page);
    await expireStoredAccount(page);
    await page.reload();

    await expect(page.getByRole("button", { name: /^重新登录$/ })).toBeVisible();
    expect(await readStoredAccountSummary(page)).toMatchObject({
      email: client.email,
      hasSession: false,
      reauthenticationReason: "expired",
      state: "reauthentication-required",
    });

    await page.getByRole("button", { name: /^重新登录$/ }).click();
    await expect(page).toHaveURL(/\/login(?:[?#].*)?$/);
    await expect(
      page.getByText(`请重新登录 ${client.email}`, { exact: false }),
    ).toBeVisible();

    // 登录错误账号时必须留在原流程中，不能覆盖原来等待重新登录的客户账号。
    await submitLogin(page, wrongAccount.email, wrongAccount.password);
    await expect(page).toHaveURL(/\/login(?:[?#].*)?$/);
    await expect(
      page.getByText(`请使用 ${client.email} 登录`, { exact: false }),
    ).toBeVisible();
    expect(await readPendingLoginSummary(page)).toMatchObject({
      kind: "reauthenticate",
      targetEmail: client.email,
    });
    expect(await readStoredAccountSummary(page)).toMatchObject({
      email: client.email,
      hasSession: false,
      state: "reauthentication-required",
    });

    await submitLogin(page, client.email, client.password);
    await expect(page).toHaveURL(/\/client\/home(?:[?#].*)?$/, {
      timeout: 30_000,
    });
    await openMyPage(page, "/client/my");
    await expect(page.getByText(administrator.email, { exact: true })).toBeVisible();
  });

  test("removes invalid session tokens and offers sign-in again", async ({
    page,
  }) => {
    const client = getRegressionAccount("client");

    await addClientAndSwitchBackToAdministrator(page);
    await replaceStoredSessionWithInvalidTokens(page);
    await page.reload();
    await page.getByRole("button", { name: /^切换$/ }).click();

    await expect(
      page.getByText("这个常用账号需要重新登录后才能继续切换。", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /^重新登录$/ })).toBeVisible();
    expect(await readStoredAccountSummary(page)).toMatchObject({
      email: client.email,
      hasSession: false,
      reauthenticationReason: "session-invalid",
      state: "reauthentication-required",
    });
  });

  test("removing an alternate account clears it for new pages", async ({
    context,
    page,
  }) => {
    const client = getRegressionAccount("client");

    await addClientAndSwitchBackToAdministrator(page);
    await page.getByRole("button", { name: "移除" }).click();

    const confirmDialog = page.getByRole("dialog");
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole("button", { name: "移除", exact: true }).click();
    await expect(page.getByText("常用账号已移除。", { exact: true })).toBeVisible();
    expect(await readStoredAccountSummary(page)).toBeNull();

    const newPage = await context.newPage();
    await openMyPage(newPage, "/admin/my");
    await expect(newPage.getByRole("button", { name: /添加账户/ })).toBeVisible();
    await expect(newPage.getByText(client.email, { exact: true })).toHaveCount(0);
  });

  test("normal sign-out preserves the saved account until it is explicitly cleared", async ({
    context,
    page,
  }) => {
    const client = getRegressionAccount("client");

    await addClientAndSwitchBackToAdministrator(page);
    await page.getByTestId("workspace-account-menu-trigger").click();
    await page
      .getByTestId("workspace-account-menu")
      .getByRole("button", { name: "退出登录" })
      .click();
    await expect(page).toHaveURL(/\/login(?:[?#].*)?$/, { timeout: 30_000 });
    expect(await readStoredAccountSummary(page)).toMatchObject({
      email: client.email,
      state: "ready",
    });

    await loginWithAccount(page, client);
    await openMyPage(page, "/client/my");
    await page.getByRole("button", { name: "清除常用账号" }).click();

    const confirmDialog = page.getByRole("dialog");
    await expect(confirmDialog).toBeVisible();
    await confirmDialog
      .getByRole("button", { name: "清除常用账号", exact: true })
      .click();
    await expect(
      page.getByText("这台浏览器保存的常用账号已清除。", { exact: true }),
    ).toBeVisible();
    expect(await readStoredAccountSummary(page)).toBeNull();

    const newPage = await context.newPage();
    await openMyPage(newPage, "/client/my");
    await expect(newPage.getByRole("button", { name: /添加账户/ })).toBeVisible();
  });

  test("keeps the account row readable at desktop and mobile widths", async ({
    page,
  }, testInfo) => {
    await addClientAndSwitchBackToAdministrator(page);

    await page.setViewportSize({ height: 900, width: 1440 });
    await page.reload();
    await expectAccountSwitcherLayoutToFit(page, false);
    await testInfo.attach("account-switcher-desktop", {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });

    await page.setViewportSize({ height: 844, width: 390 });
    await page.reload();
    await expectAccountSwitcherLayoutToFit(page, true);
    await testInfo.attach("account-switcher-mobile-portrait", {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });

    await page.setViewportSize({ height: 390, width: 844 });
    await page.reload();
    await expectAccountSwitcherLayoutToFit(page, false);
    await testInfo.attach("account-switcher-mobile-landscape", {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
  });
});
