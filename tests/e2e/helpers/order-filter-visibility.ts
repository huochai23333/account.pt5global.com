import type { Page } from "@playwright/test";

/** 页面为首屏紧凑展示而收起条件；操作次级日期或月份前先按用户方式展开。 */
export async function expandOrderFilters(page: Page) {
  const trigger = page.getByRole("button", { name: /更多筛选条件/ });
  if (await trigger.isVisible()) await trigger.click();
}
