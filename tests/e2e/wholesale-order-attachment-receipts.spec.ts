import { expect, test } from "@playwright/test";
import { cleanupFixtureResources } from "../test-support/fixture-cleanup-sequence";
import { loginAs } from "./helpers/auth";
import { runLocalSupabaseSql } from "./helpers/local-supabase";
import {
  createAttachmentPageScope,
  deleteAttachmentFromPage,
  findAttachmentOrder,
} from "./helpers/wholesale-order-attachment-page";

test.describe("Order List 最终业务凭证", () => {
  test("页面上传和删除后，数据库、Storage 与刷新页面保持一致", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    runLocalSupabaseSql("select 1;");
    const scope = createAttachmentPageScope(false, "VERIFY-001");
    await cleanupFixtureResources(
      async () => {
        await page.setViewportSize({ height: 900, width: 1440 });
        await loginAs(page, "administrator");
        await scope.prepare(page);
        const { order, fixture } = scope.current();
        await scope.watch(page, async () => {
          const row = await findAttachmentOrder(page, order);
          await row.getByRole("button", { name: "管理附件" }).click();
          const dialog = page.getByRole("dialog", { name: /Order List 附件/ });
          await dialog.locator('input[type="file"]').setInputFiles(scope.files);
          await dialog.getByRole("button", { name: "上传附件" }).click();
          await expect(page.getByText("Order List 附件已上传。")).toBeVisible();
          await expect(dialog).toBeHidden();
          // 成功提示之后再查登记行、版本、对象身份和下载字节，不以页面缓存作凭证。
          expect(fixture.confirmRegistered()).toHaveLength(2);
          await page.reload();
          const refreshed = await findAttachmentOrder(page, order);
          for (const file of scope.files)
            await expect(
              refreshed.getByRole("button", { name: file.name }),
            ).toBeVisible();
          fixture.verifyPresent();
          await refreshed.getByRole("button", { name: "管理附件" }).click();
          for (const file of scope.files) {
            await deleteAttachmentFromPage(page, dialog, scope, file.name);
            await expect(
              page.getByText("Order List 附件已删除。"),
            ).toBeVisible();
          }
          fixture.requireCleared();
          await page.reload();
          const finalRow = await findAttachmentOrder(page, order);
          await finalRow.getByRole("button", { name: "管理附件" }).click();
          for (const file of scope.files)
            await expect(
              dialog.getByText(file.name, { exact: true }),
            ).toHaveCount(0);
          fixture.requireCleared();
        });
      },
      () => page.unrouteAll({ behavior: "wait" }),
      () => scope.cleanup(),
    );
  });

  test("故意返回 HTTP 200 的部分登记结果时，页面拒绝成功并保留待核对对象", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    runLocalSupabaseSql("select 1;");
    const scope = createAttachmentPageScope(true, "VERIFY-001");
    await cleanupFixtureResources(
      async () => {
        await page.setViewportSize({ height: 844, width: 390 });
        await loginAs(page, "administrator");
        // 先在桌面完成本次订单创建，再切回原手机场景，避免依赖固定共享订单。
        await page.setViewportSize({ height: 900, width: 1440 });
        await scope.prepare(page);
        await page.setViewportSize({ height: 844, width: 390 });
        const { order, fixture } = scope.current();
        await scope.watch(
          page,
          async () => {
            const orderDialog = await findAttachmentOrder(page, order);
            await orderDialog.getByRole("button", { name: "管理附件" }).click();
            const dialog = page.getByRole("dialog", {
              name: /Order List 附件/,
            });
            await dialog
              .locator('input[type="file"]')
              .setInputFiles(scope.files);
            await dialog.getByRole("button", { name: "上传附件" }).click();
            await expect(
              page.locator('[data-slot="feedback-notice"][data-tone="error"]'),
            ).toBeVisible();
            await expect(
              page.locator(
                '[data-slot="feedback-notice"][data-tone="success"]',
              ),
            ).toHaveCount(0);
            await expect(dialog).toBeVisible();
            // 本次登记被明确拦截且从未转发：登记应为零、两对象仍在且字节一致。
            // 真实未知提交不能据此删除；只有测试夹具持有未转发证明才在收尾时回收。
            await fixture.confirmUnregisteredObjects();
            expect(
              await page.evaluate(
                () => document.documentElement.scrollWidth - window.innerWidth,
              ),
            ).toBeLessThanOrEqual(2);
          },
          true,
        );
      },
      () => page.unrouteAll({ behavior: "wait" }),
      () => scope.cleanup(),
    );
  });
});
