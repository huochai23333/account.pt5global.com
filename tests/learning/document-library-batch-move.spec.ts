import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import en from "../../messages/en.json" with { type: "json" };
import zh from "../../messages/zh.json" with { type: "json" };
import { executeLearningSql, loginLearningUser } from "../../scripts/learning/local-fixture-session.mjs";
import { prepareCustomerDocumentUpload } from "./customer-document-upload-fixture";
import { expect, test as base } from "./fixtures";
// 直接验证不带认证依赖的页面助手；身份仍来自独立学习夹具，不加载原受限套件。
const { readStorageObjectPresence } = createRequire(import.meta.url)("../../lib/storage-operation-object-presence") as typeof import("../../lib/storage-operation-object-presence");
const { chooseDocumentFolder, readLibrary } = createRequire(import.meta.url)("../e2e/helpers/document-library-page") as typeof import("../e2e/helpers/document-library-page");
// 文档夹具依赖本次账号和页面：先关闭页面、清文档，再由账号fixture删用户，避免正文超时后并发收尾。
const test = base.extend<{
    documentFixture: ReturnType<typeof prepareCustomerDocumentUpload>;
}>({
    documentFixture: [async ({ page, learningUser }, provide, testInfo) => {
            const fixture = prepareCustomerDocumentUpload(learningUser, true);
            const preparedAt = new Date().toISOString();
            try {
                await provide(fixture);
            }
            finally {
                const cleanupStartedAt = new Date().toISOString();
                await page.close();
                const cleanup = await fixture.cleanup();
                expect(cleanup).toEqual({ customer: null, archiveCount: 0, files: [], operations: [], objects: [] });
                const batches = JSON.parse(executeLearningSql(`select coalesce(json_agg(id),'[]') from public.document_batches where actor_id='${learningUser.id}';`));
                expect(batches).toEqual([]);
                await writeFile(testInfo.outputPath("owned-document-cleanup.json"), JSON.stringify({ actorId: learningUser.id, preparedAt, cleanupStartedAt,
                    cleanupFinishedAt: new Date().toISOString(), cleanup, batches }, null, 2), { flag: "wx" });
            }
        }, { timeout: 60000 }],
});
for (const [locale, width, asFolder] of [["zh", 1440, false], ["en", 390, true]] as const) {
    const copy = (locale === "zh" ? zh : en).Documents;
    test(`批量移动跳过对象丢失的文件并续办原批次 ${locale}/${width}`, async ({ page, learningUser, documentFixture: fixture }, testInfo) => {
        const url = (folder: string) => `/admin/documents?scope=folder&folder=${folder}`;
        const missingFolder = asFolder
            ? executeLearningSql(`insert into public.document_folders(archive_id,parent_id,zone,name)
          select archive_id,id,zone,'Learning source' from public.document_folders where id='${fixture.folderId}' returning id;`)
            : fixture.folderId;
        const readFolder = () => JSON.parse(executeLearningSql(`select row_to_json(f) from
      (select parent_id,version from public.document_folders where id='${missingFolder}') f;`));
        const storage = learningUser.client.storage.from("document-library");
        const readBatch = () => JSON.parse(executeLearningSql(`select coalesce(json_agg(b),'[]') from
      (select id,status,results from public.document_batches where actor_id='${learningUser.id}') b;`));
        const files = ["available", "missing"].map((label) => ({
            name: `${fixture.id}-${label}.txt`,
            mimeType: "text/plain",
            buffer: Buffer.from(`Learning move: ${label}`),
        }));
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.setViewportSize({ width, height: 900 });
        await page.addLocatorHandler(page.getByRole("dialog").filter({ hasText: "这是一条面向所有角色的本地测试公告" }), async () => {
            await page.keyboard.press("Escape");
        });
        await loginLearningUser(page, learningUser);
        await page.context().addCookies([{ name: "bs-locale", value: locale, url: "http://localhost:3000" }]);
        if (asFolder) {
            await page.goto(url(missingFolder));
            await page.locator('input[type="file"]').setInputFiles(files[1]);
            await expect(page.locator("[data-document-file]")).toHaveCount(1);
        }
        await page.goto(url(fixture.folderId));
        await page.locator('input[type="file"]').setInputFiles(asFolder ? files[0] : files);
        await expect(page.locator("[data-document-file]")).toHaveCount(asFolder ? 1 : 2);
        const [available, missing] = fixture.read().files;
        const sourceFolder = readFolder();
        const missingItem = asFolder ? missingFolder : missing.id;
        expect(available.original_name).toBe(files[0].name);
        expect(missing.original_name).toBe(files[1].name);
        // 只移除本次专属 Storage 对象，保留 ready 数据行，模拟实际内容丢失。
        expect((await storage.remove([missing.storage_path])).error).toBeNull();
        expect(await readStorageObjectPresence(storage, missing.storage_path)).toBe(false);
        await page.locator(`[data-document-file="${available.id}"]`).click();
        await page.locator(`[data-explorer-item="${missingItem}"]`).click({ modifiers: ["Control"] });
        await page.getByRole("button", { name: copy.explorer.cut, exact: true }).click();
        await page.locator(`[data-explorer-item="${fixture.destinationId}"]`).dblclick();
        await page.getByRole("button", { name: copy.explorer.paste, exact: true }).click();
        await page.getByRole("dialog").getByRole("button", { name: copy.confirm, exact: true }).click();
        const batch = page.locator("[data-document-batch]");
        await expect(batch).toHaveAttribute("data-batch-status", "partial_failed", { timeout: 15000 });
        const [partial] = readBatch();
        expect(partial).toMatchObject({ status: "partial_failed", results: expect.arrayContaining([
                expect.objectContaining({ id: available.id, status: "succeeded" }),
                expect.objectContaining({ id: missingItem, status: "failed", error: "unconfirmed" }),
            ]) });
        expect(fixture.read().files).toEqual([
            { ...available, folder_id: fixture.destinationId, version: available.version + 1 },
            missing,
        ]);
        expect(readFolder()).toEqual(sourceFolder);
        expect(await fixture.download(available.storage_path)).toEqual(files[0].buffer);
        // 部分完成时确认弹窗仍保留。关闭弹窗并刷新，再从批次明细续办。
        await page.getByRole("dialog").getByRole("button", { name: copy.cancel, exact: true }).click();
        await page.reload();
        await expect(batch).toHaveAttribute("data-document-batch", partial.id);
        await expect(batch.getByText(copy.errors.unconfirmed, { exact: false })).toBeVisible();
        await batch.scrollIntoViewIfNeeded();
        await page.screenshot({ path: testInfo.outputPath("move-partial.png"), animations: "disabled" });
        // 恢复原字节，再从页面续办同一批。已完成项不可再移动一次或增加版本。
        expect((await storage.upload(missing.storage_path, files[1].buffer, { contentType: "text/plain" })).error).toBeNull();
        await batch.getByRole("button", { name: copy.reconcile, exact: true }).click();
        await expect(batch).toHaveAttribute("data-batch-status", "succeeded");
        const final = fixture.read();
        expect(final.files).toEqual([
            { ...available, folder_id: fixture.destinationId, version: available.version + 1 },
            { ...missing, folder_id: asFolder ? missingFolder : fixture.destinationId, version: missing.version + 1 },
        ]);
        if (asFolder) {
            expect(readFolder()).toEqual({ parent_id: fixture.destinationId, version: sourceFolder.version + 1 });
        }
        expect(await fixture.download(missing.storage_path)).toEqual(files[1].buffer);
        const batches = readBatch();
        expect(batches).toHaveLength(1);
        expect(batches[0]).toMatchObject({ id: partial.id, status: "succeeded" });
        expect(batches[0].results.map((row: {
            status: string;
        }) => row.status)).toEqual(["succeeded", "succeeded"]);
        await page.goto(url(fixture.destinationId));
        await expect(page.locator("[data-document-file]")).toHaveCount(asFolder ? 1 : 2);
        if (asFolder) {
            await page.locator(`[data-explorer-item="${missingFolder}"]`).dblclick();
            await expect(page.locator(`[data-document-file="${missing.id}"]`)).toBeVisible();
        }
        expect(fixture.read()).toEqual(final);
        expect(readBatch()).toEqual(batches);
        expect(errors).toEqual([]);
        await writeFile(testInfo.outputPath("move-receipts.json"), JSON.stringify({ partial, batches, final }, null, 2));
    });
}
for (const [locale, width] of [["zh", 1440], ["zh", 390], ["en", 1440], ["en", 390]] as const) {
    test(`目录编号导航区分同名目录与账户根 ${locale}/${width}`, async ({ page, learningUser, documentFixture: fixture }, testInfo) => {
        const right = executeLearningSql(`insert into public.document_folders(archive_id,parent_id,zone,name)
      select archive_id,id,zone,'Learning other parent' from public.document_folders where id='${fixture.folderId}' returning id;`);
        const duplicate = (parent: string) => executeLearningSql(`insert into public.document_folders(archive_id,parent_id,zone,name)
      select archive_id,id,zone,'Learning duplicate' from public.document_folders where id='${parent}' returning id;`);
        const leftChild = duplicate(fixture.destinationId), rightChild = duplicate(right);
        const readFolders = () => JSON.parse(executeLearningSql(`select json_agg(f order by id) from
      (select id,parent_id,name,version from public.document_folders where id in
      ('${fixture.folderId}','${fixture.destinationId}','${right}','${leftChild}','${rightChild}')) f;`));
        const before = readFolders(), errors: string[] = [];
        let writes = 0;
        page.on("pageerror", error => errors.push(error.message));
        page.on("request", request => { if (request.url().includes("/api/document-library") && request.method() !== "GET")
            writes++; });
        await page.setViewportSize({ width, height: 900 });
        await page.addLocatorHandler(page.getByRole("dialog").filter({ hasText: "这是一条面向所有角色的本地测试公告" }), async () => { await page.keyboard.press("Escape"); });
        await loginLearningUser(page, learningUser);
        await page.context().addCookies([{ name: "bs-locale", value: locale, url: "http://localhost:3000" }]);
        await page.goto(`/admin/documents?scope=folder&folder=${fixture.folderId}`);
        const copy = (locale === "zh" ? zh : en).Documents;
        await expect(page.getByRole("heading", { name: copy.title, exact: true })).toBeVisible();
        const storedRootLabelButtons = await page.getByRole("tree").getByRole("button", { name: copy.zones.personal, exact: true }).count();
        expect(storedRootLabelButtons).toBe(0);
        await chooseDocumentFolder(page, rightChild);
        expect((await readLibrary(page)).folderId).toBe(rightChild);
        await chooseDocumentFolder(page, leftChild);
        expect((await readLibrary(page)).folderId).toBe(leftChild);
        await page.reload();
        await expect(page.locator("[data-document-content]")).toHaveAttribute("aria-busy", "false");
        expect((await readLibrary(page)).folderId).toBe(leftChild);
        await chooseDocumentFolder(page, fixture.folderId);
        expect((await readLibrary(page)).folderId).toBe(fixture.folderId);
        await expect(page.getByRole("navigation", { name: copy.explorer.path })).toContainText(fixture.name);
        expect(readFolders()).toEqual(before);
        expect(writes).toBe(0);
        expect(errors).toEqual([]);
        await expect(page.locator("nextjs-portal [data-nextjs-dialog-overlay]")).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: testInfo.outputPath("folder-id-navigation.png"), caret: "initial", animations: "disabled" });
        await writeFile(testInfo.outputPath("folder-id-receipts.json"), JSON.stringify({ fixture: fixture.id, locale, width, rootId: fixture.folderId,
            leftChild, rightChild, storedRootLabelButtons, writes, before, after: readFolders(), reloadedFolder: leftChild, finalFolder: fixture.folderId, errors }, null, 2));
    });
}
