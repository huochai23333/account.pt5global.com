import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { loginAs } from "./helpers/auth";
import { getLocalSupabaseAdminClient } from "./helpers/local-supabase-admin";

type ProfileReceipt = {
  city: string | null;
  email: string | null;
  name: string | null;
  user_id: string;
};

test.describe("个人资料最终业务凭证", () => {
  test("0 行更新拒绝成功，写入后刷新失败显示确认中状态", async ({ page }) => {
    test.setTimeout(120_000);
    const admin = requireLocalAdminClient();
    const account = await loginAs(page, "administrator");
    const original = await readProfileByEmail(admin, account.email);
    const runKey = Date.now().toString().slice(-7);
    const savedName = `回执管理员${runKey}`;
    const savedCity = `上海${runKey.slice(-3)}`;

    try {
      await page.setViewportSize({ height: 900, width: 1440 });
      await page.goto(`${account.workspacePath}/my`);
      await page.getByRole("button", { name: "编辑个人资料" }).click();
      const dialog = page.getByRole("dialog", { name: "编辑个人资料" });

      // 故意模拟 HTTP 200 但 PostgREST 返回空记录；页面必须拒绝绿色成功，
      // 并且独立数据库连接仍应读到原资料。
      await page.route("**/rest/v1/user_profiles*", async (route) => {
        if (route.request().method() !== "PATCH") {
          await route.continue();
          return;
        }
        await route.fulfill({ body: "null", contentType: "application/json", status: 200 });
      });
      await dialog.getByLabel("显示姓名").fill(`${savedName}-空回执`);
      await dialog.getByLabel("所在城市").fill(`${savedCity}-空回执`);
      await dialog.getByRole("button", { name: "保存资料" }).click();
      await expect(
        dialog.locator('[data-slot="feedback-notice"][data-tone="error"]'),
      ).toBeVisible();
      await expect(
        dialog.locator('[data-slot="feedback-notice"][data-tone="success"]'),
      ).toHaveCount(0);
      expect(await readProfileByEmail(admin, account.email)).toMatchObject(original);
      await page.unroute("**/rest/v1/user_profiles*");

      let blockRefreshReads = false;
      await page.route("**/rest/v1/user_profiles*", async (route) => {
        if (route.request().method() === "PATCH") {
          const response = await route.fetch();
          blockRefreshReads = true;
          await route.fulfill({ response });
          return;
        }
        if (route.request().method() === "GET" && blockRefreshReads) {
          await route.fulfill({
            body: JSON.stringify({ message: "injected_refresh_failure" }),
            contentType: "application/json",
            status: 503,
          });
          return;
        }
        await route.continue();
      });
      await dialog.getByLabel("显示姓名").fill(savedName);
      await dialog.getByLabel("所在城市").fill(savedCity);
      await dialog.getByRole("button", { name: "保存资料" }).click();
      await expect(
        dialog.getByText("个人资料已保存，页面内容正在刷新，请稍后核对。"),
      ).toBeVisible();
      await expect(
        dialog.locator('[data-slot="feedback-notice"][data-tone="success"]'),
      ).toHaveCount(0);

      // 刷新请求失败不影响已经提交的数据库事务；用另一条连接核对真实字段。
      expect(await readProfileByEmail(admin, account.email)).toMatchObject({
        city: savedCity,
        name: savedName,
        user_id: original.user_id,
      });

      await page.unroute("**/rest/v1/user_profiles*");
      await page.reload();
      await page.getByRole("button", { name: "编辑个人资料" }).click();
      const refreshedDialog = page.getByRole("dialog", { name: "编辑个人资料" });
      await expect(refreshedDialog.getByLabel("显示姓名")).toHaveValue(savedName);
      await expect(refreshedDialog.getByLabel("所在城市")).toHaveValue(savedCity);

      await page.setViewportSize({ height: 844, width: 390 });
      await expectNoDocumentHorizontalOverflow(page);
    } finally {
      await restoreProfile(admin, original);
    }
  });
});

function requireLocalAdminClient() {
  const admin = getLocalSupabaseAdminClient();
  test.skip(!admin, "必须连接本地 Docker Supabase 才能核对最终业务凭证。");
  if (!admin) throw new Error("local_supabase_admin_required");
  return admin;
}

async function readProfileByEmail(admin: SupabaseClient, email: string) {
  const { data, error } = await admin
    .from("user_profiles")
    .select("user_id,name,city,email")
    .eq("email", email)
    .single<ProfileReceipt>();
  if (error) throw error;
  return data;
}

async function restoreProfile(admin: SupabaseClient, profile: ProfileReceipt) {
  const { data, error } = await admin
    .from("user_profiles")
    .update({ city: profile.city, name: profile.name })
    .eq("user_id", profile.user_id)
    .select("user_id")
    .single<{ user_id: string }>();
  if (error || data.user_id !== profile.user_id) {
    throw error ?? new Error("profile_test_cleanup_failed");
  }
}

async function expectNoDocumentHorizontalOverflow(page: Page) {
  const widths = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(widths.scrollWidth).toBeLessThanOrEqual(widths.clientWidth + 1);
}
