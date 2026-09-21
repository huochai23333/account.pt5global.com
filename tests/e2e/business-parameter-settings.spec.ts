import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { expectForbiddenPage, loginAs } from "./helpers/auth";
import { getLocalSupabaseAdminClient } from "./helpers/local-supabase-admin";

const AMOUNT_CODE = "wholesale_referral_order_amount_rate";
const SALESMAN_CODE = "wholesale_order_salesman_tier";

test.describe("批发业务参数中心", () => {
  test("管理员立即发布并按版本凭证回读，刷新和移动端仍一致", async ({
    page,
  }) => {
    const admin = requireLocalAdminClient();
    await resetParameter(admin, AMOUNT_CODE);
    const account = await loginAs(page, "administrator");

    try {
      await page.goto(`${account.workspacePath}/wholesale/settings`);
      const row = parameterRow(page, AMOUNT_CODE);
      await expect(row).toContainText("第 1 版");
      await row.getByRole("button", { name: "修改" }).click();
      const dialog = page.getByRole("dialog", {
        name: /修改批发推荐月订单金额佣金/,
      });
      await dialog.getByTestId("business-parameter-input-rate").fill("2.5");
      await dialog
        .getByTestId("business-parameter-change-reason")
        .fill("页面立即发布回归");
      await dialog.getByTestId("business-parameter-review-publish").click();
      await page
        .getByRole("dialog", { name: "确认发布这次修改？" })
        .getByRole("button", { name: "确认发布" })
        .click();
      await expect(page.getByText(/已发布第 2 版/)).toBeVisible();

      const version = await readLatestVersion(admin, AMOUNT_CODE);
      expect(version).toMatchObject({ version_number: 2 });
      expect(Number((version.config as { rate: number }).rate)).toBe(0.025);
      console.log(
        "[参数中心凭证]",
        JSON.stringify({
          parameterCode: AMOUNT_CODE,
          refreshedValue: "2.5%",
          versionId: version.id,
          versionNumber: version.version_number,
        }),
      );
      await expect(
        page.getByText(new RegExp(`版本凭证：${version.id}`)),
      ).toBeVisible();

      await page.reload();
      await expect(parameterRow(page, AMOUNT_CODE)).toContainText("2.5%");
      await expect(parameterRow(page, AMOUNT_CODE)).toContainText("第 2 版");

      await parameterRow(page, AMOUNT_CODE)
        .getByRole("button", { name: "查看记录" })
        .click();
      await expect(
        page.getByRole("dialog", { name: /修改记录/ }),
      ).toContainText("页面立即发布回归");
      await page
        .getByRole("dialog", { name: /修改记录/ })
        .getByRole("button", { exact: true, name: "关闭" })
        .click();

      await page.setViewportSize({ height: 844, width: 390 });
      await expect(parameterCard(page, AMOUNT_CODE)).toContainText("2.5%");
      await expectNoPageOverflow(page);
    } finally {
      await resetParameter(admin, AMOUNT_CODE);
    }
  });

  test("管理员预约、取消预约并把旧值恢复成新版本", async ({ page }) => {
    const admin = requireLocalAdminClient();
    await resetParameter(admin, SALESMAN_CODE);
    const account = await loginAs(page, "administrator");

    try {
      await page.goto(`${account.workspacePath}/wholesale/settings`);
      const row = parameterRow(page, SALESMAN_CODE);
      await row.getByRole("button", { name: "修改" }).click();
      let dialog = page.getByRole("dialog", { name: /修改批发订单业务员佣金/ });
      await dialog.getByLabel("预约以后使用").check();
      await dialog
        .getByTestId("business-parameter-effective-time")
        .fill(nextShanghaiDayLocal());
      await dialog
        .getByTestId("business-parameter-input-tier_1_rate")
        .fill("15");
      await dialog
        .getByTestId("business-parameter-change-reason")
        .fill("页面预约回归");
      await dialog.getByTestId("business-parameter-review-publish").click();
      await page
        .getByRole("dialog", { name: "确认发布这次修改？" })
        .getByRole("button", { name: "确认发布" })
        .click();
      await expect(page.getByText(/已发布第 2 版/)).toBeVisible();

      let latest = await readLatestVersion(admin, SALESMAN_CODE);
      expect(latest.version_number).toBe(2);
      expect(new Date(latest.effective_from).getTime()).toBeGreaterThan(
        Date.now(),
      );
      await expect(parameterRow(page, SALESMAN_CODE)).toContainText(
        "页面预约回归",
      );

      await parameterRow(page, SALESMAN_CODE)
        .getByRole("button", { name: "取消预约" })
        .click();
      await page
        .getByRole("dialog", { name: "取消这条预约？" })
        .getByRole("button", { name: "确认取消" })
        .click();
      await expect(
        page.getByText("预约已取消，并完成最终核对。"),
      ).toBeVisible();
      latest = await readVersion(admin, latest.id);
      expect(latest.cancelled_at).not.toBeNull();
      await expect(parameterRow(page, SALESMAN_CODE)).toContainText(
        "暂时没有预约",
      );

      await parameterRow(page, SALESMAN_CODE)
        .getByRole("button", { name: "查看记录" })
        .click();
      const history = page.getByRole("dialog", { name: /修改记录/ });
      await history
        .locator(`[data-testid^="business-parameter-history-"]`)
        .filter({ hasText: "第 2 版" })
        .getByRole("button", { name: "恢复此版本" })
        .click();
      dialog = page.getByRole("dialog", { name: /修改批发订单业务员佣金/ });
      await expect(
        dialog.getByTestId("business-parameter-change-reason"),
      ).toHaveValue("恢复第 2 版的数值");
      await dialog.getByTestId("business-parameter-review-publish").click();
      await page
        .getByRole("dialog", { name: "确认发布这次修改？" })
        .getByRole("button", { name: "确认发布" })
        .click();
      await expect(page.getByText(/已发布第 4 版/)).toBeVisible();
      const restored = await readLatestVersion(admin, SALESMAN_CODE);
      expect(restored.version_number).toBe(4);
      expect(restored.config).toMatchObject({
        tier_1_limit_rmb: 10000,
        tier_1_rate: 0.15,
        tier_2_rate: 0.12,
      });
      console.log(
        "[参数中心预约凭证]",
        JSON.stringify({
          cancelledVersionId: latest.id,
          restoredVersionId: restored.id,
          restoredVersionNumber: restored.version_number,
        }),
      );
    } finally {
      await resetParameter(admin, SALESMAN_CODE);
    }
  });

  test("接口即使返回 200，最终回读没有版本也不能显示成功", async ({ page }) => {
    const admin = requireLocalAdminClient();
    await resetParameter(admin, AMOUNT_CODE);
    const account = await loginAs(page, "administrator");
    await page.goto(`${account.workspacePath}/wholesale/settings`);
    const before = await countVersions(admin, AMOUNT_CODE);
    const fakeId = "ba300000-0000-4000-8000-000000000001";

    await page.route(
      "**/rest/v1/rpc/publish_business_parameter_version",
      (route) => {
        const body = route.request().postDataJSON() as Record<string, unknown>;
        void route.fulfill({
          body: JSON.stringify({
            change_reason: body.p_change_reason,
            config: body.p_config,
            current_revision: 2,
            effective_from: new Date().toISOString(),
            parameter_code: body.p_parameter_code,
            published_at: new Date().toISOString(),
            published_by: "11111111-1111-4111-8111-111111111111",
            version_id: fakeId,
            version_number: 2,
          }),
          contentType: "application/json",
          status: 200,
        });
      },
    );

    await parameterRow(page, AMOUNT_CODE)
      .getByRole("button", { name: "修改" })
      .click();
    const dialog = page.getByRole("dialog", {
      name: /修改批发推荐月订单金额佣金/,
    });
    await dialog.getByTestId("business-parameter-input-rate").fill("2.7");
    await dialog
      .getByTestId("business-parameter-change-reason")
      .fill("伪造成功响应测试");
    await dialog.getByTestId("business-parameter-review-publish").click();
    await page
      .getByRole("dialog", { name: "确认发布这次修改？" })
      .getByRole("button", { name: "确认发布" })
      .click();

    await expect(page.getByText(/最终核对没有通过/)).toBeVisible();
    await expect(page.getByText(/已发布第 2 版/)).toHaveCount(0);
    expect(await countVersions(admin, AMOUNT_CODE)).toBe(before);
    await page.unroute("**/rest/v1/rpc/publish_business_parameter_version");
  });

  test("提交已经落库但连接中断时，重试只生成同一个版本", async ({ page }) => {
    const admin = requireLocalAdminClient();
    await resetParameter(admin, AMOUNT_CODE);
    const account = await loginAs(page, "administrator");

    try {
      await page.goto(`${account.workspacePath}/wholesale/settings`);
      let interrupted = false;
      await page.route(
        "**/rest/v1/rpc/publish_business_parameter_version",
        async (route) => {
          if (interrupted) {
            await route.continue();
            return;
          }
          interrupted = true;
          // 先让数据库完整提交，再切断浏览器收到响应的连接，模拟提交后断线。
          const response = await route.fetch();
          expect(response.ok()).toBe(true);
          await route.abort("timedout");
        },
      );

      await parameterRow(page, AMOUNT_CODE)
        .getByRole("button", { name: "修改" })
        .click();
      const dialog = page.getByRole("dialog", {
        name: /修改批发推荐月订单金额佣金/,
      });
      await dialog.getByTestId("business-parameter-input-rate").fill("2.8");
      await dialog
        .getByTestId("business-parameter-change-reason")
        .fill("提交后断线幂等回归");
      await dialog.getByTestId("business-parameter-review-publish").click();
      await page
        .getByRole("dialog", { name: "确认发布这次修改？" })
        .getByRole("button", { name: "确认发布" })
        .click();

      await expect(page.getByText("这次修改没有完成，请稍后再试。")).toBeVisible();
      await expect.poll(() => countVersions(admin, AMOUNT_CODE)).toBe(2);
      const committed = await readLatestVersion(admin, AMOUNT_CODE);

      await page.unroute("**/rest/v1/rpc/publish_business_parameter_version");
      await dialog.getByTestId("business-parameter-review-publish").click();
      await page
        .getByRole("dialog", { name: "确认发布这次修改？" })
        .getByRole("button", { name: "确认发布" })
        .click();
      await expect(page.getByText(/已发布第 2 版/)).toBeVisible();

      const retried = await readLatestVersion(admin, AMOUNT_CODE);
      expect(retried.id).toBe(committed.id);
      expect(await countVersions(admin, AMOUNT_CODE)).toBe(2);
    } finally {
      await page.unroute("**/rest/v1/rpc/publish_business_parameter_version");
      await resetParameter(admin, AMOUNT_CODE);
    }
  });

  for (const role of ["finance", "salesman"] as const) {
    test(`${role} 不能进入参数中心`, async ({ page }) => {
      await loginAs(page, role);
      const response = await page.goto(`/${role}/wholesale/settings`);
      expect(response?.status()).toBe(200);
      await expectForbiddenPage(page);
      await expect(page.getByRole("button", { name: "修改" })).toHaveCount(0);
    });
  }

  test("故意使用错误费率时，最终数据断言能够识别篡改", async () => {
    const admin = requireLocalAdminClient();
    const baseline = await readLatestVersion(admin, AMOUNT_CODE);
    let detected = false;
    try {
      expect(Number((baseline.config as { rate: number }).rate)).toBe(0.99);
    } catch {
      detected = true;
    }
    expect(detected).toBe(true);
  });
});

