import { test as base, expect, type Page } from "@playwright/test";
import { documentAdmin } from "./document-library";
import { clean } from "./document-explorer";
import { requireDocumentFixtureDatabase, runDocumentFixtureSql } from "./document-write-lock";
import { cleanupTemplateDraftRecords } from "../../test-support/template-draft-cleanup";

/** 自动夹具在任何页面操作之前核对同一专属Web/API/DB；认证仍走原测试入口。 */
export const test = base.extend<{ draftIsolation: void }>({
  draftIsolation: [
    async ({ baseURL }, use) => {
      if (baseURL !== process.env.PLAYWRIGHT_BASE_URL) throw new Error("draft_case_web_target_mismatch");
      requireDocumentFixtureDatabase();
      await use();
    },
    { auto: true },
  ],
});
const owners = new WeakMap<string[], string>();

/** 只负责组装真实页面操作；新编号立即登记，保存后再从数据库捕获归属。 */
export async function openDraft(page: Page, ids: string[], workspace = "salesman", folder?: string) {
  await page.goto(`/${workspace}/company-templates${folder ? `?folder=${folder}` : ""}`);
  await page.getByRole("button", { name: "新建文档", exact: true }).first().click();
  await expect(page).toHaveURL(/\/documents\/drafts\/[a-f0-9-]+$/);
  const id = page.url().split("/").pop()!;
  expect(id).toMatch(/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
  ids.push(id);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.frameLocator("iframe").locator("#client")).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: /^草稿已保存$/ })).toBeVisible();
  const saved = await draft(id);
  if (owners.has(ids) && owners.get(ids) !== saved.owner_id) throw new Error("draft_case_owner_changed");
  owners.set(ids, saved.owner_id);
  return id;
}

/** 独立读回不把空data或错误响应当成有草稿；页面成功提示只是中间信号。 */
export async function draft(id: string) {
  const result = await documentAdmin()
    .from("company_template_document_drafts")
    .select("*")
    .eq("id", id)
    .single();
  if (result.error) throw result.error;
  if (!result.data || typeof result.data.owner_id !== "string") throw new Error("draft_case_record_missing");
  return result.data;
}

/** 等实际路由处理结束，再关闭页面停止自动保存；未释放的测试闸门必须由所属用例先释放。 */
export async function settleDraftPage(page: Page) {
  if (page.isClosed()) return;
  await page.unrouteAll({ behavior: "wait" });
  await page.close();
}

export async function cleanup(page: Page, ids: string[], prefix: string) {
  await settleDraftPage(page);
  if (ids.length) {
    const owner = owners.get(ids);
    if (!owner) throw new Error("draft_case_owner_unknown");
    cleanupTemplateDraftRecords(ids, owner, runDocumentFixtureSql);
  }
  // 文件夹/资源的限定清理继续走现有流程，不能用忽略错误的批量DELETE代替。
  await clean(prefix);
}
