import { expect, test, type Page } from "@playwright/test";

import {
  expectForbiddenPage,
  expectNotForbiddenPage,
  expectWorkspaceShell,
  loginAs,
  type RegressionRole,
} from "./helpers/auth";

const INTERNAL_RATE_VIEWERS = [
  { role: "administrator", workspace: "/admin" },
  { role: "operator", workspace: "/operator" },
  { role: "salesman", workspace: "/salesman" },
  { role: "finance", workspace: "/finance" },
] as const satisfies readonly {
  role: RegressionRole;
  workspace: string;
}[];

const NO_BUSINESS_RATE_VIEWERS = [
  { role: "manager", workspace: "/manager" },
  { role: "promoter", workspace: "/promoter" },
  { role: "recruiter", workspace: "/recruiter" },
] as const satisfies readonly {
  role: RegressionRole;
  workspace: string;
}[];

test.describe("汇率展示权限", () => {
  for (const viewer of INTERNAL_RATE_VIEWERS) {
    test(`${viewer.role} 可以从工作台查看汇率`, async ({ page }) => {
      await loginAs(page, viewer.role);
      await page.goto(`${viewer.workspace}/home`);

      const sidebar = page.locator("aside").first();
      const exchangeRateLink = sidebar.getByRole("link", {
        exact: true,
        name: "汇率",
      });
      await expect(exchangeRateLink).toHaveAttribute(
        "href",
        `${viewer.workspace}/settings`,
      );

      await exchangeRateLink.click();
      await expect(page).toHaveURL(
        new RegExp(`${viewer.workspace}/settings(?:[?#].*)?$`),
      );
      await expectWorkspaceShell(page);
      await expectNotForbiddenPage(page);
      await expect(
        page.getByRole("heading", { exact: true, name: "最新汇率" }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { exact: true, name: "历史记录" }),
      ).toBeVisible();

      if (viewer.role === "administrator") {
        await expect(
          page.getByRole("button", { exact: true, name: "新增汇率" }),
        ).toBeVisible();
        await expect(
          page.getByRole("button", { exact: true, name: "立即获取" }),
        ).toBeVisible();
        await expect(
          page.getByRole("button", { exact: true, name: "按日期补充" }),
        ).toBeVisible();
      } else {
        await expectManagementActionsHidden(page);
      }

      await expectNoHorizontalOverflow(page);
    });
  }

  test("财务账号在移动端只查看汇率并能使用完整导航", async ({ page }) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await loginAs(page, "finance");
    await page.goto("/finance/settings");

    const mobileHeader = page.locator("header").first();
    await mobileHeader
      .getByRole("button", { exact: true, name: "汇率" })
      .click();
    await expect(
      mobileHeader.getByRole("link", { exact: true, name: "汇率" }),
    ).toBeVisible();

    await expect(
      page.getByRole("heading", { exact: true, name: "最新汇率" }),
    ).toBeVisible();
    await expectManagementActionsHidden(page);
    await expectNoHorizontalOverflow(page);
  });

  for (const viewer of NO_BUSINESS_RATE_VIEWERS) {
    test(`${viewer.role} 没有启用业务时不能绕过说明页查看汇率`, async ({ page }) => {
      await loginAs(page, viewer.role);

      // 全局汇率页也必须服从当前业务访问表；知道地址不能绕过“暂无可用业务”的终态。
      await page.goto(`${viewer.workspace}/settings`);
      await expect(page).toHaveURL(/\/business-unavailable(?:[?#].*)?$/);
      await expect(
        page.getByRole("heading", { name: "当前没有可使用的业务" }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { exact: true, name: "最新汇率" }),
      ).toHaveCount(0);
      await expectNoHorizontalOverflow(page);
    });
  }

  test("客户没有汇率入口且不能打开独立汇率页面", async ({ page }) => {
    await loginAs(page, "client");
    await page.goto("/client/home");

    await expect(
      page.locator("aside").first().getByRole("link", {
        exact: true,
        name: "汇率",
      }),
    ).toHaveCount(0);

    await page.goto("/client/settings");
    await expectForbiddenPage(page);
  });
});

async function expectManagementActionsHidden(page: Page) {
  for (const actionName of [
    "新增汇率",
    "立即获取",
    "按日期补充",
    "编辑",
    "删除",
  ]) {
    await expect(
      page.getByRole("button", { exact: true, name: actionName }),
    ).toHaveCount(0);
  }

  await expect(page.getByText("自动获取当日汇率", { exact: true })).toHaveCount(
    0,
  );
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflowPixels = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );

  expect(overflowPixels).toBeLessThanOrEqual(2);
}
