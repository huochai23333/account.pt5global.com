import { expect, test, type Page } from "@playwright/test";
import { loginAs, setTestLocale } from "./helpers/auth";
import { getRegressionAccount } from "./helpers/accounts";
import { createCommissionMergeFixture } from "./helpers/commission-merge-fixture";
import { stabilizeVisualPage } from "./helpers/design-system-visual";
import {
  feeSqlValue as q,
  runWholesaleFeeSql as sql,
} from "./helpers/wholesale-fee-database";

const fixture = createCommissionMergeFixture();
const orderId = fixture.order.id;
const orderNumber = fixture.order.number;
const panel = (page: Page, board: string) =>
  page.locator(`[data-commission-board="${board}"]`);

// 仅创建本文件拥有的订单，避免修改种子提成；结算结果通过独立 psql 查询确认。
test.use({ actionTimeout: 15_000, video: "off" });
test.beforeAll(async ({}, info) => {
  await fixture.prepare(info);
});

test.afterAll(async () => {
  await fixture.cleanup();
});

test.afterEach(async ({ page }) => {
  // 等待页面请求结束再比对夹具，失败请求不能与收尾删除竞争。
  if (!page.isClosed()) {
    await page.unrouteAll({ behavior: "wait" });
    await page.close();
  }
  fixture.order.assertUnchanged();
});

test("中英文桌面和手机只有一个入口，切换保留筛选和分页，地址可刷新恢复", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await stabilizeVisualPage(page);
  await loginAs(page, "administrator");
  for (const locale of ["zh", "en"] as const) {
    await setTestLocale(page, locale);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/wholesale/commission");
    const title = locale === "zh" ? "提成与佣金" : "Incentives & Commissions";
    const incentives =
      locale === "zh" ? "业务员提成" : "Salesperson Incentives";
    const referrals =
      locale === "zh" ? "客户推荐佣金" : "Customer Referral Commissions";
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    const sidebar = page.locator("aside").first();
    await expect(
      sidebar.getByRole("link", { name: title, exact: true }),
    ).toHaveCount(1);
    await expect(page.locator('a[href$="/incentives"]')).toHaveCount(0);
    const navSearch = sidebar.getByRole("searchbox", {
      name: locale === "zh" ? "搜索板块" : "Search sections",
    });
    await navSearch.fill(locale === "zh" ? "提成" : "Incentives");
    await expect(
      sidebar.locator('nav a[href="/admin/wholesale/commission"]'),
    ).toBeVisible();
    await expect(sidebar.locator("nav a")).toHaveCount(1);
    await navSearch.fill("");
    const search = panel(page, "salesman").getByRole("searchbox");
    const next = panel(page, "salesman").getByRole("button", {
      name: locale === "zh" ? "下一页" : "Next",
      exact: true,
    });
    await next.click();
    const firstOrder = await panel(page, "salesman")
      .getByRole("row")
      .nth(1)
      .getByRole("cell")
      .first()
      .textContent();
    await page.getByRole("button", { name: referrals, exact: true }).click();
    await expect(page).toHaveURL(/board=referrals/);
    const referralSearch = panel(page, "referrals").getByRole("searchbox");
    await referralSearch.fill("NO-MATCH-MERGE");
    await expect(
      panel(page, "referrals").getByText(
        locale === "zh" ? "暂无匹配佣金" : "No matching commission yet",
        { exact: true },
      ),
    ).toBeVisible();
    await page.getByRole("button", { name: incentives, exact: true }).click();
    await expect(
      panel(page, "salesman").getByRole("row").nth(1).getByRole("cell").first(),
    ).toHaveText(firstOrder!);
    await search.fill(orderNumber);
    await expect(panel(page, "salesman").getByRole("row").nth(1)).toContainText(
      orderNumber,
    );
    await page.getByRole("button", { name: referrals, exact: true }).click();
    await expect(referralSearch).toHaveValue("NO-MATCH-MERGE");
    await page.getByRole("button", { name: incentives, exact: true }).click();
    await expect(search).toHaveValue(orderNumber);
    await page.goBack();
    await expect(panel(page, "referrals")).toBeVisible();
    await page.reload();
    await expect(panel(page, "referrals")).toBeVisible();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const board of [referrals, incentives]) {
        await page.getByRole("button", { name: board, exact: true }).click();
        // 等待共享标签滑块到达最终位置，避免把动画中间帧作为交付截图。
        const active = page.locator(
          '[data-motion-segmented-tabs] button[aria-pressed="true"]',
        );
        await expect
          .poll(async () =>
            active.evaluate((button) => {
              const marker = button.querySelector("span.absolute");
              return marker
                ? Math.abs(
                    marker.getBoundingClientRect().x -
                      button.getBoundingClientRect().x,
                  )
                : 999;
            }),
          )
          .toBeLessThan(2);
        await page.addStyleTag({
          content:
            "*,*::before,*::after{animation:none!important;transition:none!important}",
        });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        ).toBe(true);
        await expect(
          page.locator("nextjs-portal [data-nextjs-dialog]"),
        ).toHaveCount(0);
        await page.screenshot({
          path: test
            .info()
            .outputPath(
              `${locale}-${width}-${board === incentives ? "salesman" : "referrals"}.png`,
            ),
          animations: "disabled",
        });
      }
    }
  }
  expect(errors).toEqual([]);
});

