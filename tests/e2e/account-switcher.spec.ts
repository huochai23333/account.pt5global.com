import { expect, test, type Page } from "@playwright/test";

import { getRegressionAccount } from "./helpers/accounts";
import { loginAs, loginWithAccount, setTestLocale } from "./helpers/auth";
import { getLocalSupabaseAdminClient } from "./helpers/local-supabase-admin";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const STORED_ACCOUNT_KEY =
  "pt5-dropshipping.account-switcher.v2.alternate";
const PENDING_LOGIN_KEY =
  "pt5-dropshipping.account-switcher.v2.pending";

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
    const firstPage = await firstContext.newPage();

    const { client } = await addClientAndSwitchBackToAdministrator(firstPage);

    const savedBeforeRestart = await readStoredAccountSummary(firstPage);
    expect(savedBeforeRestart).toMatchObject({
      email: client.email,
      hasSession: true,
      state: "ready",
    });
    expect(savedBeforeRestart?.remainingDays).toBeGreaterThanOrEqual(29);
    expect(await readPendingLoginSummary(firstPage)).toBeNull();

    // storageState 会同时保存登录 Cookie 和 localStorage，等价于浏览器关闭后再次打开。
    const browserState = await firstContext.storageState();
    await firstContext.close();

    const reopenedContext = await browser.newContext({
      baseURL: BASE_URL,
      storageState: browserState,
    });
    const reopenedPage = await reopenedContext.newPage();

    try {
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

async function addClientAndSwitchBackToAdministrator(page: Page) {
  const administrator = await loginAs(page, "administrator");
  const client = getRegressionAccount("client");

  await openMyPage(page, "/admin/my");
  await page.getByRole("button", { name: /添加账户/ }).click();
  await expect(page).toHaveURL(/\/login(?:[?#].*)?$/, { timeout: 30_000 });
  await expect(page.getByText(/请登录另一个账号/)).toBeVisible();

  expect(await readStoredAccountSummary(page)).toBeNull();
  expect(await readPendingLoginSummary(page)).toMatchObject({
    currentEmail: administrator.email,
    kind: "add",
  });

  await loginWithAccount(page, client);
  await openMyPage(page, "/client/my");
  await expect(page.getByText(administrator.email, { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /^切换$/ }).click();
  await expect(page).toHaveURL(/\/admin\/home(?:[?#].*)?$/, {
    timeout: 30_000,
  });
  await openMyPage(page, "/admin/my");
  await expect(page.getByText(client.email, { exact: true })).toBeVisible();

  return { administrator, client };
}

async function openMyPage(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator("#common-account")).toBeVisible();
}

async function submitLogin(page: Page, email: string, password: string) {
  await setTestLocale(page, "zh");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('form button[type="submit"]').click();
}

async function expireStoredAccount(page: Page) {
  await page.evaluate((storageKey) => {
    const rawAccount = window.localStorage.getItem(storageKey);

    if (!rawAccount) {
      throw new Error("Expected a stored alternate account before expiring it.");
    }

    const account = JSON.parse(rawAccount) as Record<string, unknown>;
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ ...account, expiresAt: Date.now() - 1 }),
    );
  }, STORED_ACCOUNT_KEY);
}

async function replaceStoredSessionWithInvalidTokens(page: Page) {
  await page.evaluate((storageKey) => {
    const rawAccount = window.localStorage.getItem(storageKey);

    if (!rawAccount) {
      throw new Error("Expected a stored alternate account before invalidating it.");
    }

    const account = JSON.parse(rawAccount) as Record<string, unknown>;
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        ...account,
        session: {
          accessToken: "invalid-access-token",
          refreshToken: "invalid-refresh-token",
        },
      }),
    );
  }, STORED_ACCOUNT_KEY);
}

async function expectAccountSwitcherLayoutToFit(
  page: Page,
  requireMobileTouchTargets: boolean,
) {
  const commonAccountSection = page.locator("#common-account");
  const switchButton = commonAccountSection.getByRole("button", {
    name: /^切换$/,
  });
  const removeButton = commonAccountSection.getByRole("button", { name: "移除" });

  await expect(commonAccountSection).toBeVisible();
  await expect(switchButton).toBeVisible();
  await expect(removeButton).toBeVisible();

  const layout = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);

  const sectionBox = await commonAccountSection.boundingBox();
  const switchBox = await switchButton.boundingBox();
  const removeBox = await removeButton.boundingBox();

  expect(sectionBox).not.toBeNull();
  expect(switchBox).not.toBeNull();
  expect(removeBox).not.toBeNull();

  if (!sectionBox || !switchBox || !removeBox) {
    return;
  }

  for (const actionBox of [switchBox, removeBox]) {
    expect(actionBox.x).toBeGreaterThanOrEqual(sectionBox.x);
    expect(actionBox.x + actionBox.width).toBeLessThanOrEqual(
      sectionBox.x + sectionBox.width + 1,
    );
  }

  if (requireMobileTouchTargets) {
    expect(switchBox.height).toBeGreaterThanOrEqual(44);
    expect(removeBox.height).toBeGreaterThanOrEqual(44);
    expect(removeBox.width).toBeGreaterThanOrEqual(44);
  }
}

async function readStoredAccountSummary(page: Page) {
  return page.evaluate((storageKey) => {
    const rawAccount = window.localStorage.getItem(storageKey);

    if (!rawAccount) {
      return null;
    }

    const account = JSON.parse(rawAccount) as Record<string, unknown>;
    const expiresAt =
      typeof account.expiresAt === "number" ? account.expiresAt : null;

    return {
      email: typeof account.email === "string" ? account.email : null,
      hasSession: Object.hasOwn(account, "session"),
      reauthenticationReason:
        typeof account.reauthenticationReason === "string"
          ? account.reauthenticationReason
          : null,
      remainingDays:
        expiresAt === null
          ? null
          : Math.floor((expiresAt - Date.now()) / (24 * 60 * 60 * 1000)),
      state: typeof account.state === "string" ? account.state : null,
    };
  }, STORED_ACCOUNT_KEY);
}

async function readPendingLoginSummary(page: Page) {
  return page.evaluate((storageKey) => {
    const rawPending = window.sessionStorage.getItem(storageKey);

    if (!rawPending) {
      return null;
    }

    const pending = JSON.parse(rawPending) as {
      currentAccount?: { email?: unknown };
      kind?: unknown;
      targetAccount?: { email?: unknown };
    };

    return {
      currentEmail:
        typeof pending.currentAccount?.email === "string"
          ? pending.currentAccount.email
          : null,
      kind: typeof pending.kind === "string" ? pending.kind : null,
      targetEmail:
        typeof pending.targetAccount?.email === "string"
          ? pending.targetAccount.email
          : null,
    };
  }, PENDING_LOGIN_KEY);
}
