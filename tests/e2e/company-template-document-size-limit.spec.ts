import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { cleanupTemplateDocumentFixtures } from "../test-support/template-document-fixture-cleanup";
import {
  requireLocalAdminClient,
  clickStableTemplateButton,
} from "./helpers/company-template-actions";
import {
  openNewDocument,
  readPersonalDocument,
  expectDocumentContains,
} from "./helpers/company-template-documents";

test("超限图片保留页面内容，移除后能够保存", async ({ page }) => {
  test.setTimeout(120000);
  const admin = requireLocalAdminClient();
  const ids: string[] = [];
  await page.emulateMedia({ reducedMotion: "reduce" });
  await loginAs(page, "salesman");
  try {
    const id = await openNewDocument(page, ids);
    const original = await readPersonalDocument(id);
    const frame = page.frameLocator("iframe");
    // 真实文件输入读取图片内容；填充超过上限的数据仍留在沙箱，不提交数据库。
    const image = Buffer.concat([
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z4l8AAAAASUVORK5CYII=",
        "base64",
      ),
      Buffer.alloc(8 * 1024 * 1024),
    ]);
    await frame.locator(".photo").first().dblclick();
    await frame
      .locator("#photoFileInput")
      .setInputFiles({
        name: "large.png",
        mimeType: "image/png",
        buffer: image,
      });
    await expect(
      page.getByRole("alert").filter({ hasText: "10 MiB" }),
    ).toBeVisible({ timeout: 30000 });
    expect((await readPersonalDocument(id)).revision).toBe(original.revision);
    expect(
      (await frame.locator(".f-imgdata").first().inputValue()).length,
    ).toBeGreaterThan(10 * 1024 * 1024);
    await clickStableTemplateButton(page, frame, "× image");
    await expect(frame.locator(".f-imgdata").first()).toHaveValue("");
    await frame.locator("#client").fill("Reduced document data");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expectDocumentContains(page, id, "Reduced document data");
    await page.reload();
    await expect(frame.locator("#client")).toHaveValue("Reduced document data");
    await expect(frame.locator(".f-imgdata").first()).toHaveValue("");
  } finally {
    await cleanupTemplateDocumentFixtures(admin, ids);
  }
});
