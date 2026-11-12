import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readDisposablePostgresTarget } from "../test-support/disposable-fixture";
import { cleanupFixtureResources } from "../test-support/fixture-cleanup-sequence";

import { loginAs } from "./helpers/auth";
import { getLocalSupabaseAdminClient } from "./helpers/local-supabase-admin";

type ProfileReceipt = {
  city: string | null;
  email: string | null;
  name: string | null;
  user_id: string;
};

test.describe("个人资料最终业务凭证", () => {
  test.beforeEach(({ baseURL }) => {
    // 本用例写固定管理员资料；显式声明和实际专属API/DB/暂停状态都通过后，才接触账号。
    readDisposablePostgresTarget({ baseURL, supabaseURL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      mode: process.env.PT5_E2E_FIXTURE_MODE, project: process.env.PT5_E2E_DATABASE_PROJECT,
      container: process.env.PT5_E2E_DATABASE_CONTAINER }, args =>
      execFileSync("docker", args, { encoding: "utf8", timeout: 12000, windowsHide: true }).trim());
  });

  test("0 行更新拒绝成功，写入后刷新失败显示确认中状态", async ({ page }) => {
    test.setTimeout(120_000);
    const admin = requireLocalAdminClient();
    const account = await loginAs(page, "administrator");
    const original = await readProfileByEmail(admin, account.email);
    const runKey = randomUUID();
    const savedName = `回执管理员${runKey}`;
    const savedCity = `上海${runKey.slice(-3)}`;

    let primaryError: unknown;
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
    } catch (error) {
      primaryError = error;
    } finally {
      const cleanupErrors: unknown[] = [];
      try {
        // 先关闭本次页面，避免继续发送交互请求；关闭失败仍尝试独立恢复，两个原因均保留。
        await cleanupFixtureResources(
          () => page.close(),
          () => restoreProfile(admin, original, { name: savedName, city: savedCity }),
        );
      } catch (error) {
        cleanupErrors.push(...(error instanceof AggregateError ? error.errors : [error]));
      }
      if (primaryError || cleanupErrors.length) {
        throw new AggregateError([...(primaryError ? [primaryError] : []), ...cleanupErrors], "个人资料回执测试未完成");
      }
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

async function readProfileById(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin.from("user_profiles")
    .select("user_id,name,city,email").eq("user_id", userId).single<ProfileReceipt>();
  if (error || !data || data.user_id !== userId) throw error ?? new Error("profile_test_readback_missing");
  return data;
}

async function restoreProfile(admin: SupabaseClient, profile: ProfileReceipt, expected: { name: string; city: string }) {
  const current = await readProfileById(admin, profile.user_id);
  // 测试尚未写入或已经恢复时保持原行不动；别人的新值不属于本次夹具，拒绝覆盖。
  if (current.name === profile.name && current.city === profile.city) return;
  if (current.name !== expected.name || current.city !== expected.city) throw new Error("profile_test_ownership_changed");
  const { data, error, count } = await admin
    .from("user_profiles")
    .update({ city: profile.city, name: profile.name }, { count: "exact" })
    .eq("user_id", profile.user_id)
    // 将归属比较放进同一次UPDATE，防止独立读取后、实际恢复前被另一处修改。
    .eq("name", expected.name).eq("city", expected.city)
    .select("user_id")
    .single<{ user_id: string }>();
  if (error || count !== 1 || !data || data.user_id !== profile.user_id) {
    throw error ?? new Error("profile_test_cleanup_failed");
  }
  const restored = await readProfileById(admin, profile.user_id);
  if (restored.name !== profile.name || restored.city !== profile.city) throw new Error("profile_test_cleanup_unconfirmed");
}

async function expectNoDocumentHorizontalOverflow(page: Page) {
  const widths = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(widths.scrollWidth).toBeLessThanOrEqual(widths.clientWidth + 1);
}
