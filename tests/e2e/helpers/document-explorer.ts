import { expect, type Page, type Locator } from "@playwright/test";
import { documentAdmin, cleanupDocuments } from "./document-library";
/** 验收操作全部来自真实页面；后台客户端仅用于独立核对及按测试前缀清理。 */
export async function createFolder(page: Page, name: string) {
  await expect(page.locator("[data-explorer-create]")).toBeEnabled();
  const parent = (
    await (
      await page.request.get(
        `/api/document-library${new URL(page.url()).search}`,
      )
    ).json()
  ).folderId;
  expect(parent).toMatch(/^[a-f0-9-]{36}$/);
  await page.locator("[data-explorer-create]").click();
  const input = page.locator("[data-inline-name]");
  await expect(input).toBeFocused();
  await input.fill(name);
  await input.press("Enter");
  await expect(input).toHaveCount(0);
  const result = await documentAdmin()
    .from("document_folders")
    .select("*")
    .eq("name", name)
    .eq("parent_id", parent)
    .single();
  expect(result.error).toBeNull();
  return result.data!;
}
/** 查询后的条目会先显示，再解除操作锁；必须等可交互状态，不以旧 DOM 存在代替就绪。 */
export async function chooseRow(page: Page, id: string) {
  const row = page.locator(`[data-explorer-item="${id}"]`);
  await expect(row.getByRole("checkbox")).toBeEnabled();
  await row.click();
}
/** 通过当前可见菜单触发领域操作。 */
export async function openItemMenu(page: Page, row: Locator, action: string) {
  await row.click({ button: "right" });
  await page.getByRole("menuitem", { name: action, exact: true }).click();
}
export async function enterFolder(page: Page, id: string) {
  const row = page.locator(`[data-explorer-item="${id}"]`);
  await expect(row.getByRole("checkbox")).toBeEnabled();
  await row.dblclick();
  await expect(page).toHaveURL(new RegExp(`folder=${id}`));
  await expect(page.locator("[data-document-content]")).toHaveAttribute(
    "aria-busy",
    "false",
  );
}
export async function confirmDeletion(page: Page) {
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox", { name: /我确认永久删除/ }).check();
  await dialog.getByRole("button", { name: "确认", exact: true }).click();
  await expect(dialog).toHaveCount(0, { timeout: 60000 });
}
/** 同一限定清理流程供资源管理器用例复用，失败由原用例负责报告。 */
export async function clean(prefix: string) {
  await cleanupDocuments(prefix);
}
