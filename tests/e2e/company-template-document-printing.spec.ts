import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { cleanupTemplateDocumentFixtures } from "../test-support/template-document-fixture-cleanup";
import {
  requireLocalAdminClient,
  fillQuotationRow,
  clickStableTemplateButton,
} from "./helpers/company-template-actions";
import {
  openNewDocument,
  readPersonalDocument,
  expectDocumentContains,
} from "./helpers/company-template-documents";

test("删行、汇率计算和打印设置保存后恢复，必填检查继续生效", async ({
  page,
}) => {
  test.setTimeout(120000);
  const admin = requireLocalAdminClient();
  const ids: string[] = [];
  await page.emulateMedia({ reducedMotion: "reduce" });
  // 只记录浏览器是否调用打印；系统打印窗口和实际 PDF 文件不属于此自动化凭证。
  await page.addInitScript(() =>
    Object.defineProperty(window, "print", {
      value: () => (document.documentElement.dataset.printCalled = "yes"),
    }),
  );
  await loginAs(page, "salesman");
  try {
    const id = await openNewDocument(page, ids);
    const frame = page.frameLocator("iframe");
    let printNotice = "";
    page.once("dialog", async (prompt) => {
      printNotice = prompt.message();
      await prompt.accept();
    });
    await clickStableTemplateButton(page, frame, "Print all");
    expect(printNotice).toContain("必填");
    await expect(frame.locator("html")).not.toHaveAttribute(
      "data-print-called",
      "yes",
    );
    await frame.locator("#client").fill("Print restoration client");
    await frame.locator("#quoter").fill("Sales");
    await frame.locator("#lhMail").fill("sales@example.test");
    await fillQuotationRow(frame, 0);
    await clickStableTemplateButton(page, frame, "+ Add product");
    await expect(frame.locator("tr.prow")).toHaveCount(2);
    await frame
      .locator("tr.prow")
      .nth(1)
      .locator(".rowtools button")
      .last()
      .click();
    await expect(frame.locator("tr.prow")).toHaveCount(1);
    await frame.locator("#rate").fill("7.25");
    await frame.locator("#play").selectOption("portrait");
    await frame.locator("#rowh").fill("30");
    await frame.locator("#incTerms").uncheck();
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expectDocumentContains(page, id, "Print restoration client");
    const total = await frame.locator(".o-tot").first().innerText();
    expect(total).not.toBe("—");
    const record = await readPersonalDocument(id);
    expect(record.state.pages[0].rows).toHaveLength(1);
    await page.reload();
    await expect(frame.locator("#rate")).toHaveValue("7.25");
    await expect(frame.locator("#play")).toHaveValue("portrait");
    await expect(frame.locator("#rowh")).toHaveValue("30");
    await expect(frame.locator("#incTerms")).not.toBeChecked();
    await expect(frame.locator(".o-tot").first()).toHaveText(total);
    await expect(frame.locator("#needBadge")).toContainText(
      "all required fields filled",
    );
    await clickStableTemplateButton(page, frame, "Print all");
    await expect(frame.locator("html")).toHaveAttribute(
      "data-print-called",
      "yes",
    );
    await expect(frame.locator("#termsPage")).toHaveClass(/print-hide/);
  } finally {
    await cleanupTemplateDocumentFixtures(admin, ids);
  }
});
