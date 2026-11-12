import { expect, type Page } from "@playwright/test";
import { test } from "./helpers/operator-reimbursement-fixture";

import {
  expectForbiddenPage,
  expectNotForbiddenPage,
  expectWorkspaceShell,
  loginAs,
  loginWithAccount,
} from "./helpers/auth";
import { getPeerOperatorRegressionAccount } from "./helpers/accounts";
import { fillDateControl } from "./helpers/date-control";
import { chooseSelectOption } from "./helpers/select-control";

test.describe("operator reimbursements", () => {
  test("operator can add and reimburse an isolated period", async ({ page, reimbursementCase }) => {
    const account = getPeerOperatorRegressionAccount();
    test.skip(!account, "This test requires the local peer operator account.");
    if (!account) return;

    reimbursementCase.prepare("88.66");
    const { content, periodStart: isolatedPeriodStart } = reimbursementCase;
    await loginWithAccount(page, account);
    await page.goto("/operator/reimbursements");

    await expectWorkspaceShell(page);
    await expectNotForbiddenPage(page);
    await expect(page.getByRole("heading", { name: "报销记录" })).toBeVisible();
    await expectNoDocumentHorizontalOverflow(page);

    await page.getByRole("button", { name: "新增报销" }).click();
    const dialog = page.getByRole("dialog", { name: "新增报销" });
    await expect(dialog).toBeVisible();
    await fillDateControl(dialog.getByLabel("发生日期"), isolatedPeriodStart);
    await dialog.getByLabel("报销金额").fill("88.66");
    await dialog.getByLabel("报销内容").fill(content);
    await dialog.getByRole("button", { name: "保存记录" }).click();

    await expect(page.getByText("记录已保存。")).toBeVisible();
    const reimbursementCard = page.locator("article").filter({ hasText: content });
    await expect(reimbursementCard).toBeVisible();
    // 捕获真实编号及行版本；后续周期确认和清理都以这条凭证为准。
    const created = reimbursementCase.saved();
    const unreimbursedBadge = reimbursementCard
      .locator('[data-slot="status-badge"]')
      .filter({ hasText: "未报销" })
      .first();
    await expect(unreimbursedBadge).toBeVisible();
    await expect(unreimbursedBadge).toHaveAttribute("data-tone", "warning");
    await expect(reimbursementCard.getByText("¥88.66")).toBeVisible();

    await page.getByRole("button", { name: "确认报销", exact: true }).click();
    const confirmDialog = page.getByRole("dialog", {
      name: "确认报销",
      exact: true,
    });
    await chooseSelectOption(
      confirmDialog.getByRole("combobox", {
        name: "待报销周期",
        exact: true,
      }),
      { value: isolatedPeriodStart },
    );
    await expect(confirmDialog.getByText("共 1 条待报销记录")).toBeVisible();
    reimbursementCase.assertPeriodOwned();
    await confirmDialog.getByRole("button", { name: "确认报销", exact: true }).click();

    await expect(page.getByText("已将 1 条记录标记为已报销。")).toBeVisible();
    const reimbursedBadge = reimbursementCard
      .locator('[data-slot="status-badge"]')
      .filter({ hasText: "已报销" })
      .first();
    await expect(reimbursedBadge).toBeVisible();
    await expect(reimbursedBadge).toHaveAttribute("data-tone", "success");
    const finished = reimbursementCase.reimbursed();
    expect(finished.record.id).toBe(created.record.id);
    await page.reload();
    await expect(reimbursementCard).toBeVisible();
    await expect(reimbursedBadge).toBeVisible();
    reimbursementCase.unchanged();
    await expectNoDocumentHorizontalOverflow(page);
  });

  test("finance cannot open operator reimbursements", async ({ page }) => {
    await loginAs(page, "finance");
    await page.goto("/finance/reimbursements");

    await expectForbiddenPage(page);
  });

  test("HTTP 200 但周期影响 0 行时保留弹窗且不显示成功", async ({ page, reimbursementCase }) => {
    const account = getPeerOperatorRegressionAccount();
    test.skip(!account, "This test requires the local peer operator account.");
    if (!account) return;

    reimbursementCase.prepare("66.66");
    const { content, periodStart: isolatedPeriodStart } = reimbursementCase;
    reimbursementCase.seed();
    await loginWithAccount(page, account);
    await page.goto("/operator/reimbursements");
    await page.getByRole("button", { name: "确认报销", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "确认报销", exact: true });
    await chooseSelectOption(dialog.getByRole("combobox", { name: "待报销周期", exact: true }), {
      value: isolatedPeriodStart,
    });

    // 故意让 RPC 返回 HTTP 200 和 0 行；真实数据库记录仍保持未报销。
    await page.route("**/rest/v1/rpc/mark_operator_reimbursements_reimbursed", async (route) => {
      await route.fulfill({
        body: JSON.stringify({
          period_end: reimbursementCase.periodEnd,
          period_start: isolatedPeriodStart,
          reimbursed_total: 0,
          updated_count: 0,
        }),
        contentType: "application/json",
        status: 200,
      });
    });
    await dialog.getByRole("button", { name: "确认报销", exact: true }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-slot="feedback-notice"][data-tone="error"]')).toBeVisible();
    await expect(page.locator('[data-slot="feedback-notice"][data-tone="success"]')).toHaveCount(0);
    reimbursementCase.unchanged();
    await page.unroute("**/rest/v1/rpc/mark_operator_reimbursements_reimbursed");
    await page.reload();
    await expect(
      page.locator("article").filter({ hasText: content }).getByText("未报销", { exact: true }),
    ).toBeVisible();
    reimbursementCase.unchanged();
  });

  test("operator reimbursements page fits mobile width", async ({ page }) => {
    await loginAs(page, "operator");
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto("/operator/reimbursements");

    await expect(page.getByRole("heading", { name: "报销记录" })).toBeVisible();
    await expect(page.getByRole("button", { name: "新增报销" })).toBeVisible();
    await expectNoDocumentHorizontalOverflow(page);
  });
});

async function expectNoDocumentHorizontalOverflow(page: Page) {
  const overflowPixels = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

  expect(overflowPixels).toBeLessThanOrEqual(2);
}
