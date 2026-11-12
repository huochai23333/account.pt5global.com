import { readStorageObjectPresence } from "@/lib/storage-operation-object-presence";
import { openItemMenu, createFolder, enterFolder, confirmDeletion } from "./helpers/document-explorer";
import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { authoritativeFiles, cleanupDocuments, documentAdmin, documentLogin, documentUser, uploadDocumentFiles } from "./helpers/document-library";
import { requireDisposableFixture } from "../test-support/disposable-fixture";

// 固定账号、全局故障或过期清理只能在实际可重建的专属完整实例执行。
test.beforeAll(() => requireDisposableFixture({
  baseURL: process.env.PLAYWRIGHT_BASE_URL,
  supabaseURL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  mode: process.env.PT5_E2E_FIXTURE_MODE,
}));

test.use({ video: "off" });
// 新版允许递归删除与跨档案移动，清单确认和当前权限取代旧版禁止规则。
test("非空目录展示确认清单，跨档案移动保留内容，并发旧版本拒绝", async ({ page }) => {
    test.setTimeout(120000);
    const prefix = `docs-boundary-${Date.now()}-`;
    try {
        await documentLogin(page, "administrator");
        await page.goto("/admin/documents?scope=folder");
        const folder = await createFolder(page, prefix + "子目录");
        expect(folder.zone).toBe("personal");
        await enterFolder(page, folder.id);
        await uploadDocumentFiles(page, [prefix + "并发.txt"]);
        await page.getByRole("button", { name: "上一级", exact: true }).click();
        await openItemMenu(page, page.locator(`[data-explorer-item="${folder.id}"]`), "删除");
        let dialog = page.getByRole("dialog");
        await expect(dialog).toContainText("1 个文件夹");
        await expect(dialog).toContainText("1 个文件");
        await expect(dialog.getByRole("button", { name: "确认", exact: true })).toBeDisabled();
        await dialog.getByRole("button", { name: "取消", exact: true }).click();
        await enterFolder(page, folder.id);
        const file = (await authoritativeFiles([prefix + "并发.txt"]))[0];
        const bodies = [1, 2].map(number => ({ operationId: randomUUID(), action: "rename_file", payload: { fileId: file.id, version: file.version, name: `${prefix}并发${number}.txt` } }));
        const responses = await Promise.all(bodies.map(body => page.request.post("/api/document-library", { data: body })));
        expect(responses.map(r => r.status()).sort()).toEqual([200, 400]);
        const winner = responses.findIndex(r => r.status() === 200), receipt = await responses[winner].json();
        for (const n of [1, 2]) {
            void n;
            expect(await (await page.request.post("/api/document-library", { data: bodies[winner] })).json()).toEqual(receipt);
        }
        const authoritative = await documentAdmin().from("document_files").select("*").eq("id", file.id).single();
        expect(authoritative.data!.version).toBe(file.version + 1);
        const employee = await documentUser("operator");
        const other = await (await page.request.get(`/api/document-library?user=${employee}&scope=folder`)).json();
        await page.reload();
        await openItemMenu(page, page.locator(`[data-document-file="${file.id}"]`), "移动到");
        dialog = page.getByRole("dialog");
        await dialog.getByRole("combobox", { name: "人员或客户", exact: true }).click();
        await page.getByRole("option", { name: other.archives.find((a: {
                id: string;
                name: string;
            }) => a.id === other.archiveId).name, exact: true }).click();
        await dialog.getByRole("combobox", { name: "目标文件夹", exact: true }).click();
        await page.getByRole("option", { name: "本人资料", exact: true }).click();
        await dialog.getByRole("button", { name: "确认", exact: true }).click();
        await expect(dialog).toHaveCount(0);
        const moved = await documentAdmin().from("document_files").select("*").eq("id", file.id).single();
        expect(moved.data!.folder_id).toBe(other.folderId);
        expect(moved.data!.version).toBe(file.version + 2);
        expect(moved.data!.storage_path).toBe(file.storage_path);
        await page.goto(`/admin/documents?user=${employee}&folder=${other.folderId}`);
        await page.reload();
        await openItemMenu(page, page.locator(`[data-document-file="${file.id}"]`), "删除");
        await confirmDeletion(page);
        expect(await readStorageObjectPresence(documentAdmin().storage.from("document-library"), file.storage_path)).toBe(false);
        await page.goto("/admin/documents?scope=folder");
        await openItemMenu(page, page.locator(`[data-explorer-item="${folder.id}"]`), "删除");
        await confirmDeletion(page);
        expect((await documentAdmin().from("document_folders").select("id").eq("id", folder.id)).data).toHaveLength(0);
        await page.reload();
        await expect(page.locator(`[data-explorer-item="${folder.id}"]`)).toHaveCount(0);
    }
    finally {
        await cleanupDocuments(prefix);
    }
});
