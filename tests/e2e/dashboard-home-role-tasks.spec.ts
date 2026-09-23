import { expect, test } from "@playwright/test";

import { expectNotForbiddenPage, loginAs } from "./helpers/auth";

for (const item of [
  { role: "administrator", home: "/admin/home", name: "处理账号", target: /\/admin\/accounts$/ },
  { role: "finance", home: "/finance/home", name: "处理结汇发布", target: /\/finance\/wholesale\/settlement-releases$/ },
  { role: "salesman", home: "/salesman/home", name: "跟进线索", target: /\/salesman\/wholesale\/leads$/ },
  { role: "client", home: "/client/home", name: "查看批发订单", target: /\/client\/wholesale\/orders$/ },
  { role: "operator", home: "/operator/home", name: "登记报销", target: /\/operator\/reimbursements$/ },
] as const) {
  test(`${item.role} 首页显示岗位入口并可进入工作页面`, async ({ page }) => {
    await page.setViewportSize({ width: item.role === "client" ? 390 : 1440, height: 844 });
    await loginAs(page, item.role);
    await page.goto(item.home);
    await expect(page.getByRole("heading", { name: "常用工作" })).toBeVisible();
    const link = page.getByRole("link", { name: item.name });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(item.target);
    await expectNotForbiddenPage(page);
    await page.reload();
    await expectNotForbiddenPage(page);
    if (item.role === "client") {
      // 首屏入口与手机宽度都要可用，不能让用户横向寻找工作入口。
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(2);
    }
  });
}
