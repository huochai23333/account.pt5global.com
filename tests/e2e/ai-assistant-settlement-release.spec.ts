import { expect, test, type Page } from "@playwright/test";

import {
  expectNotForbiddenPage,
  expectWorkspaceShell,
  loginAs,
} from "./helpers/auth";

const CONFIRM_ENDPOINT = "**/api/assistant/settlement-release";

test.describe("AI assistant settlement release", () => {
  test("finance confirms formal and temporary customer releases without duplicate writes", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(120_000);
    const suffix = Date.now();
    const formalNote = `助手正式客户 ${suffix}`;
    const cancelledNote = `助手取消临时客户 ${suffix}`;
    const temporaryNote = `助手临时客户 ${suffix}`;
    const temporaryCustomer = `Voltria-${suffix}`;

    await page.setViewportSize({ height: 900, width: 1440 });
    await loginAs(page, "finance");
    await page.goto("/finance/wholesale/settlement-releases");
    await expectWorkspaceShell(page);
    await expectNotForbiddenPage(page);
    await openAssistant(page);

    await sendAssistantMessage(
      page,
      `alpha shop付款$12.34 备注 ${formalNote}`,
    );

    const formalCard = page
      .getByTestId("ai-settlement-release-card")
      .last();
    await expect(formalCard).toBeVisible();
    await expect(formalCard).toContainText("已匹配到正式客户");
    await expect(formalCard).toContainText("alpha shop");
    await expect(formalCard).toContainText("Wholesale Alpha");
    await expect(formalCard).toContainText("12.34 USD");
    await expect(formalCard).toContainText(formalNote);

    // 确认卡出现时只能读取客户，结汇表里还不能产生任何新记录。
    await expect(
      page.getByRole("row").filter({ hasText: formalNote }),
    ).toHaveCount(0);

    let confirmRequestCount = 0;
    await page.route(CONFIRM_ENDPOINT, async (route) => {
      confirmRequestCount += 1;
      // 留出一个短暂窗口，验证发布期间按钮会被锁定，不会连续提交。
      await new Promise((resolve) => setTimeout(resolve, 300));
      await route.continue();
    });

    const formalConfirmButton = formalCard.getByRole("button", {
      name: "确认发布",
    });
    await formalConfirmButton.focus();
    await expect(formalConfirmButton).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(
      formalCard.locator('[data-slot="status-badge"]'),
    ).toHaveText("发布中");
    await expect(formalConfirmButton).toHaveCount(0);
    await expect(
      formalCard.locator('[data-slot="status-badge"]'),
    ).toHaveText("已发布");
    expect(confirmRequestCount).toBe(1);
    await page.unroute(CONFIRM_ENDPOINT);

    await closeAssistant(page);
    await page.getByLabel("搜索收款").fill(formalNote);
    await expect(
      page.getByRole("row").filter({ hasText: formalNote }),
    ).toHaveCount(1);

    await page.getByLabel("搜索收款").fill("");
    await page.setViewportSize({ height: 844, width: 390 });
    await openAssistant(page);
    await sendAssistantMessage(
      page,
      `${temporaryCustomer}付款$708.27 备注 ${cancelledNote}`,
    );

    const cancelledCard = page
      .getByTestId("ai-settlement-release-card")
      .last();
    await expect(cancelledCard).toContainText("将按临时客户发布");
    await expect(cancelledCard).toContainText(temporaryCustomer);
    await expectConfirmationCardMobileLayout(page, cancelledCard);

    const cancelButton = cancelledCard.getByRole("button", { name: "取消" });
    await cancelButton.focus();
    await page.keyboard.press("Space");
    await expect(
      cancelledCard.locator('[data-slot="status-badge"]'),
    ).toHaveText("已取消");
    await expect(
      page.getByRole("row").filter({ hasText: cancelledNote }),
    ).toHaveCount(0);

    await sendAssistantMessage(
      page,
      `${temporaryCustomer}到账USD 708.27 今天 Note ${temporaryNote}`,
    );
    const temporaryCard = page
      .getByTestId("ai-settlement-release-card")
      .last();
    await expect(temporaryCard).toContainText("将按临时客户发布");

    // 首次确认模拟临时故障；卡片必须保留完整内容和明确的重试入口。
    await page.route(CONFIRM_ENDPOINT, async (route) => {
      await route.fulfill({
        body: JSON.stringify({ error: "serviceUnavailable" }),
        contentType: "application/json",
        status: 503,
      });
    });
    await temporaryCard.getByRole("button", { name: "确认发布" }).click();
    await expect(temporaryCard.getByRole("alert")).toContainText(
      "内容已保留，可以稍后重试",
    );
    await expect(
      temporaryCard.getByRole("button", { name: "重新发布" }),
    ).toBeVisible();

    await page.unroute(CONFIRM_ENDPOINT);
    await temporaryCard.getByRole("button", { name: "重新发布" }).click();
    await expect(
      temporaryCard.locator('[data-slot="status-badge"]'),
    ).toHaveText("已发布");
    await expectNoDocumentHorizontalOverflow(page);

    await closeAssistant(page);
    await page.getByLabel("搜索收款").fill(temporaryNote);
    const temporaryRows = page
      .getByRole("row")
      .filter({ hasText: temporaryNote });
    await expect(temporaryRows).toHaveCount(1);
    await expect(temporaryRows.first()).toContainText(temporaryCustomer);
    await expectNoDocumentHorizontalOverflow(page);
  });

  test("fixed parser handles dates, currencies, guidance and direct permission checks", async ({
    browser,
  }) => {
    const financePage = await browser.newPage();
    await loginAs(financePage, "finance");

    const yesterday = addShanghaiCalendarDays(-1);
    const fullCommand = await postAssistantCommand(
      financePage,
      "Alpha Shop收款USD 1,234.56 昨天 Note 月度回款",
    );
    expect(fullCommand.status).toBe(200);
    expect(fullCommand.body).toMatchObject({
      action: {
        amount: 1234.56,
        currency: "USD",
        customerKind: "existing",
        customerName: "Wholesale Alpha",
        inputCustomerName: "Alpha Shop",
        note: "月度回款",
        receivedOn: yesterday,
      },
      kind: "settlementReleaseConfirmation",
    });

    const currencyCases = [
      ["Voltria到账￥88 2026年7月21日", "CNY", "2026-07-21"],
      ["Voltria结汇EUR 9", "EUR", getShanghaiDate()],
      ["Voltria付款JPY 10", "JPY", getShanghaiDate()],
      ["Voltria received AUD 11", "AUD", getShanghaiDate()],
    ] as const;

    for (const [message, currency, receivedOn] of currencyCases) {
      const response = await postAssistantCommand(financePage, message);
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        action: { currency, receivedOn },
        kind: "settlementReleaseConfirmation",
      });
    }

    const guidanceCases = [
      ["Voltria付款708.27", "missingCurrency"],
      ["Voltria付款$1，另收款USD 2", "multipleAmounts"],
      ["Voltria付款USD 10 2026-02-30", "invalidDate"],
    ] as const;

    for (const [message, code] of guidanceCases) {
      const response = await postAssistantCommand(financePage, message);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        code,
        kind: "settlementReleaseGuidance",
      });
    }

    const action = getResponseAction(fullCommand.body);
    await financePage.close();

    const salesmanPage = await browser.newPage();
    await loginAs(salesmanPage, "salesman");
    const roleGuidance = await postAssistantCommand(
      salesmanPage,
      "Voltria付款$10",
    );
    expect(roleGuidance.body).toEqual({
      code: "notAllowed",
      kind: "settlementReleaseGuidance",
    });

    // 即使绕过确认卡直接请求发布接口，业务员也必须在服务端被拒绝。
    const directConfirm = await salesmanPage.evaluate(async (payload) => {
      const response = await fetch("/api/assistant/settlement-release", {
        body: JSON.stringify({ action: payload }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      return { body: await response.json(), status: response.status };
    }, action);
    expect(directConfirm).toEqual({
      body: { error: "forbidden" },
      status: 403,
    });
    await salesmanPage.close();
  });

  test("ambiguous customer alias stops before showing a confirmation card", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const suffix = Date.now();
    const sharedAlias = `共同别名 ${suffix}`;
    const customerNames = [
      `重名客户甲 ${suffix}`,
      `重名客户乙 ${suffix}`,
    ];

    await loginAs(page, "administrator");
    await page.goto("/admin/wholesale/customers");
    await expectWorkspaceShell(page);

    for (const customerName of customerNames) {
      await createCustomer(page, customerName, sharedAlias);
    }

    await page.goto("/admin/wholesale/settlement-releases");
    await openAssistant(page);
    await sendAssistantMessage(page, `${sharedAlias}付款$20`);
    await expect(
      page.getByText("这个名称匹配到多个客户，请改用客户唯一名称后重新发送。"),
    ).toBeVisible();
    await expect(page.getByTestId("ai-settlement-release-card")).toHaveCount(0);

    // 清理本用例创建的客户，避免影响后续回归数据。
    await closeAssistant(page);
    await page.goto("/admin/wholesale/customers");
    for (const customerName of customerNames) {
      await deleteCustomer(page, customerName);
    }
  });
});

