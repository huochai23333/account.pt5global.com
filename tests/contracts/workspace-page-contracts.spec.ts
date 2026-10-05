import assert from "node:assert/strict";
import { expect, test } from "@playwright/test";
import { expectWorkspacePageContent } from "../e2e/helpers/workspace-page-contracts";

// Independent literal HTML fixtures: do not generate them from the contract map.
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
    await assert.rejects(expectWorkspacePageContent(page, `/admin/${path}`, 100));
  });
  test(`${path}: business UI plus custom error must fail`, async ({ page }) => {
    await page.evaluate((path) => history.replaceState(null, "", `/admin/${path}`), path);
    await page.setContent(`<main><h1>${title}</h1>${controls}<h2>当前页面暂时打不开</h2></main>`);
    await assert.rejects(expectWorkspacePageContent(page, `/admin/${path}`, 100));
  });
}

for (const error of ["This page is temporarily unavailable", "页面出现异常", "Something went wrong", "这个页面不在你的工作范围内", "Application error:"]) {
  test(`accounts: reject ${error}`, async ({ page }) => {
    await page.evaluate(() => history.replaceState(null, "", "/admin/accounts"));
    await page.setContent(`<main><h1>账号管理</h1><label>搜索账号<input></label><h2>${error}</h2></main>`);
    await assert.rejects(expectWorkspacePageContent(page, "/admin/accounts", 100));
  });
}

test("wrong route with plausible content must fail", async ({ page }) => {
  await page.setContent('<main><h1>账号管理</h1><label>搜索账号<input></label></main>');
  await assert.rejects(expectWorkspacePageContent(page, "/admin/accounts", 100), /requested business page/);
});

test("unregistered route must fail rather than fall back to shell", async ({ page }) => {
  await assert.rejects(expectWorkspacePageContent(page, "/admin/new-unregistered-page", 100), /Missing independent workspace page contract/);
  expect(fixtures).toHaveLength(15);
});
