import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { loginAs } from "./auth";
import {
  fillPublishDialog,
  htmlFile,
  publishMultipart,
  requireLocalAdminClient,
  readTemplateBySlug,
  readVersion,
  countVersions,
  sha256,
  expectNoPageOverflow,
} from "./company-template-actions";
import { deleteTemplateFixture } from "./company-template-records";
import { finalizeCompanyTemplateCase } from "./company-template-case-lifecycle";

/** 按原入口注册发布与重试场景；原账号/认证保持，实际页面执行仍需原准入。 */
export function registerCompanyTemplatePublicationCases(
  scenario: "lifecycle" | "retry",
  SIMPLE_HTML: (heading: string) => string,
) {
  if (scenario === "lifecycle") {
    test("管理员从页面完成新建、更新、指南、回退和停用，并核对数据库最终记录", async ({
      page,
    }, testInfo) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: 1440, height: 900 });
      const browserErrors: string[] = [];
      page.on("pageerror", (error) => browserErrors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") browserErrors.push(message.text());
      });
      const admin = requireLocalAdminClient();
      const account = await loginAs(page, "administrator");
      const marker = randomUUID();
      const name = `回归模板 ${marker}`;
      const slug = `company-template-${marker}`;
      const htmlV1 = SIMPLE_HTML(`Template v1 ${marker}`);
      const htmlV2 = SIMPLE_HTML(`Template v2 ${marker}`);
      const guide = SIMPLE_HTML(`Guide ${marker}`);
      let templateId: string | null = null;
      let bodyFailure: { error: unknown } | undefined;

      try {
        await page.goto(`${account.workspacePath}/company-templates`);
        await page.getByRole("button", { name: "新建模板" }).click();
        const createDialog = page.getByRole("dialog", { name: "新建公司模板" });
        await fillPublishDialog(createDialog, {
          guide,
          html: htmlV1,
          name,
          slug,
        });
        await createDialog.getByRole("button", { name: "上传并启用" }).click();
        await expect(page.getByText("模板已创建并启用。")).toBeVisible();

        const created = await readTemplateBySlug(admin, slug);
        templateId = created.id;
        expect(created).toMatchObject({ revision: 1, status: "active" });
        expect(created.current_version_id).toBeTruthy();
        const version1 = await readVersion(admin, created.current_version_id);
        expect(version1).toMatchObject({
          guide_sha256: sha256(guide),
          html_sha256: sha256(htmlV1),
          version_number: 1,
        });

        const article = page.locator("article").filter({ hasText: name });
        await article.getByRole("link", { name: "预览模板" }).click();
        await expect(
          page
            .frameLocator("iframe")
            .getByRole("heading", { name: `Template v1 ${marker}` }),
        ).toBeVisible();
        await page.getByRole("link", { name: "使用指南" }).click();
        await expect(
          page
            .frameLocator("iframe")
            .getByRole("heading", { name: `Guide ${marker}` }),
        ).toBeVisible();

        await page.goto(`${account.workspacePath}/company-templates`);
        const refreshedArticle = page
          .locator("article")
          .filter({ hasText: name });
        await refreshedArticle
          .getByRole("button", { name: "上传新版本" })
          .click();
        const updateDialog = page.getByRole("dialog", {
          name: "上传模板新版本",
        });
        await updateDialog
          .getByLabel("互动 HTML")
          .setInputFiles(htmlFile("v2.html", htmlV2));
        await updateDialog.getByRole("button", { name: "上传并启用" }).click();
        await expect(page.getByText("新版本已上传并启用。")).toBeVisible();

        const updated = await readTemplateBySlug(admin, slug);
        expect(updated.revision).toBe(2);
        const version2 = await readVersion(admin, updated.current_version_id);
        expect(version2).toMatchObject({
          guide_sha256: version1.guide_sha256,
          html_sha256: sha256(htmlV2),
          version_number: 2,
        });

        const updatedArticle = page
          .locator("article")
          .filter({ hasText: name });
        const otherArticle = page
          .locator("article")
          .filter({ hasText: "PT5 DS 报价单（多目的国版）" });
        const otherHeightBefore = (await otherArticle.boundingBox())?.height;
        expect(otherHeightBefore).toBeDefined();
        await updatedArticle.getByText("版本记录").click();
        await expect(updatedArticle.locator("details")).toHaveAttribute(
          "open",
          "",
        );
        // 双列卡片的高度应彼此独立，避免一侧展开后把另一侧也视觉上拉开。
        expect((await updatedArticle.boundingBox())?.height).toBeGreaterThan(
          otherHeightBefore!,
        );
        await expect
          .poll(async () => (await otherArticle.boundingBox())?.height)
          .toBe(otherHeightBefore);
        await page.reload();
        const otherHeightAfterReload = (await otherArticle.boundingBox())
          ?.height;
        await updatedArticle.getByText("版本记录").click();
        await expect(updatedArticle.locator("details")).toHaveAttribute(
          "open",
          "",
        );
        await expect
          .poll(async () => (await otherArticle.boundingBox())?.height)
          .toBe(otherHeightAfterReload);
        await expect(
          page.locator("nextjs-portal [data-nextjs-dialog]"),
        ).toHaveCount(0);
        expect(browserErrors).toEqual([]);
        await updatedArticle
          .getByRole("button", { name: "恢复此版本" })
          .click();
        await expect(page.getByText("已恢复所选版本。")).toBeVisible();
        await expect
          .poll(
            async () =>
              (await readTemplateBySlug(admin, slug)).current_version_id,
          )
          .toBe(version1.id);
        expect((await readTemplateBySlug(admin, slug)).revision).toBe(3);

        await page
          .locator("article")
          .filter({ hasText: name })
          .getByRole("button", { name: "停用" })
          .click();
        await expect(page.getByText("模板已停用。")).toBeVisible();
        const disabled = await readTemplateBySlug(admin, slug);
        expect(disabled).toMatchObject({ revision: 4, status: "inactive" });
        await expect(
          page
            .locator("article")
            .filter({ hasText: name })
            .getByRole("link", { name: "预览模板" }),
        ).toHaveCount(0);

        await page.setViewportSize({ height: 844, width: 390 });
        await expectNoPageOverflow(page);
        await expect(
          page.getByText("公司模板请在电脑上填写和打印。"),
        ).toBeVisible();
        await expect(
          page.getByRole("button", { name: "上传新版本" }),
        ).toHaveCount(0);
        await expectNoPageOverflow(page);
      } catch (error) {
        bodyFailure = { error };
      } finally {
        await finalizeCompanyTemplateCase(
          page,
          testInfo,
          async () => {
            await deleteTemplateFixture(admin, {
              id: templateId ?? undefined,
              name,
            });
            return {
              templateId,
              name,
              remainingTemplates: 0,
              remainingVersions: 0,
            };
          },
          bodyFailure,
        );
      }
    });
  }

  if (scenario === "retry") {
    test("重复发布只生成一个版本，业务失败和响应中断不会显示成功", async ({
      page,
    }, testInfo) => {
      test.setTimeout(120_000);
      const admin = requireLocalAdminClient();
      const account = await loginAs(page, "administrator");
      const templateId = randomUUID();
      const versionId = randomUUID();
      const marker = randomUUID();
      let bodyFailure: { error: unknown } | undefined;
      const multipart = publishMultipart({
        html: SIMPLE_HTML(`retry ${marker}`),
        slug: `retry-${marker}`,
        templateId,
        versionId,
      });

      try {
        // 第一份成功响应视为客户端断线丢失，随后使用同一组权威 ID 重试。
        await page.request.post("/api/company-templates/publish", {
          multipart,
        });
        const retry = await page.request.post(
          "/api/company-templates/publish",
          { multipart },
        );
        expect(retry.ok()).toBeTruthy();
        const retryBody = await retry.json();
        expect(retryBody).toMatchObject({
          ok: true,
          receipt: {
            revision: 1,
            template_id: templateId,
            version_id: versionId,
            version_number: 1,
          },
        });
        expect(await countVersions(admin, templateId)).toBe(1);

        await page.goto(`${account.workspacePath}/company-templates`);
        await page.getByRole("button", { name: "新建模板" }).click();
        let dialog = page.getByRole("dialog", { name: "新建公司模板" });
        await fillPublishDialog(dialog, {
          html: SIMPLE_HTML("200 business failure"),
          name: `失败模板 ${marker}`,
          slug: `business-failure-${marker}`,
        });
        await page.route("**/api/company-templates/publish", (route) =>
          route.fulfill({
            body: JSON.stringify({
              error: "company_template_publish_failed",
              ok: false,
            }),
            contentType: "application/json",
            status: 200,
          }),
        );
        await dialog.getByRole("button", { name: "上传并启用" }).click();
        await expect(dialog.getByRole("alert")).toContainText(
          "模板没有上传成功",
        );
        await expect(page.getByText("模板已创建并启用。")).toHaveCount(0);
        await page.unroute("**/api/company-templates/publish");
        await dialog.getByRole("button", { name: "取消" }).click();

        await page.getByRole("button", { name: "新建模板" }).click();
        dialog = page.getByRole("dialog", { name: "新建公司模板" });
        await fillPublishDialog(dialog, {
          html: SIMPLE_HTML("connection interrupted"),
          name: `断线模板 ${marker}`,
          slug: `interrupted-${marker}`,
        });
        await page.route("**/api/company-templates/publish", (route) =>
          route.abort("timedout"),
        );
        await dialog.getByRole("button", { name: "上传并启用" }).click();
        await expect(dialog.getByRole("alert")).toContainText(
          "模板没有上传成功",
        );
        await expect(page.getByText("模板已创建并启用。")).toHaveCount(0);
        await page.unroute("**/api/company-templates/publish");
      } catch (error) {
        bodyFailure = { error };
      } finally {
        await finalizeCompanyTemplateCase(
          page,
          testInfo,
          async () => {
            await deleteTemplateFixture(admin, { id: templateId });
            return { templateId, remainingTemplates: 0, remainingVersions: 0 };
          },
          bodyFailure,
        );
      }
    });
  }
}