async function openAssistant(page: Page) {
  await page.getByTestId("ai-assistant-launcher").click();
  await expect(page.getByLabel("问题内容")).toBeVisible();
}

async function closeAssistant(page: Page) {
  await page.getByRole("button", { name: /^关闭.*助手$/ }).click();
  await expect(page.getByLabel("问题内容")).toHaveCount(0);
}

async function sendAssistantMessage(page: Page, message: string) {
  const input = page.getByLabel("问题内容");
  await input.fill(message);
  await input.press("Enter");
  await expect(page.getByText(message, { exact: true })).toBeVisible();
  await expect(page.getByText("正在回复", { exact: true })).toHaveCount(0);
}

async function expectConfirmationCardMobileLayout(
  page: Page,
  card: ReturnType<Page["getByTestId"]>,
) {
  await expectNoDocumentHorizontalOverflow(page);

  const actionButtons = card.getByRole("button");
  for (let index = 0; index < (await actionButtons.count()); index += 1) {
    const box = await actionButtons.nth(index).boundingBox();
    expect(box).not.toBeNull();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }

  const compressedText = await card.locator("dt, dd, button").evaluateAll(
    (elements) =>
      elements
        .filter((element) => {
          const box = element.getBoundingClientRect();
          const text = element.textContent?.trim() ?? "";
          return text && box.width > 0 && box.width < 24 && box.height > 48;
        })
        .map((element) => element.textContent?.trim()),
  );
  expect(compressedText).toEqual([]);
}

