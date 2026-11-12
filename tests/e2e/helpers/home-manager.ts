import { expect, type Page } from "@playwright/test";

// 管理弹窗的打开与重置是页面动作；900ms 只是原等待点，不是独立数据库保存凭证。
export async function openHomeManager(page: Page) {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.getByTestId("home-manage-button").click();
  await expect(page.getByRole("dialog", { name: "管理首页" })).toBeVisible();
}

export async function resetHomeLayout(page: Page, path: string = "/admin/home") {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto(path);
  await openHomeManager(page);
  await resetHomeLayoutFromOpenDialog(page);
}

export async function resetHomeLayoutFromOpenDialog(page: Page) {
  const manager = page.getByRole("dialog", { name: "管理首页" });

  await manager.getByTestId("home-manager-reset").click();
  /*
   * 如果本来就是默认布局，不会产生重复保存请求。这里沿用原 900ms 等待和错误检查，
   * 不能用固定延时证明后端已保存；实际终态仍需独立数据库与刷新核对。
   */
  await page.waitForTimeout(900);
  await expect(
    manager.getByText("首页调整还没有保存，请检查网络后重试。"),
  ).toHaveCount(0);
  await manager.getByTestId("home-manager-done").click();
}