function parameterRow(page: Page, code: string) {
  return page.getByTestId(`business-parameter-row-${code}`);
}

function parameterCard(page: Page, code: string) {
  return page.getByTestId(`business-parameter-card-${code}`);
}

function requireLocalAdminClient() {
  const admin = getLocalSupabaseAdminClient();
  test.skip(!admin, "必须连接本地 Docker Supabase 才能核对参数版本凭证。");
  if (!admin) throw new Error("local_supabase_admin_required");
  return admin;
}

async function readLatestVersion(admin: SupabaseClient, code: string) {
  const { data, error } = await admin
    .from("business_parameter_versions")
    .select("id,version_number,config,effective_from,cancelled_at")
    .eq("parameter_code", code)
    .order("version_number", { ascending: false })
    .limit(1)
    .single();
  if (error) throw error;
  return data as {
    cancelled_at: string | null;
    config: Record<string, number>;
    effective_from: string;
    id: string;
    version_number: number;
  };
}

async function readVersion(admin: SupabaseClient, id: string) {
  const { data, error } = await admin
    .from("business_parameter_versions")
    .select("id,version_number,config,effective_from,cancelled_at")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as Awaited<ReturnType<typeof readLatestVersion>>;
}

async function countVersions(admin: SupabaseClient, code: string) {
  const { count, error } = await admin
    .from("business_parameter_versions")
    .select("id", { count: "exact", head: true })
    .eq("parameter_code", code);
  if (error) throw error;
  return count ?? 0;
}

async function resetParameter(admin: SupabaseClient, code: string) {
  const { data: disposable, error: readError } = await admin
    .from("business_parameter_versions")
    .select("id")
    .eq("parameter_code", code)
    .gt("version_number", 1);
  if (readError) throw readError;
  const ids = (disposable ?? []).map((row) => row.id);
  if (ids.length > 0) {
    const { error } = await admin
      .from("business_parameter_versions")
      .delete()
      .in("id", ids);
    if (error) throw error;
  }
  const { error } = await admin
    .from("business_parameter_definitions")
    .update({ current_revision: 1 })
    .eq("parameter_code", code);
  if (error) throw error;
  if ((await countVersions(admin, code)) !== 1)
    throw new Error("parameter_test_cleanup_failed");
}

function nextShanghaiDayLocal() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Shanghai",
    year: "numeric",
  }).formatToParts(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}`;
}

async function expectNoPageOverflow(page: Page) {
  const layout = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    verticalText: Array.from(
      document.querySelectorAll<HTMLElement>("body *"),
    ).some((element) => {
      const style = getComputedStyle(element);
      return (
        style.writingMode !== "horizontal-tb" && element.offsetParent !== null
      );
    }),
  }));
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
  expect(layout.verticalText).toBe(false);
}
