import { expect, test, type Page } from "@playwright/test";

import { getPeerSalesmanRegressionAccount } from "./helpers/accounts";
import { expectForbiddenPage, loginAs, loginWithAccount } from "./helpers/auth";

test.describe.serial("sales lead hall", () => {
  test.setTimeout(120_000);
  test("two salespeople compete for one lead and keep the full history", async ({ browser }) => {
    const peerAccount = getPeerSalesmanRegressionAccount();
    test.skip(!peerAccount, "The second local salesperson fixture is required.");

    const firstContext = await browser.newContext();
    const peerContext = await browser.newContext();
    const firstPage = await firstContext.newPage();
    const peerPage = await peerContext.newPage();
    await loginAs(firstPage, "salesman");
    await loginWithAccount(peerPage, peerAccount!);
    await Promise.all([
      firstPage.goto("/salesman/wholesale/leads"),
      peerPage.goto("/salesman/wholesale/leads"),
    ]);

    await expect(firstPage.getByRole("heading", { name: "线索大厅", exact: true })).toBeVisible();
    const claimTestId = await firstPage.locator('[data-testid^="claim-lead-"]').first().getAttribute("data-testid");
    expect(claimTestId).toBeTruthy();
    const leadId = claimTestId!.replace("claim-lead-", "");
    const leadCard = firstPage.locator('[data-testid^="sales-lead-row-"]').filter({ has: firstPage.locator(`[data-testid="${claimTestId}"]`) });
    const leadName = (await leadCard.getByRole("heading").innerText()).trim();

    // 直接触发两个已渲染按钮，避免页面的列表进入动画让 Playwright 自动等待错开两次请求。
    await Promise.all([
      firstPage.getByTestId(claimTestId!).evaluate((button: HTMLElement) => button.click()),
      peerPage.getByTestId(claimTestId!).evaluate((button: HTMLElement) => button.click()),
    ]);
    await Promise.all([
      firstPage.getByRole("button", { name: "我的线索" }).click(),
      peerPage.getByRole("button", { name: "我的线索" }).click(),
    ]);
    await expect.poll(async () =>
      Number(await firstPage.getByRole("heading", { name: leadName }).isVisible().catch(() => false)) +
      Number(await peerPage.getByRole("heading", { name: leadName }).isVisible().catch(() => false)),
    ).toBe(1);

    const winnerPage = await firstPage.getByRole("heading", { name: leadName }).isVisible() ? firstPage : peerPage;
    const nextOwnerPage = winnerPage === firstPage ? peerPage : firstPage;
    await winnerPage.getByRole("button", { name: "我的线索" }).click();
    await expect(winnerPage.getByRole("heading", { name: leadName })).toBeVisible();
    await openLead(winnerPage, leadName);
    await winnerPage.getByRole("button", { name: "记录联系" }).click();
    await winnerPage.getByTestId("sales-lead-action-note").fill("客户希望下周收到完整报价单。");
    await winnerPage.getByTestId("submit-lead-contact").click();
    await openLead(winnerPage, leadName);
    await expect(winnerPage.getByText("客户希望下周收到完整报价单。")).toBeVisible();
    await winnerPage.getByRole("button", { name: "退回大厅" }).click();
    await winnerPage.getByTestId("sales-lead-action-note").fill("交给更熟悉该市场的同事继续联系。");
    await winnerPage.getByTestId("submit-lead-return").click();

    await nextOwnerPage.reload();
    await nextOwnerPage.getByLabel("搜索线索").fill(leadName);
    await nextOwnerPage.getByTestId(`claim-lead-${leadId}`).click();
    await nextOwnerPage.getByRole("button", { name: "我的线索" }).click();
    await openLead(nextOwnerPage, leadName);
    await expect(nextOwnerPage.getByText("客户希望下周收到完整报价单。")).toBeVisible();
    await expect(nextOwnerPage.getByText("业务员主动退回")).toBeVisible();
    await nextOwnerPage.getByRole("button", { name: "标记已使用" }).click();
    await nextOwnerPage.getByTestId("sales-lead-action-note").fill("客户已经提交首笔批发订单。");
    await nextOwnerPage.getByTestId("submit-lead-use").click();
    await nextOwnerPage.getByRole("button", { name: "我已使用" }).click();
    await expect(nextOwnerPage.getByRole("heading", { name: leadName })).toBeVisible();
    // 使用结果除了保留在历史里，也要在详情的当前进度中完整展示。
    await openLead(nextOwnerPage, leadName);
    await expect(nextOwnerPage.getByRole("region", { name: "跟进进度" }).getByText("客户已经提交首笔批发订单。", { exact: true })).toBeVisible();

    await firstContext.close();
    await peerContext.close();
  });

  test("administrator can reopen used leads and the page fits desktop and mobile", async ({ page }) => {
    await loginAs(page, "administrator");
    await page.goto("/admin/wholesale/leads");
    await expect(page.getByRole("button", { name: "立即同步" })).toBeVisible();
    await page.getByRole("button", { name: "我已使用" }).click();
    await expect(page.locator('[data-testid^="sales-lead-row-"]').getByText("已使用", { exact: true }).first()).toBeVisible();
    const usedCard = page.locator('[data-testid^="sales-lead-row-"]').first();
    const usedLeadName = (await usedCard.getByRole("heading").innerText()).trim();
    await usedCard.getByRole("button", { name: "查看详情" }).click();
    await page.getByRole("button", { name: "重新开放" }).click();
    await page.getByTestId("sales-lead-action-note").fill("客户进入新的跟进周期。");
    await page.getByTestId("submit-lead-reopen").click();
    await page.getByRole("button", { name: "线索大厅" }).click();
    await page.getByLabel("搜索线索").fill(usedLeadName);
    await expect(page.getByRole("heading", { name: usedLeadName })).toBeVisible();

    for (const width of [1440, 375]) {
      await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
      await expectNoHorizontalOverflow(page);
      await expect(page.getByRole("heading", { name: usedLeadName })).toBeVisible();
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await openLead(page, usedLeadName);
    await page.getByRole("button", { name: "安排业务员" }).click();
    await page.getByTestId("sales-lead-action-note").fill("安排业务员继续新的联系周期。");
    await page.getByTestId("submit-lead-assign").click();
    await page.getByRole("button", { name: "全部认领" }).click();
    await page.getByLabel("搜索线索").fill(usedLeadName);
    await expect(page.getByRole("heading", { name: usedLeadName })).toBeVisible();
  });

  test("finance and client cannot open lead pages", async ({ browser }) => {
    for (const role of ["finance", "client"] as const) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await loginAs(page, role);
      await page.goto(`/${role}/wholesale/leads`);
      await expectForbiddenPage(page);
      await context.close();
    }
  });
});

async function openLead(page: Page, leadName: string) {
  const card = page.locator('[data-testid^="sales-lead-row-"]').filter({ has: page.getByRole("heading", { name: leadName }) });
  await card.getByRole("button", { name: "查看详情" }).click();
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  const squeezedText = await page.locator("main *").evaluateAll((elements) => elements.some((element) => {
    const rect = element.getBoundingClientRect();
    const text = element.textContent?.trim() ?? "";
    return text.length >= 4 && rect.width > 0 && rect.width < 18 && rect.height > rect.width * 3;
  }));
  expect(squeezedText).toBe(false);
}
