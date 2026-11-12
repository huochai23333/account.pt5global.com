import { test, expect } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { documentLogin, documentUser, documentAdmin, uploadDocumentFiles, authoritativeFiles, cleanupDocuments } from "./helpers/document-library";
import { createFolder, enterFolder } from "./helpers/document-explorer";
import { confirmDocumentFolder, expectDocumentSaved, readPersonalDocument, expectDocumentContains } from "./helpers/company-template-documents";
import { requireDocumentFixtureDatabase, runDocumentFixtureSql } from "./helpers/document-write-lock";
import { cleanupTemplateDocumentFixtures } from "../test-support/template-document-fixture-cleanup";
import { cleanupFixtureResources } from "../test-support/fixture-cleanup-sequence";
/** 只在匹配迁移前版本的可重建完整专属项目准备旧目录；缺前提仍跳过，不在共享库重放。 */
test("人员目录合并保留编号、字节、填写内容和同名目录，本人获得管理权限", async ({ page }) => {
    test.setTimeout(180000);
    requireDocumentFixtureDatabase();
    const prefix = `personal-migration-${Date.now()}-`;
    const db = documentAdmin();
    const ids: string[] = [];
    await documentLogin(page, "administrator");
    const manager = await documentUser("manager");
    const archive = (await db.from("document_archives").select("id").eq("user_id", manager).single()).data!;
    const roots = (await db.from("document_folders").select("*").eq("archive_id", archive.id).not("system_key", "is", null)).data!;
    const personal = roots.find(folder => folder.system_key === "personal")!;
    const internal = roots.find(folder => folder.system_key === "staff_internal");
    // 合并迁移的前置夹具只能在仍有旧根目录的本地数据库执行。
    test.skip(!internal, "已合并的数据库不再具有迁移前的默认目录；迁移证据来自首次实际执行。");
    try {
        await page.goto(`/admin/documents?scope=folder&user=${manager}&folder=${personal.id}`);
        await createFolder(page, `${prefix}same`);
        await page.goto(`/admin/documents?scope=folder&user=${manager}&folder=${internal!.id}`);
        const child = await createFolder(page, `${prefix}same`);
        await uploadDocumentFiles(page, [`${prefix}root.txt`]);
        await enterFolder(page, child.id);
        await uploadDocumentFiles(page, [`${prefix}nested.txt`]);
        const beforeFiles = await authoritativeFiles([`${prefix}root.txt`, `${prefix}nested.txt`]);
        await page.goto(`/admin/company-templates?folder=${internal!.id}`);
        await page.getByRole("button", { name: "新建文档", exact: true }).first().click();
        // 草稿先于正式文档存在，位置确认或保存失败也必须准确回收它及操作回执。
        await expect(page).toHaveURL(/\/documents\/drafts\/[a-f0-9-]+$/);
        ids.push(page.url().split("/").pop()!);
        await confirmDocumentFolder(page, internal!.id);
        await expectDocumentSaved(page);
        const id = page.url().split("/").pop()!;
        ids.push(id);
        await page.frameLocator("iframe").locator("#client").fill(prefix);
        await expectDocumentContains(page, id, prefix);
        const before = await readPersonalDocument(id);
        let detectsWrongFolder = false;
        try {
            expect(before.folder_id).toBe(personal.id);
        }
        catch {
            detectsWrongFolder = true;
        }
        expect(detectsWrongFolder).toBe(true);
        runDocumentFixtureSql(readFileSync("../PT5-dropshipping-supabase/supabase/migrations/20261012090000_personal_document_folders.sql", "utf8"));
        const after = await readPersonalDocument(id);
        expect(after.folder_id).toBe(personal.id);
        expect(after.revision).toBe(before.revision + 1);
        expect(after.state_sha256).toBe(before.state_sha256);
        expect(after.template_version_id).toBe(before.template_version_id);
        const folders = (await db.from("document_folders").select("*").eq("archive_id", archive.id)).data!;
        expect(folders.filter(folder => folder.system_key)).toHaveLength(1);
        expect(folders.find(folder => folder.id === child.id)).toMatchObject({ parent_id: personal.id, zone: "personal", name: `${prefix}same (2)` });
        const afterFiles = await authoritativeFiles(beforeFiles.map(file => file.name));
        for (const original of beforeFiles) {
            const file = afterFiles.find(item => item.id === original.id)!;
            expect(file.version).toBe(original.version + 1);
            expect(file.storage_path).toBe(original.storage_path);
            expect(file.sha256).toBe(original.sha256);
            const bytes = await db.storage.from("document-library").download(file.storage_path);
            expect(bytes.error).toBeNull();
            expect(Buffer.from(await bytes.data!.arrayBuffer())).toEqual(Buffer.from("真实资料\n"));
        }
        await documentLogin(page, "manager");
        await page.goto(`/manager/documents/templates/${id}`);
        await expect(page.frameLocator("iframe").locator("#client")).toHaveValue(prefix);
        await page.frameLocator("iframe").locator("#client").fill(prefix + "owner");
        await expectDocumentContains(page, id, prefix + "owner");
        await page.reload();
        await expect(page.frameLocator("iframe").locator("#client")).toHaveValue(prefix + "owner");
        writeFileSync(`output/personal-folder-migration-${id}-evidence.json`, JSON.stringify({ documentId: id, folderId: personal.id, revision: after.revision, stateHashPreserved: true, templateVersionPreserved: true, fileIds: afterFiles.map(file => file.id), ownerEdited: true, duplicateFolderId: child.id, redGreenDetected: detectsWrongFolder }, null, 2), { flag: "wx" });
    }
    finally {
        await cleanupFixtureResources(
            () => cleanupTemplateDocumentFixtures(db, ids),
            () => cleanupDocuments(prefix),
        );
    }
});
