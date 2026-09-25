import { expect, type Page } from "@playwright/test";

/** 页面为首屏紧凑展示而收起条件；操作次级日期或月份前先按用户方式展开。 */
export async function expandOrderFilters(page: Page) {
  const trigger = page.getByRole("button", { name: /更多筛选条件/ });
  const dateToolbar = page.getByRole("group", { name: "日期快捷范围" });
  // 认领页默认展开、订单页则先折叠；等其中一种就绪状态出现后再决定是否点击。
  await expect.poll(async () => await trigger.isVisible() || await dateToolbar.isVisible()).toBe(true);
  if (await trigger.isVisible()) await trigger.click();
}
