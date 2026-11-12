import { expect, type Page } from "@playwright/test";
import { test } from "./helpers/logistics-assignment-case";

// 后一场景核对前一场景的真实收尾，必须在同一worker按文件顺序执行。
test.describe.configure({ mode: "serial" });

let opened: Page[] = [];

// 只验证真实浏览器的命名夹具收尾；不请求storeCase、不登录、不使用产品页面或数据库。
test("两角色页面中途断言失败仍进入夹具收尾", async ({
  browser,
  trackLogisticsPage,
}) => {
  test.fail(true, "故意中断正文，下一场景独立核对两个上下文均关闭");
  opened = [];
  for (let i = 0; i < 2; i++) {
    const page = await browser.newPage();
    trackLogisticsPage(page);
    opened.push(page);
  }
  expect(opened).toHaveLength(2);
  expect(browser.contexts()).toHaveLength(2);
  throw new Error("controlled_logistics_role_assertion_failure");
});

test("独立核对两个角色页面与上下文已关闭", async ({ browser }, info) => {
  expect(opened).toHaveLength(2);
  expect(opened.every((page) => page.isClosed())).toBe(true);
  expect(browser.contexts()).toHaveLength(0);
  await info.attach("two-role-pages-final", {
    body: Buffer.from(JSON.stringify({ pagesClosed: 2, contextsRemaining: 0 })),
    contentType: "application/json",
  });
});

test("第二角色创建前失败也会回收第一页面", async ({
  browser,
  trackLogisticsPage,
}) => {
  test.fail(true, "故意在第二页面创建前中断，验证已登记资源不会泄漏");
  const first = await browser.newPage();
  trackLogisticsPage(first);
  opened = [first];
  expect(browser.contexts()).toHaveLength(1);
  throw new Error("controlled_logistics_second_role_not_created");
});

test("独立核对提前中断留下的页面已关闭", async ({ browser }, info) => {
  expect(opened).toHaveLength(1);
  expect(opened[0].isClosed()).toBe(true);
  expect(browser.contexts()).toHaveLength(0);
  await info.attach("one-role-page-final", {
    body: Buffer.from(JSON.stringify({ pagesClosed: 1, contextsRemaining: 0 })),
    contentType: "application/json",
  });
});
