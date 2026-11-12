import { expect, type Page } from "@playwright/test";
import { getRegressionAccount } from "./accounts";
import { loginAs, loginWithAccount, setTestLocale } from "./auth";
import { readPendingLoginSummary, readStoredAccountSummary } from "./account-switcher-storage";

// 页面步骤沿用原认证入口，布局核对独立验证边界与触控尺寸。
export async function addClientAndSwitchBackToAdministrator(page: Page) {
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

export async function openMyPage(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator("#common-account")).toBeVisible();
}

export async function submitLogin(page: Page, email: string, password: string) {
  await setTestLocale(page, "zh");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('form button[type="submit"]').click();
}

export async function expectAccountSwitcherLayoutToFit(
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
