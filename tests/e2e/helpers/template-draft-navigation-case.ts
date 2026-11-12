import { expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { documentAdmin } from "./document-library";
import { documentLogin } from "./document-library";
import { createFolder } from "./document-explorer";
import { test } from "./template-draft-fixture";
import { openDraft } from "./template-draft-fixture";
import { draft } from "./template-draft-fixture";
import { cleanup } from "./template-draft-fixture";
/** 另存为目录浏览与局部加载；退出时先释放本用例的路由闸门。 */
export function registerDraftNavigationCase() {
  test("另存为目录导航、单击双击、搜索及局部加载，取消保留草稿，窄屏路径可用", async ({ page }, testInfo) => {
    test.setTimeout(150000);
    const ids: string[] = [];
    let releasePending: (() => void) | undefined;
    const prefix = `draft-browser-${randomUUID()}-`;
    try {
      await documentLogin(page, "salesman");
      await page.goto("/salesman/documents?scope=folder");
      const parent = await createFolder(page, prefix + "长名称".repeat(8));
      const root = parent.parent_id;
      const id = await openDraft(page, ids, "salesman", root);
      await page.frameLocator("iframe").locator("#client").fill(prefix);
      await expect.poll(async () => JSON.stringify((await draft(id)).state)).toContain(prefix);
      await page.getByRole("button", { name: "另存为", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.locator("[data-save-as-content]")).toHaveAttribute("aria-busy", "false");
      await expect(dialog.locator("[data-save-as-path]")).toContainText("资料文件夹");
      const row = dialog.locator(`[data-save-as-item="${parent.id}"]`);
      await row.click();
      expect(await dialog.locator("[data-save-as-path]").innerText()).not.toContain(parent.name);
      await row.dblclick();
      await expect(dialog.locator("[data-save-as-path]")).toContainText(parent.name);
      await expect(dialog.locator("[data-save-as-content]")).toHaveAttribute("aria-busy", "false");
      await dialog.getByRole("button", { name: "返回上一级文件夹", exact: true }).click();
      await expect(dialog.locator("[data-save-as-path]")).not.toContainText(parent.name);
      await dialog.getByRole("button", { name: "返回", exact: true }).click();
      await expect(dialog.locator("[data-save-as-path]")).toContainText(parent.name);
      await dialog.getByRole("button", { name: "前进", exact: true }).click();
      await expect(dialog.locator("[data-save-as-path]")).not.toContainText(parent.name);
      let release: () => void = () => {};
      const held = new Promise<void>((resolve) => {
        release = resolve;
        releasePending = resolve;
      });
      await page.route("**/api/company-template-documents/save-as?**", async (route) => {
        await held;
        await route.continue();
      });
      await dialog.getByLabel("文件名", { exact: true }).fill(prefix + "保持名称");
      await dialog.locator(`[data-save-as-tree-folder="${parent.id}"]`).click();
      await expect(dialog.locator("[data-save-as-content]")).toHaveAttribute("aria-busy", "true");
      await expect(dialog.getByRole("tree")).toBeVisible();
      await expect(dialog.getByLabel("文件名", { exact: true })).toHaveValue(prefix + "保持名称");
      release();
      await expect(dialog.locator("[data-save-as-content]")).toHaveAttribute("aria-busy", "false");
      await page.unroute("**/api/company-template-documents/save-as?**");
      await dialog.getByRole("button", { name: "返回上一级文件夹", exact: true }).click();
      await page.route("**/api/company-template-documents/save-as?**", (route) =>
        route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "document_failed" }),
        }),
      );
      await dialog.getByLabel("搜索当前文件夹及下级", { exact: true }).fill("临时查询失败");
      await expect(dialog.getByRole("alert")).toBeVisible();
      await expect(dialog.getByRole("tree")).toBeVisible();
      await expect(dialog.getByLabel("文件名", { exact: true })).toHaveValue(prefix + "保持名称");
      await page.unroute("**/api/company-template-documents/save-as?**");
      await dialog.getByRole("button", { name: "重试", exact: true }).click();
      await expect(dialog.locator("[data-save-as-content]")).toHaveAttribute("aria-busy", "false");
      await expect(dialog.getByRole("alert")).toHaveCount(0);
      await dialog.getByLabel("搜索当前文件夹及下级", { exact: true }).fill(parent.name);
      await expect(dialog.locator(`[data-save-as-item="${parent.id}"]`)).toBeVisible();
      await dialog.locator(`[data-save-as-item="${parent.id}"]`).dblclick();
      await expect(dialog.getByLabel("搜索当前文件夹及下级", { exact: true })).toHaveValue("");
      await expect(dialog.locator("[data-save-as-content]")).toHaveAttribute("aria-busy", "false");
      // 用真实新建操作形成深层长路径，路径区域自身滚动，不能把文件名与保存按钮挤出窗口。
      for (let depth = 0; depth < 2; depth++) {
        const name = prefix + depth + "深层文件夹".repeat(12);
        await dialog.getByRole("button", { name: "新建文件夹", exact: true }).click();
        await dialog.getByLabel("文件夹名称", { exact: true }).fill(name);
        await dialog.getByRole("button", { name: "确认", exact: true }).click();
        await expect(dialog.locator("[data-save-as-path]")).toContainText(name);
        await expect(dialog.locator("[data-save-as-content]")).toHaveAttribute("aria-busy", "false");
      }
      for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        await expect(dialog.getByRole("navigation", { name: "文件夹路径", exact: true })).toBeVisible();
        await expect(dialog.getByLabel("文件名", { exact: true })).toBeInViewport();
        await expect(dialog.getByRole("button", { name: "保存", exact: true })).toBeInViewport();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: testInfo.outputPath(`draft-save-as-${width}.png`) });
      }
      await dialog.getByRole("button", { name: "取消", exact: true }).click();
      await page.setViewportSize({ width: 1440, height: 900 });
      await expect(page.frameLocator("iframe").locator("#client")).toHaveValue(prefix);
      await page.reload();
      await expect(page.frameLocator("iframe").locator("#client")).toHaveValue(prefix);
      await page.keyboard.press("Control+s");
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: "取消", exact: true }).click();
      await page.frameLocator("iframe").locator("#client").press("Control+Shift+s");
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: "取消", exact: true }).click();
      expect(
        (await documentAdmin().from("company_template_documents").select("id").eq("id", id)).data,
      ).toEqual([]);
    } finally {
      releasePending?.();
      await cleanup(page, ids, prefix);
    }
  });
}