for (const role of [
  "administrator",
  "salesman",
  "finance",
  "client",
] as const) {
  test(`${role} 的标签及金额与独立数据库查询一致`, async ({ page }) => {
    test.setTimeout(120_000);
    const account = getRegressionAccount(role);
    const userId = sql(
      `select id from auth.users where email=${q(account.email)};`,
    );
    const workspace = role === "administrator" ? "admin" : role;
    await loginAs(page, role);
    await page.goto(`/${workspace}/wholesale/commission?board=salesman`);
    await expect(
      page.getByRole("heading", { name: "提成与佣金", exact: true }),
    ).toBeVisible();
    if (role === "client") {
      await expect(panel(page, "salesman")).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "业务员提成", exact: true }),
      ).toHaveCount(0);
      await expect(panel(page, "referrals")).toBeVisible();
    } else {
      const condition =
        role === "administrator" ? "true" : `beneficiary_user_id=${q(userId)}`;
      const amount = sql(
        `select coalesce(sum(commission_amount_rmb),0) from public.wholesale_commissions where ${condition};`,
      );
      const total = new Intl.NumberFormat("zh-CN", {
        style: "currency",
        currency: "CNY",
      }).format(Number(amount));
      await expect(
        panel(page, "salesman")
          .locator('[data-slot="metric-card"]')
          .filter({ hasText: "提成合计" }),
      ).toContainText(total);
      if (role !== "administrator")
        await expect(
          panel(page, "salesman").getByRole("button", { name: "标记结算" }),
        ).toHaveCount(0);
      await page
        .getByRole("button", { name: "客户推荐佣金", exact: true })
        .click();
    }
    // 以相同身份直接进入 PostgreSQL 验证推荐佣金，独立于页面返回值及浏览器 SDK。
    const expected = JSON.parse(
      sql(`begin; set local role authenticated;
      set local request.jwt.claims=${q(JSON.stringify({ sub: userId, role: "authenticated" }))};
      select jsonb_build_object('count',count(*),'amount',coalesce(sum(amount),0)) from public.get_wholesale_referral_commission_rows(); rollback;`),
    );
    const amount = new Intl.NumberFormat("zh-CN", {
      style: "currency",
      currency: "CNY",
    }).format(Number(expected.amount));
    const total = panel(page, "referrals")
      .locator('[data-slot="metric-card"]')
      .filter({ hasText: "佣金合计" });
    const count = panel(page, "referrals")
      .locator('[data-slot="metric-card"]')
      .filter({ hasText: "月度记录" });
    await expect(total).toContainText(amount);
    await expect(count).toContainText(String(expected.count));
    await page.reload();
    await expect(total).toContainText(amount);
    await expect(count).toContainText(String(expected.count));
  });
}

