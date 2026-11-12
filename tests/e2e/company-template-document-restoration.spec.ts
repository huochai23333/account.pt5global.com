import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { cleanupTemplateDocumentFixtures } from "../test-support/template-document-fixture-cleanup";
import { requireLocalAdminClient } from "./helpers/company-template-actions";
import {
  openNewDocument,
  expectDocumentContains,
  expectDocumentSaved,
} from "./helpers/company-template-documents";

test("保存串行执行并追上请求期间的新修改", async ({ page }) => {
  test.setTimeout(120000);
  const admin = requireLocalAdminClient();
  const ids: string[] = [];
  await loginAs(page, "salesman");
  try {
    const id = await openNewDocument(page, ids);
    let active = 0;
    let maximum = 0;
    await page.route("**/api/company-template-documents", async (route) => {
      active++;
      maximum = Math.max(maximum, active);
      try {
        // 持续计数到真实上游响应回传，不能只用请求被放行前的等待证明保存串行。
        await new Promise((resolve) => setTimeout(resolve, 1800));
        const response = await route.fetch();
        await route.fulfill({ response });
      } finally {
        active--;
      }
    });
    const frame = page.frameLocator("iframe");
    await frame.locator("#client").fill("First pending edit");
    await expect(
      page.getByRole("status").filter({ hasText: "正在保存" }),
    ).toBeVisible();
    await frame.locator("#client").fill("Newest pending edit");
    await expectDocumentContains(page, id, "Newest pending edit");
    expect(maximum).toBe(1);
    await page.unroute("**/api/company-template-documents");
    await page.reload();
    await expect(frame.locator("#client")).toHaveValue("Newest pending edit");
    await expectDocumentSaved(page);
  } finally {
    await cleanupTemplateDocumentFixtures(admin, ids);
  }
});
