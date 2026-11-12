import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { loginAs, type RegressionRole } from "./auth";
import {
  publishMultipart,
  requireLocalAdminClient,
  countTemplates,
} from "./company-template-actions";

/** 按原入口注册岗位访问场景；原账号/认证保持，实际页面执行仍需原准入。 */
export function registerCompanyTemplateAccessCases(
  INTERNAL_ROLES: RegressionRole[],
  SIMPLE_HTML: (heading: string) => string,
) {
  test("没有业务工作区的岗位在手机服务说明页不显示模板入口", async ({
    page,
  }) => {
    await loginAs(page, "manager");
    await page.goto("/business-unavailable");
    const templateLink = page.locator('a[href="/manager/company-templates"]');
    await expect(templateLink).toHaveCount(1);
    await expect(templateLink).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("link", { name: "公司模板" })).toHaveCount(0);
  });

  for (const role of INTERNAL_ROLES) {
    test(`${role} 可以从工作栏进入当前模板`, async ({ page }) => {
      const account = await loginAs(page, role);
      await page.goto(`${account.workspacePath}/company-templates`);
      await dismissAnnouncement(page);

      await expect(
        page.getByRole("heading", { name: "公司模板" }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "PT5 DS 报价单（多目的国版）" }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "公司模板" }).first(),
      ).toBeVisible();
      await expect(page.getByRole("button", { name: "新建模板" })).toHaveCount(
        role === "administrator" ? 1 : 0,
      );
    });
  }

  test("客户不能访问公司模板或发布接口", async ({ page }) => {
    await loginAs(page, "client");
    const pageResponse = await page.goto("/client/company-templates");
    expect(pageResponse?.status()).toBe(404);
    await expect(page.getByText("PT5 DS 报价单（多目的国版）")).toHaveCount(0);

    const templateId = randomUUID();
    const response = await page.request.post("/api/company-templates/publish", {
      multipart: publishMultipart({
        html: SIMPLE_HTML("client denied"),
        slug: `client-denied-${Date.now()}`,
        templateId,
        versionId: randomUUID(),
      }),
    });
    expect(response.status()).toBe(403);
    expect(await response.json()).toMatchObject({
      error: "company_template_forbidden",
      ok: false,
    });
    const admin = requireLocalAdminClient();
    expect(await countTemplates(admin, templateId)).toBe(0);
  });
}

async function dismissAnnouncement(page: Page) {
  const button = page.getByRole("button", { name: "我知道了" });
  if (await button.isVisible().catch(() => false)) await button.click();
}