test("管理员从合并页结算提成，刷新及重复访问保持同一最终记录", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await loginAs(page, "administrator");
  await page.goto("/admin/wholesale/commission");
  await panel(page, "salesman").getByRole("searchbox").fill(orderNumber);
  const row = panel(page, "salesman")
    .getByRole("row")
    .filter({ hasText: orderNumber });
  const before = fixture.order.snapshot().commissions[0];
  expect(before.status).toBe("pending");
  expect(Number(before.commission_amount_rmb)).toBeGreaterThan(0);
  // 受控负例只改变浏览器收到的回执：零行不能显示成功，也不能改变真实记录。
  await page.route("**/rest/v1/wholesale_commissions?**", async (route) => {
    const url = new URL(route.request().url());
    // 只拦截本次拥有的提成，不能把另一订单的写入也变成零影响。
    if (
      route.request().method() !== "PATCH" ||
      url.searchParams.get("id") !== `eq.${before.id}`
    )
      return route.continue();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
    });
  });
  await row.getByRole("button", { name: "标记结算" }).click();
  await expect(
    page.getByText("操作没有成功，请检查内容和权限后再试。", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("提成已标记为已结算。", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "标记结算", exact: true }).first(),
  ).toBeEnabled();
  fixture.order.assertUnchanged();
  await page.unroute("**/rest/v1/wholesale_commissions?**");
  await row.getByRole("button", { name: "标记结算" }).click();
  await expect
    .poll(
      () =>
        sql(
          `select status from public.wholesale_commissions where id=${q(String(before.id))};`,
        ),
      { timeout: 15_000 },
    )
    .toBe("settled");
  const receipt = fixture.order.confirmSettlement();
  expect(receipt.settled_at).toBeTruthy();
  await expect(row).toContainText("已结算");
  await page.reload();
  await panel(page, "salesman").getByRole("searchbox").fill(orderNumber);
  await expect(row).toContainText("已结算");
  await expect(row.getByRole("button", { name: "标记结算" })).toBeDisabled();
  expect(
    sql(
      `select count(*) from public.wholesale_commissions where order_id=${q(orderId)};`,
    ),
  ).toBe("1");
  fixture.order.assertUnchanged();
  console.log("commission settlement receipt", receipt);
});

for (const role of ["manager", "promoter"] as const) {
  test(`${role} 保持现有批发访问边界`, async ({ page }) => {
    await loginAs(page, role);
    await page.goto(`/${role}/wholesale/commission`);
    // 这些本地种子账号没有启用批发业务，合并页面不能替它们新增业务资格。
    await expect(page).toHaveURL(/\/business-unavailable$/);
    await expect(
      page.getByRole("heading", { name: "当前没有可使用的业务", exact: true }),
    ).toBeVisible();
    await expect(page.locator("[data-commission-board]")).toHaveCount(0);
  });
}

test("独立提成地址已移除，未知标签使用当前身份的默认标签", async ({ page }) => {
  await loginAs(page, "administrator");
  await page.goto("/admin/wholesale/incentives");
  await expect(page.getByText("你访问的页面不存在")).toBeVisible();
  await page.goto("/admin/wholesale/commission?board=unknown");
  await expect(panel(page, "salesman")).toBeVisible();
});

test("真实查询失败显示加载错误，恢复后可重新加载", async ({ page }) => {
  test.setTimeout(120_000);
  await loginAs(page, "administrator");
  // 专属实例中的真实读取故障；恢复前核对完整目录与版本，不按固定名称盲目恢复。
  try {
    fixture.fault.install();
    await page.goto("/admin/wholesale/commission");
    await expect(panel(page, "salesman")).toBeVisible();
    await page
      .getByRole("button", { name: "客户推荐佣金", exact: true })
      .click();
    await expect(panel(page, "referrals").getByRole("alert")).toContainText(
      "客户推荐佣金暂时没有加载成功，请刷新页面后重试。",
    );
    await expect(page.getByText("暂无匹配佣金")).toHaveCount(0);
    await expect(panel(page, "referrals").getByRole("searchbox")).toHaveCount(
      0,
    );
  } finally {
    fixture.fault.restore();
  }
  await page.getByRole("button", { name: "重新加载", exact: true }).click();
  await expect(panel(page, "referrals").getByRole("searchbox")).toBeVisible();
});