async function expectNoDocumentHorizontalOverflow(page: Page) {
  const overflowPixels = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflowPixels).toBeLessThanOrEqual(2);
}

async function postAssistantCommand(page: Page, message: string) {
  return page.evaluate(async (command) => {
    const response = await fetch("/api/assistant/chat", {
      body: JSON.stringify({
        history: [],
        locale: "zh",
        message: command,
        pathname: window.location.pathname,
        requestId: crypto.randomUUID(),
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    return {
      body: (await response.json()) as unknown,
      status: response.status,
    };
  }, message);
}

function getResponseAction(value: unknown) {
  if (
    typeof value !== "object" ||
    value === null ||
    !("action" in value) ||
    typeof value.action !== "object" ||
    value.action === null
  ) {
    throw new Error("没有取得可用于权限校验的确认内容");
  }

  return value.action;
}

function getShanghaiDate() {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Shanghai",
    year: "numeric",
  }).format(new Date());
}

function addShanghaiCalendarDays(days: number) {
  const [year, month, day] = getShanghaiDate().split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

async function createCustomer(
  page: Page,
  customerName: string,
  sharedAlias: string,
) {
  await page.getByRole("button", { name: "新增客户" }).click();
  const dialog = page.getByRole("dialog", { name: "新增批发客户" });
  await dialog.getByLabel("客户唯一标识名称").fill(customerName);
  await dialog.getByLabel("客户其他名称").fill(sharedAlias);
  await dialog.getByLabel("联系方式").fill("自动测试");
  await dialog.getByLabel("客户来源").fill("自动测试");
  await dialog.getByLabel("备注").fill("用于结汇名称歧义回归");
  await dialog.getByRole("button", { name: "保存客户" }).click();
  await expect(page.getByText("批发客户已保存。")).toBeVisible();
}

async function deleteCustomer(page: Page, customerName: string) {
  await page.getByLabel("搜索客户").fill(customerName);
  await page
    .getByText(customerName, { exact: true })
    .filter({ visible: true })
    .first()
    .click();
  const detailsDialog = page.getByRole("dialog", { name: customerName });
  await detailsDialog.getByRole("button", { name: "删除客户" }).click();
  const deleteDialog = page.getByRole("dialog", { name: "删除批发客户" });
  await deleteDialog.getByRole("button", { name: "确认删除" }).click();
  await expect(page.getByText("客户已删除。")).toBeVisible();
  await page.getByLabel("搜索客户").fill("");
}
