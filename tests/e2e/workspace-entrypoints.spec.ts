import { expect, test, type Page } from "@playwright/test";

import {
  expectForbiddenPage,
  expectNotForbiddenPage,
  expectWorkspaceShell,
  loginAs,
  type RegressionRole,
} from "./helpers/auth";
import {
  expectDateControlValue,
  fillDateControl,
} from "./helpers/date-control";
import { expectSelectValue } from "./helpers/select-control";
import {
  restoreDefaultAdminBusinessGroups,
  setDesktopBusinessGroupExpanded,
} from "./helpers/workspace-navigation";

type WorkspaceEntry = {
  paths: readonly string[];
  role: RegressionRole;
};

const workspaceEntries: readonly WorkspaceEntry[] = [
  {
    paths: [
      "/admin/accounts",
      "/admin/announcements",
      "/admin/feedback",
      "/admin/reviews",
      "/admin/settings",
      "/admin/tourism/orders",
      "/admin/tourism/customers",
      "/admin/tourism/people",
      "/admin/tourism/vip",
      "/admin/tourism/referrals",
      "/admin/tourism/commission",
      "/admin/tourism/records",
      "/admin/wholesale/orders",
      "/admin/wholesale/settlement-releases",
      "/admin/wholesale/logistics",
      "/admin/wholesale/customers",
      "/admin/wholesale/people",
      "/admin/wholesale/vip",
      "/admin/wholesale/referrals",
      "/admin/wholesale/commission",
    ],
    role: "administrator",
  },
  {
    paths: [
      "/salesman/wholesale/orders",
      "/salesman/wholesale/settlement-releases",
      "/salesman/wholesale/order-claims",
      "/salesman/wholesale/logistics",
      "/salesman/wholesale/customers",
      "/salesman/wholesale/vip",
      "/salesman/wholesale/referrals",
      "/salesman/wholesale/commission",
      "/salesman/wholesale/incentives",
    ],
    role: "salesman",
  },
  {
    paths: [
      "/promoter/tourism/orders",
      "/promoter/tourism/tasks",
      "/promoter/tourism/commission",
      "/promoter/tourism/customers",
    ],
    role: "promoter",
  },
  {
    paths: ["/client/tourism/orders", "/client/tourism/referrals"],
    role: "client",
  },
  {
    paths: [
      "/finance/company-expenses",
      "/finance/wholesale/orders",
      "/finance/wholesale/settlement-releases",
      "/finance/wholesale/logistics",
      "/finance/wholesale/customers",
      "/finance/wholesale/commission",
    ],
    role: "finance",
  },
];

