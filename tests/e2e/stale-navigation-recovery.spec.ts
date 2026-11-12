import { expect, test } from "@playwright/test";

import { expectWorkspaceShell, loginAs } from "./helpers/auth";

// 三例只区分客户端切换与整页文档请求；Date.now推进仅在当前测试页面，不修改服务端或数据库时钟。
// 新测试上下文会隔离这次时间替身；这些场景没有验证真实锁屏、BFCache或长时间网络断开。

test("正常使用时仍保留快速的客户端板块切换", async ({ page }) => {
  await loginAs(page, "administrator");

  let fullPageRequestCount = 0;
  page.on("request", (request) => {
    if (
      request.isNavigationRequest() &&
      request.resourceType() === "document" &&
      new URL(request.url()).pathname === "/admin/announcements"
    ) {
      fullPageRequestCount += 1;
    }
  });

  await page
    .locator('aside a[href="/admin/announcements"]')
    .click();

  await expect(page).toHaveURL(/\/admin\/announcements(?:[?#].*)?$/);
  await expectWorkspaceShell(page);

  // 没有闲置时继续使用 Next.js 的客户端切换，只有旧页面恢复场景才付出整页加载成本。
  expect(fullPageRequestCount).toBe(0);
});

test("工作台持续可见但闲置后会用整页加载打开其他板块", async ({ page }) => {
  await loginAs(page, "administrator");

  const announcementsLink = page.locator(
    'aside a[href="/admin/announcements"]',
  );

  await expect(announcementsLink).toBeVisible();

  // 不实际等待三分钟，而是只把当前页面里的时间向后推进。
  // 页面挂载时记录的上次活动时间仍是原值，因此下一次 pointerdown 会被识别为长时间闲置后的首次操作。
  await page.evaluate(() => {
    const realDateNow = Date.now.bind(Date);
    Date.now = () => realDateNow() + 181_000;
  });

  const fullPageRequest = page.waitForRequest(
    (request) =>
      request.isNavigationRequest() &&
      request.resourceType() === "document" &&
      new URL(request.url()).pathname === "/admin/announcements",
  );

  await Promise.all([fullPageRequest, announcementsLink.click()]);

  await expect(page).toHaveURL(/\/admin\/announcements(?:[?#].*)?$/);
  await expectWorkspaceShell(page);
  await expect(
    page.getByRole("heading", { name: "公告管理", exact: true }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("移动端闲置恢复后导航和页面宽度保持正常", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await loginAs(page, "administrator");

  const mobileHeader = page.locator("header").first();
  await mobileHeader
    .getByRole("button", { name: "首页", exact: true })
    .click();

  const announcementsLink = mobileHeader.locator(
    'nav a[href="/admin/announcements"]',
  );
  await expect(announcementsLink).toBeVisible();

  // 移动浏览器也可能在锁屏或切回应用后继续保留旧页面。
  // 时间推进后点击菜单项，应该与桌面端一样发起新的整页文档请求。
  await page.evaluate(() => {
    const realDateNow = Date.now.bind(Date);
    Date.now = () => realDateNow() + 181_000;
  });

  const fullPageRequest = page.waitForRequest(
    (request) =>
      request.isNavigationRequest() &&
      request.resourceType() === "document" &&
      new URL(request.url()).pathname === "/admin/announcements",
  );

  await Promise.all([fullPageRequest, announcementsLink.click()]);

  await expect(page).toHaveURL(/\/admin\/announcements(?:[?#].*)?$/);
  await expectWorkspaceShell(page);
  await expect(
    page.getByRole("heading", { name: "公告管理", exact: true }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  // 页面总宽度不能超过视口，否则移动端会出现按钮被压缩、文字被挤窄或整页横向滚动。
  const hasHorizontalOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );

  expect(hasHorizontalOverflow).toBe(false);
}
