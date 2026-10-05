import { expect, type Page } from "@playwright/test";

// Fixed user-facing contracts, not values imported from application translations.
// The second locator belongs to the business content inside main, not navigation.
export const workspacePageContracts = {
  accounts: { title: "账号管理", label: "搜索账号" },
  announcements: { title: "公告管理", button: "新建公告" },
  feedback: { title: "问题反馈与改进建议", label: "搜索" },
  reviews: { title: "审核中心", button: "资料修改" },
  settings: { title: "汇率", label: "原始货币" },
  "company-expenses": { title: "公司费用", label: "所属月份" },
  "wholesale/orders": { title: "批发订单", label: "搜索订单" },
  "wholesale/settlement-releases": { title: "结汇发布", label: "搜索收款" },
  "wholesale/logistics": { title: "物流管理", label: "店小秘店铺" },
  "wholesale/customers": { title: "客户管理", label: "搜索客户" },
  "wholesale/people": { title: "人员管理", label: "搜索账号" },
  "wholesale/vip": { title: "VIP管理", label: "搜索客户" },
  "wholesale/referrals": { title: "推荐树", label: "搜索客户" },
  "wholesale/commission": { title: "佣金", label: "搜索佣金" },
  "wholesale/incentives": { title: "提成", label: "搜索提成" },
} as const;

export async function expectWorkspacePageContent(page: Page, workspacePath: string, timeout = 10_000) {
  const match = /^\/(admin|salesman|finance)\/(.+)$/.exec(workspacePath);
  const key = match?.[2] as keyof typeof workspacePageContracts;
  const contract = workspacePageContracts[key];
  if (!contract) throw new Error(`Missing independent workspace page contract: ${workspacePath}`);
  expect(new URL(page.url()).pathname, "must remain on the requested business page").toBe(workspacePath);
  const main = page.locator("main");
  await expect(main).toHaveCount(1, { timeout });
  await expect(main.getByRole("heading", { name: contract.title, exact: true })).toBeVisible({ timeout });
  if ("label" in contract) {
    await expect(main.getByLabel(contract.label, { exact: true })).toBeVisible({ timeout });
  } else {
    await expect(main.getByRole("button", { name: new RegExp(`^${contract.button}`) })).toBeVisible({ timeout });
  }
  await expect(page.getByRole("heading", {
    name: /当前页面暂时打不开|This page is temporarily unavailable|页面出现异常|Something went wrong|这个页面不在你的工作范围内/,
  })).toHaveCount(0, { timeout });
  await expect(page.locator("body")).not.toContainText("Application error:", { timeout });
  await expect(page.locator("nextjs-portal [data-nextjs-dialog], nextjs-portal [data-nextjs-dialog-overlay]")).toHaveCount(0, { timeout });
}