test.describe("workspace entrypoint regression", () => {
  for (const entry of workspaceEntries) {
    test(`${entry.role} can open key workspace sections`, async ({
      page,
    }, testInfo) => {
      testInfo.setTimeout(entry.role === "administrator" ? 120_000 : 60_000);
      await loginAs(page, entry.role);

      for (const workspacePath of entry.paths) {
        await page.goto(workspacePath);
        await expectWorkspaceShell(page);
        await expectNotForbiddenPage(page);
      }
    });
  }

  test("desktop business group can collapse while the current section is active", async ({
    page,
  }) => {
    await loginAs(page, "administrator");
    await page.goto("/admin/wholesale/orders");
    await expectWorkspaceShell(page);
    await expectNotForbiddenPage(page);

    const sidebar = page.locator("aside").first();
    const wholesaleGroupButton = sidebar.getByRole("button", {
      name: "批发业务",
    });
    const wholesaleOrdersLink = sidebar.getByRole("link", {
      name: "批发订单",
    });

    await expect(wholesaleGroupButton).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await expect(wholesaleOrdersLink).toBeVisible();

    await setDesktopBusinessGroupExpanded(page, "批发业务", false);

    await expect(wholesaleGroupButton).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await expect(wholesaleOrdersLink).toBeHidden();

    await setDesktopBusinessGroupExpanded(page, "批发业务", true);

    await expect(wholesaleGroupButton).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await expect(wholesaleOrdersLink).toBeVisible();

    await page.goto("/admin/home");
    await restoreDefaultAdminBusinessGroups(page);
  });

  for (const entry of [
    { role: "salesman" as const },
    { role: "promoter" as const },
  ]) {
    test(`${entry.role} home copies the single invite code`, async ({
      page,
    }) => {
      await mockClipboard(page);
      await loginAs(page, entry.role);

      const inviteCode = (
        await page.getByTestId("home-invite-code").innerText()
      )
        .trim()
        .toUpperCase();

      // 紧凑首页优先展示邀请码本身；复制入口在迷你和普通卡片中保持同一语义。
      await page.getByTestId("home-invite-copy-code").click();

      const copiedCode = await page.evaluate(() =>
        window.localStorage.getItem("__lastCopiedInviteLink") ?? "",
      );

      expect(copiedCode).toBe(inviteCode);
      expect(copiedCode).not.toMatch(/-[TD]$/);
    });
  }

  test("wholesale order list can filter by ordered date range", async ({
    page,
  }) => {
    await loginAs(page, "administrator");
    await page.goto("/admin/wholesale/orders");
    await expectWorkspaceShell(page);
    await expectNotForbiddenPage(page);

    const orderedFromInput = page.getByLabel("下单日期从");
    const orderedToInput = page.getByLabel("下单日期到");
    const clearFiltersButton = page.getByRole("button", {
      name: "恢复默认范围",
    });
    const assessmentButton = page.getByRole("button", {
      name: "生成当前范围评估",
    });

    await expect(orderedFromInput).toBeVisible();
    await expect(orderedToInput).toBeVisible();
    // 页面标题已经说明当前任务，评估操作直接靠近订单记录，不再占用独立板块标题。
    await expect(page.getByText("AI订单评估")).toHaveCount(0);
    await expect(assessmentButton).toBeVisible();

    const defaultRange = getLast30DaysDateRange();

    await expectDateControlValue(orderedFromInput, defaultRange.from);
    await expectDateControlValue(orderedToInput, defaultRange.to);
    await expect(clearFiltersButton).toBeDisabled();

    await fillDateControl(orderedFromInput, "2099-01-01");
    await fillDateControl(orderedToInput, "2099-01-31");

    await expectDateControlValue(orderedFromInput, "2099-01-01");
    await expectDateControlValue(orderedToInput, "2099-01-31");
    await expect(clearFiltersButton).toBeEnabled();
    await expect(assessmentButton).toBeDisabled();
    await expect(
      page.getByText("当前筛选条件下没有订单，调整日期或筛选条件后再生成评估。"),
    ).toBeVisible();

    await clearFiltersButton.click();

    await expectDateControlValue(orderedFromInput, defaultRange.from);
    await expectDateControlValue(orderedToInput, defaultRange.to);

    await page.route("**/api/wholesale/order-assessment", async (route) => {
      const text = "**订单概况**\n* 当前范围共 2 笔订单。\n* 状态分布正常。";
      await route.fulfill({
        body: `${JSON.stringify({ type: "delta", text })}\n${JSON.stringify({ type: "completed", contentLength: text.length })}\n`,
        contentType: "application/x-ndjson; charset=utf-8",
      });
    });

    await expect(assessmentButton).toBeEnabled();
    await assessmentButton.click();

    const assessmentOutput = page.getByTestId(
      "wholesale-order-assessment-output",
    );

    await expect(assessmentOutput).toContainText("订单概况");
    await expect(assessmentOutput).toContainText("当前范围共 2 笔订单。");
    await expect(assessmentOutput).not.toContainText("**");
    await expect(assessmentOutput).not.toContainText("*");
  });

  test("admin settings only keep active wholesale rules and orders edit directly", async ({
    page,
  }) => {
    await loginAs(page, "administrator");
    await page.goto("/admin/wholesale/settings");
    await expectWorkspaceShell(page);
    await expectNotForbiddenPage(page);

    await expect(page.getByRole("heading", { name: "订单修改规则" })).toHaveCount(0);
    await expect(page.getByLabel("可直接修改天数")).toHaveCount(0);
    await expect(visibleExactText(page, "批发订单业务员佣金")).toHaveCount(1);
    await expect(visibleExactText(page, "批发推荐月订单金额佣金")).toHaveCount(1);
    await expect(page.getByText("采购订单业务员佣金", { exact: true })).toHaveCount(0);

    await page.goto("/admin/wholesale/orders");
    await expectWorkspaceShell(page);
    await expectNotForbiddenPage(page);

    const editButton = page.getByRole("button", { name: "修改订单" }).first();
    await expect(editButton).toBeVisible();
    await editButton.click();

    await expect(page.getByRole("heading", { name: "修改批发订单" })).toBeVisible();
    await expect(page.getByLabel("客户支付金额")).toBeVisible();
    await expect(page.getByRole("button", { name: "保存修改" })).toBeVisible();

    await page.keyboard.press("Escape");
    await page.setViewportSize({ height: 844, width: 390 });

    await page.goto("/admin/wholesale/settings");
    await expect(page.getByRole("heading", { name: "订单修改规则" })).toHaveCount(0);
    await expect(page.getByLabel("可直接修改天数")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /编辑|修改/ }).first()).toBeVisible();
    await expectNoDocumentHorizontalOverflow(page);

    await page.goto("/admin/wholesale/orders");
    await expect(page.getByRole("heading", { name: "批发订单" })).toBeVisible();
    await page.locator('[data-testid^="wholesale-order-card-"]').first().click();
    await expect(
      page.getByRole("dialog").getByRole("button", { name: "修改订单" }),
    ).toBeVisible();
    await expectNoDocumentHorizontalOverflow(page);
  });

  test("admin business customer pages are separate from people pages", async ({
    page,
  }) => {
    await loginAs(page, "administrator");

    await page.goto("/admin/tourism/customers");
    await expectWorkspaceShell(page);
    await expectNotForbiddenPage(page);
    await expect(page.getByRole("heading", { name: "旅游客户管理" })).toBeVisible();
    await expect(page.getByText("地推账户")).toHaveCount(0);

    await page.goto("/admin/tourism/people");
    await expectWorkspaceShell(page);
    await expectNotForbiddenPage(page);
    await expect(page.getByRole("heading", { name: "旅游人员管理" })).toBeVisible();
    await expect(page.getByText("旅游客户")).toHaveCount(0);
    await expect(page.getByText("地推账户").first()).toBeVisible();

    await page.goto("/admin/wholesale/customers");
    await expectWorkspaceShell(page);
    await expectNotForbiddenPage(page);
    await expect(page.getByRole("heading", { name: "客户管理" })).toBeVisible();
    await expect(page.getByRole("button", { name: "新增客户" })).toBeVisible();

    await page.goto("/admin/wholesale/people");
    await expectWorkspaceShell(page);
    await expectNotForbiddenPage(page);
    await expect(page.getByRole("heading", { name: "人员管理" })).toBeVisible();
    await expect(page.getByText("业务员账户").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "新增客户" })).toHaveCount(0);
  });

  test("wholesale claim page separates assisted, hall, and claimed orders", async ({
    page,
  }) => {
    await loginAs(page, "administrator");
    await page.goto("/admin/wholesale/order-claims");
    await expectWorkspaceShell(page);
    await expectNotForbiddenPage(page);

    await expect(page.getByRole("button", { name: /待分类/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /认领大厅/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /已认领/ })).toBeVisible();
    await expect(page.getByText("1688-LOCAL-003")).toBeVisible();
    await expect(page.getByText("Wholesale Beta").first()).toBeVisible();

    await page.getByRole("button", { name: /认领大厅/ }).click();
    await expect(page.getByText("1688-LOCAL-004")).toBeVisible();
    await expect(page.getByText("Unknown Buyer")).toBeVisible();

    await page.getByRole("button", { name: /已认领/ }).click();
    await expect(page.getByText("1688-LOCAL-001").first()).toBeVisible();
    await expect(page.getByText("1688-LOCAL-002").first()).toBeVisible();

    await page.getByRole("button", { name: /待分类/ }).click();
    await page
      .getByRole("button", { exact: true, name: "认领" })
      .first()
      .click();
    const claimDialog = page.getByRole("dialog", { name: "认领采购订单" });
    await expectSelectValue(
      claimDialog.getByLabel("客户"),
      "c1000000-0000-4000-8000-000000000002",
    );
    await expect(claimDialog.getByLabel("搜索批发订单")).toBeEnabled();
    // 候选订单由弹窗打开后的请求异步载入，使用可见性断言等待首项完成渲染。
    await expect(claimDialog.getByRole("checkbox").first()).toBeVisible();
  });

  test("salesman wholesale customer page shares customers but hides people management", async ({
    page,
  }) => {
    await loginAs(page, "salesman");
    await page.goto("/salesman/wholesale/customers");
    await expectWorkspaceShell(page);
    await expectNotForbiddenPage(page);

    await expect(page.getByRole("heading", { name: "客户管理" })).toBeVisible();
    await expect(page.getByText("Wholesale Alpha").first()).toBeVisible();
    await expect(page.getByText("Wholesale Beta").first()).toBeVisible();
    // 批发客户是全员协作数据，即使历史客户最初由其他岗位建立，业务员也应能继续跟进。
    await expect(page.getByText("Promoter Wholesale Shop").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "人员管理" })).toHaveCount(0);

    await page.goto("/salesman/wholesale/people");
    await expectForbiddenPage(page);

    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto("/salesman/wholesale/customers");
    await expect(page.getByRole("heading", { name: "客户管理" })).toBeVisible();
    await expect(page.getByRole("link", { name: "人员管理" })).toHaveCount(0);
    await expectNoDocumentHorizontalOverflow(page);
  });

  test("tourism order list can filter by ordered date range", async ({
    page,
  }) => {
    await loginAs(page, "administrator");
    await page.goto("/admin/tourism/orders");
    await expectWorkspaceShell(page);
    await expectNotForbiddenPage(page);

    const createdFromInput = page.getByLabel("下单日期从");
    const createdToInput = page.getByLabel("下单日期到");
    const clearFiltersButton = page.getByRole("button", {
      name: /清空筛选|恢复默认范围/,
    });
    const defaultRange = getLast30DaysDateRange();

    await expect(createdFromInput).toBeVisible();
    await expect(createdToInput).toBeVisible();
    await expectDateControlValue(createdFromInput, defaultRange.from);
    await expectDateControlValue(createdToInput, defaultRange.to);
    await page.waitForTimeout(1000);

    await fillDateControl(createdFromInput, "2099-01-01");
    await fillDateControl(createdToInput, "2099-01-31");

    await expectDateControlValue(createdFromInput, "2099-01-01");
    await expectDateControlValue(createdToInput, "2099-01-31");
    await expect(page.getByText("没有匹配结果")).toBeVisible();
    await expect(clearFiltersButton).toBeEnabled();

    await clearFiltersButton.click();

    await expectDateControlValue(createdFromInput, defaultRange.from);
    await expectDateControlValue(createdToInput, defaultRange.to);

    await fillDateControl(createdFromInput, "");
    await expectDateControlValue(createdFromInput, defaultRange.from);
    await expect(createdFromInput).toHaveAttribute("aria-invalid", "true");
  });
});

function visibleExactText(page: Page, text: string) {
  return page.getByText(text, { exact: true }).filter({ visible: true });
}

async function mockClipboard(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          window.localStorage.setItem("__lastCopiedInviteLink", value);
        },
      },
    });
  });
}

function getLast30DaysDateRange() {
  const today = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const to = today.toISOString().slice(0, 10);
  today.setUTCDate(today.getUTCDate() - 29);

  return {
    from: today.toISOString().slice(0, 10),
    to,
  };
}

async function expectNoDocumentHorizontalOverflow(page: Page) {
  const overflowPixels = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );

  expect(overflowPixels).toBeLessThanOrEqual(2);
}
