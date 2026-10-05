import assert from "node:assert/strict";
import { expect, test } from "@playwright/test";
import { expectWorkspacePageContent } from "../e2e/helpers/workspace-page-contracts";

// 独立手写页面夹具，不从被测约定表生成正文；正例先确认标题与控件能通过。
const fixtures = [
  ["accounts", "账号管理", '<label>搜索账号<input></label>'],
  ["announcements", "公告管理", '<button>新建公告</button>'],
  ["feedback", "问题反馈与改进建议", '<label>搜索<input></label>'],
  ["reviews", "审核中心", '<button>资料修改 0</button>'],
  ["settings", "汇率", '<label>原始货币<input></label>'],
  ["company-expenses", "公司费用", '<label>所属月份<input></label>'],
  ["wholesale/orders", "批发订单", '<label>搜索订单<input></label>'],
  ["wholesale/settlement-releases", "结汇发布", '<label>搜索收款<input></label>'],
  ["wholesale/logistics", "物流管理", '<label>店小秘店铺<input></label>'],
  ["wholesale/customers", "客户管理", '<label>搜索客户<input></label>'],
  ["wholesale/people", "人员管理", '<label>搜索账号<input></label>'],
  ["wholesale/vip", "VIP管理", '<label>搜索客户<input></label>'],
  ["wholesale/referrals", "推荐树", '<label>搜索客户<input></label>'],
  ["wholesale/commission", "佣金", '<label>搜索佣金<input></label>'],
  ["wholesale/incentives", "提成", '<label>搜索提成<input></label>'],
] as const;

test.beforeEach(async ({ page }) => {
  // Fully synthetic browser documents; no app server, account helper or backend.
  await page.route("**/*", (route) => route.abort("blockedbyclient"));
  await page.route("http://localhost/__contract/**", (route) => route.fulfill({ body: "<!doctype html><html><body></body></html>", contentType: "text/html" }));
  await page.goto("http://localhost/__contract/start");
});

for (const [path, title, controls] of fixtures) {
  test(`${path}: real business heading and control pass`, async ({ page }) => {
    await page.evaluate((path) => history.replaceState(null, "", `/admin/${path}`), path);
    await page.setContent(`<h1>PT5 系统</h1><main><h1>${title}</h1>${controls}</main>`);
    await expectWorkspacePageContent(page, `/admin/${path}`, 100);
  });
  test(`${path}: shell and heading alone must fail`, async ({ page }) => {
    await page.evaluate((path) => history.replaceState(null, "", `/admin/${path}`), path);
    await page.setContent(`<h1>PT5 系统</h1><main><h1>${title}</h1></main>`);
    await assert.rejects(expectWorkspacePageContent(page, `/admin/${path}`, 100), /page-contract:business-control/);
  });
  test(`${path}: business UI plus custom error must fail`, async ({ page }) => {
    await page.evaluate((path) => history.replaceState(null, "", `/admin/${path}`), path);
    await page.setContent(`<main><h1>${title}</h1>${controls}<h2>当前页面暂时打不开</h2></main>`);
    await assert.rejects(expectWorkspacePageContent(page, `/admin/${path}`, 100), /page-contract:error-heading/);
  });
}

for (const error of ["This page is temporarily unavailable", "页面出现异常", "Something went wrong", "这个页面不在你的工作范围内", "Application error:"]) {
  test(`accounts: reject ${error}`, async ({ page }) => {
    await page.evaluate(() => history.replaceState(null, "", "/admin/accounts"));
    await page.setContent(`<main><h1>账号管理</h1><label>搜索账号<input></label><h2>${error}</h2></main>`);
    await assert.rejects(expectWorkspacePageContent(page, "/admin/accounts", 100),
      error === "Application error:" ? /page-contract:framework-error/ : /page-contract:error-heading/);
  });
}

test("wrong route with plausible content must fail", async ({ page }) => {
  await page.setContent('<main><h1>账号管理</h1><label>搜索账号<input></label></main>');
  await assert.rejects(expectWorkspacePageContent(page, "/admin/accounts", 100), /requested business page/);
});

for (const [name, body, failure] of [
  ["hidden heading", '<main><h1 hidden>账号管理</h1><label>搜索账号<input></label></main>', /page-contract:business-heading/],
  ["hidden control", '<main><h1>账号管理</h1><label hidden>搜索账号<input></label></main>', /page-contract:business-control/],
  ["control outside main", '<aside><label>搜索账号<input></label></aside><main><h1>账号管理</h1></main>', /page-contract:business-control/],
  ["duplicate main", '<main><h1>账号管理</h1><label>搜索账号<input></label></main><main></main>', /page-contract:main-count/],
  ["framework overlay", '<main><h1>账号管理</h1><label>搜索账号<input></label></main><nextjs-portal><div data-nextjs-dialog></div></nextjs-portal>', /page-contract:error-overlay/],
] as const) {
  test(`isolated page fault: ${name}`, async ({ page }) => {
    await page.evaluate(() => history.replaceState(null, "", "/admin/accounts"));
    await page.setContent(body);
    // 核对具体断言失败，防止页面初始化或定位器的无关异常让负例假通过。
    await assert.rejects(expectWorkspacePageContent(page, "/admin/accounts", 100), failure);
  });
}

for (const width of [1440, 390]) {
  test(`synthetic business page survives reload at width ${width}`, async ({ page }) => {
    // 这是受控文档的两种视口验证，不是登录后的真实业务页面验收。
    await page.setViewportSize({ width, height: 900 });
    await page.route("http://localhost/admin/accounts", (route) => route.fulfill({
      // HTTP 返回必须声明 UTF-8；否则浏览器可能按默认编码解析中文标题。
      contentType: "text/html; charset=utf-8", body: '<!doctype html><meta charset="utf-8"><main><h1>账号管理</h1><label>搜索账号<input></label></main>',
    }));
    await page.goto("http://localhost/admin/accounts");
    await expectWorkspacePageContent(page, "/admin/accounts", 100);
    await page.reload();
    await expectWorkspacePageContent(page, "/admin/accounts", 100);
  });
}

test("unregistered route must fail rather than fall back to shell", async ({ page }) => {
  await assert.rejects(expectWorkspacePageContent(page, "/admin/new-unregistered-page", 100), /Missing independent workspace page contract/);
  expect(fixtures).toHaveLength(15);
});
