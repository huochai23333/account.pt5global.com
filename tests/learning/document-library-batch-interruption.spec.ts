import { writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import en from "../../messages/en.json" with { type: "json" };
import zh from "../../messages/zh.json" with { type: "json" };
import { executeLearningSql, loginLearningUser } from "../../scripts/learning/local-fixture-session.mjs";
import { prepareCustomerDocumentUpload, prepareNestedDocumentTree, type DocumentTreeReceipt } from "./customer-document-upload-fixture";
import { expect, test } from "./fixtures";

// 本文件因JSON导入使用ESM，Web工具由Playwright按CommonJS转译；通过Node标准入口加载同一生产工具。
const { readStorageObjectPresence } = createRequire(import.meta.url)("../../lib/storage-operation-object-presence") as typeof import("../../lib/storage-operation-object-presence");

for (const [action, locale, width] of [["copy", "zh", 1440], ["delete", "en", 390]] as const) {
  const copy = (locale === "zh" ? zh : en).Documents;
  test(`批量 ${action} 丢失写入回执后按原批次恢复 ${locale}/${width}`, async ({ page, learningUser }, testInfo) => {
    const fixture = prepareCustomerDocumentUpload(learningUser, true);
    const readBatches = () => JSON.parse(executeLearningSql(`select coalesce(json_agg(b),'[]') from
      (select id,action,status,results from public.document_batches where actor_id='${learningUser.id}') b;`));
    const files = ["first", "second"].map((label) => ({
      name: `${fixture.id}-${label}.txt`,
      mimeType: "text/plain",
      buffer: Buffer.from(`Learning ${action}: ${label}`),
    }));
    let posts = 0;
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.setViewportSize({ width, height: 900 });
      await page.addLocatorHandler(page.getByRole("dialog").filter({ hasText: "这是一条面向所有角色的本地测试公告" }), async () => {
        await page.keyboard.press("Escape");
      });
      await loginLearningUser(page, learningUser);
      await page.context().addCookies([{ name: "bs-locale", value: locale, url: "http://localhost:3000" }]);
      await page.goto(`/admin/documents?scope=folder&folder=${fixture.folderId}`);
      await page.locator('input[type="file"]').setInputFiles(files);
      await expect(page.locator("[data-document-file]")).toHaveCount(2);
      const before = fixture.read();
      await page.locator(`[data-document-file="${before.files[0].id}"]`).click();
      await page.locator(`[data-document-file="${before.files[1].id}"]`).click({ modifiers: ["Control"] });
      await page.getByRole("button", { name: copy.explorer[action], exact: true }).click();
      if (action === "copy") {
        await page.locator(`[data-explorer-item="${fixture.destinationId}"]`).dblclick();
        await page.getByRole("button", { name: copy.explorer.paste, exact: true }).click();
      } else {
        await page.getByRole("checkbox", { name: copy.explorer.permanentDelete }).check();
      }
      const dialog = page.getByRole("dialog");
      await page.route("**/api/document-library/batch", async (route) => {
        if (route.request().method() !== "POST") return route.continue();
        posts += 1;
        // 运行真实写入，只切断回浏览器的第一次响应。
        await route.fetch({ maxRetries: 0 });
        await route.abort("connectionreset");
      });
      await dialog.getByRole("button", { name: copy.confirm, exact: true }).click();
      await expect(dialog.getByText(copy.errors.unconfirmed, { exact: false })).toBeVisible();
      const saved = readBatches();
      expect(saved).toHaveLength(1);
      expect(saved[0]).toMatchObject({ action, status: "succeeded" });
      expect(saved[0].results).toHaveLength(2);
      expect(saved[0].results.map((row: { status: string }) => row.status)).toEqual(["succeeded", "succeeded"]);
      const after = fixture.read();
      if (action === "copy") {
        const originals = after.files.filter((row: { folder_id: string }) => row.folder_id === fixture.folderId);
        expect(originals).toEqual(before.files);
        const duplicates = after.files.filter((row: { folder_id: string }) => row.folder_id === fixture.destinationId);
        expect(duplicates).toHaveLength(2);
        expect(after.objects).toHaveLength(4);
        for (const [index, row] of duplicates.entries()) {
          expect(row.id).not.toBe(originals[index].id);
          expect(row.storage_path).not.toBe(originals[index].storage_path);
          expect(row).toMatchObject({ original_name: files[index].name, status: "ready", version: 2, sha256: originals[index].sha256 });
          expect(await fixture.download(row.storage_path)).toEqual(files[index].buffer);
          expect(await fixture.download(originals[index].storage_path)).toEqual(files[index].buffer);
        }
      } else {
        expect(after.files).toEqual([]);
        expect(after.objects).toEqual([]);
        for (const row of before.files) {
          expect(await readStorageObjectPresence(learningUser.client.storage.from("document-library"), row.storage_path)).toBe(false);
        }
      }
      await page.reload();
      const summary = page.locator(`[data-document-batch="${saved[0].id}"]`);
      await expect(summary).toHaveAttribute("data-batch-status", "succeeded");
      await expect(page.locator("[data-document-file]")).toHaveCount(action === "copy" ? 2 : 0);
      expect(fixture.read()).toEqual(after);
      expect(readBatches()).toEqual(saved);
      expect(posts).toBe(1);
      expect(errors).toEqual([]);
      await summary.scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`${action}-recovered.png`), animations: "disabled" });
      await writeFile(testInfo.outputPath("batch-receipts.json"), JSON.stringify({ before, after, saved }, null, 2));
    } finally {
      const cleanup = await fixture.cleanup();
      expect(cleanup).toEqual({ customer: null, archiveCount: 0, files: [], operations: [], objects: [] });
      expect(readBatches()).toEqual([]);
      // 删除账号会把凭证操作者置空；必须在此之前直接查全表，不能只信夹具自己的筛选结果。
      expect(executeLearningSql(`select count(*) from public.document_operations where actor_id='${learningUser.id}';`)).toBe("0");
      await writeFile(testInfo.outputPath("batch-cleanup.json"), JSON.stringify(cleanup));
    }
  });
}

for (const locale of ["zh", "en"] as const) for (const width of [1440, 390]) {
  const copy = (locale === "zh" ? zh : en).Documents;
  const interruption = width === 1440 ? "disconnect" : "forged_success";
  test(`递归删除在请求间中断后从页面续办 ${locale}/${width}/${interruption}`, async ({ page, learningUser }, testInfo) => {
    test.setTimeout(180_000);
    const fixture = await prepareNestedDocumentTree(learningUser);
    const treeFolderIds = new Set<string>(fixture.folders);
    // 7文件＋1模板＋3目录共11项，超过每轮10项，必须真实走到第二轮请求。
    const files = [...fixture.folders, ...Array<string>(4).fill(fixture.folders[0])].map((folder, index) => ({
      folder, name: `${fixture.id}-delete-${index}.txt`, mimeType: "text/plain", buffer: Buffer.from(`Delete tree ${index}`),
    }));
    let posts = 0;
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const reads: { path: string; status: number }[] = [];
    page.on("response", response => {
      const url = new URL(response.url());
      if (url.pathname.startsWith("/api/document-library") && response.request().method() === "GET")
        reads.push({ path: url.pathname + url.search, status: response.status() });
    });
    const consoleIssues: { text: string; path: string }[] = [];
    page.on("console", message => {
      if (!["error", "warning"].includes(message.type())) return;
      const address = message.location().url;
      consoleIssues.push({ text: message.text(), path: address ? new URL(address).pathname : "" });
    });
    const refreshFromPage = async () => {
      // 服务端标记可先于水合出现；实际点刷新并收到目录响应，才证明当前控件已接管页面。
      const refresh = page.getByRole("button", { name: copy.explorer.refresh, exact: true });
      const [response] = await Promise.all([
        page.waitForResponse(response => new URL(response.url()).pathname === "/api/document-library" && response.request().method() === "GET"),
        refresh.click(),
      ]);
      expect(response.ok()).toBe(true);
      await expect(refresh).toBeEnabled();
    };
    try {
      await page.setViewportSize({ width, height: 900 });
      await page.addLocatorHandler(page.getByRole("dialog").filter({ hasText: "这是一条面向所有角色的本地测试公告" }), async () => {
        await page.keyboard.press("Escape");
      });
      await loginLearningUser(page, learningUser);
      await page.context().addCookies([{ name: "bs-locale", value: locale, url: "http://localhost:3000" }]);
      for (const folder of fixture.folders) {
        const currentFiles = files.filter(file => file.folder === folder);
        await page.goto(`/admin/documents?scope=folder&folder=${folder}`);
        await page.locator('input[type="file"]').setInputFiles(currentFiles.map(({ name, mimeType, buffer }) => ({ name, mimeType, buffer })));
        await expect(page.locator("[data-document-file]")).toHaveCount(currentFiles.length);
      }
      const before = fixture.readTree();
      expect(before.files).toHaveLength(7);
      expect(before.documents).toHaveLength(1);
      await page.goto(`/admin/documents?scope=folder&folder=${fixture.folderId}`);
      await page.locator(`[data-explorer-item="${fixture.folders[0]}"]`).click();
      await page.getByRole("button", { name: copy.explorer.delete, exact: true }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("checkbox", { name: copy.explorer.permanentDelete }).check();
      await page.route("**/api/document-library/batch", async route => {
        if (route.request().method() !== "POST") return route.continue();
        posts += 1;
        if (posts !== 2) return route.continue();
        // 只阻断尚未发到服务端的第二轮。首轮与之后的续办均执行真实应用/数据库/Storage。
        if (interruption === "disconnect") return route.abort("connectionreset");
        const persisted = fixture.readTree().batches[0];
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...persisted, status: "succeeded",
          results: [...persisted.results, { kind: "folder", id: fixture.folders[0], status: "succeeded" }] }) });
      });
      await dialog.getByRole("button", { name: copy.confirm, exact: true }).click();
      // 首轮需实际删除7份对象并提交10项；先等到故障边界，再按后台读回的30秒上限核对提示。
      await expect.poll(() => posts, { timeout: 60_000 }).toBe(2);
      await expect(dialog.getByText(copy.errors.unconfirmed, { exact: false })).toBeVisible({ timeout: 30_000 });
      const paused = fixture.readTree();
      await writeFile(testInfo.outputPath("recursive-delete-paused.json"), JSON.stringify({ before, paused, posts, interruption, url: page.url(), reads }, null, 2));
      expect(posts).toBe(2);
      expect(paused.batches).toHaveLength(1);
      expect(paused.batches[0]).toMatchObject({ action: "delete", status: "pending" });
      expect(paused.batches[0].results).toHaveLength(10);
      expect(paused.batches[0].results.every(row => row.status === "succeeded")).toBe(true);
      expect(paused.files).toEqual([]);
      expect(paused.documents).toEqual([]);
      expect(paused.folders.filter(row => treeFolderIds.has(row.id))).toEqual([before.folders.find(row => row.id === fixture.folders[0])]);
      expect(executeLearningSql(`select delete_batch_id from public.document_folders where id='${fixture.folders[0]}';`)).toBe(paused.batches[0].id);
      for (const file of before.files) expect(await readStorageObjectPresence(learningUser.client.storage.from("document-library"), file.storage_path)).toBe(false);
      await page.reload();
      const batch = page.locator(`[data-document-batch="${paused.batches[0].id}"]`);
      await expect(batch).toHaveAttribute("data-batch-status", "pending");
      await expect(batch.getByRole("status")).toHaveText(copy.explorer.batch_pending.replace("{done}", "10").replace("{total}", "11"));
      await expect(page.locator(`[data-explorer-item="${fixture.folders[0]}"]`)).toHaveCount(1);
      await refreshFromPage();
      await page.screenshot({ path: testInfo.outputPath("recursive-delete-pending.png"), animations: "disabled", caret: "initial" });
      // 恢复入口仍在真实页面；原批次的10个成功条目不得重新生成凭证或重复删除。
      await batch.getByRole("button", { name: copy.reconcile, exact: true }).click();
      await expect(batch).toHaveAttribute("data-batch-status", "succeeded", { timeout: 30_000 });
      const after = fixture.readTree();
      expect(after.batches).toHaveLength(1);
      expect(after.batches[0].id).toBe(paused.batches[0].id);
      expect(after.batches[0].results).toHaveLength(11);
      expect(after.batches[0].results.every(row => row.status === "succeeded")).toBe(true);
      for (const completed of paused.batches[0].results) expect(after.batches[0].results.find(row => row.kind === completed.kind && row.id === completed.id)).toEqual(completed);
      expect(after.files).toEqual([]);
      expect(after.documents).toEqual([]);
      expect(after.folders.some(row => treeFolderIds.has(row.id))).toBe(false);
      expect(fixture.read().objects).toEqual([]);
      expect(posts).toBe(3);
      await page.reload();
      await refreshFromPage();
      await expect(page.locator(`[data-document-batch="${paused.batches[0].id}"]`)).toHaveAttribute("data-batch-status", "succeeded");
      await expect(page.locator(`[data-explorer-item="${fixture.folders[0]}"]`)).toHaveCount(0);
      expect(fixture.readTree()).toEqual(after);
      expect(errors).toEqual([]);
      const unexpectedConsole = consoleIssues.filter(issue => !(interruption === "disconnect" && issue.path === "/api/document-library/batch" && /net::ERR_(CONNECTION_RESET|FAILED)/.test(issue.text)));
      expect(unexpectedConsole).toEqual([]);
      await expect(page.locator("nextjs-portal [data-nextjs-dialog], nextjs-portal [data-nextjs-dialog-overlay]")).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath("recursive-delete-resumed.png"), animations: "disabled", caret: "initial" });
      await writeFile(testInfo.outputPath("recursive-delete-receipts.json"), JSON.stringify({ before, paused, after, posts, interruption, consoleIssues, unexpectedConsole }, null, 2));
    } finally {
      await writeFile(testInfo.outputPath("recursive-delete-network.json"), JSON.stringify({ url: page.url(), reads, posts, errors, consoleIssues }, null, 2));
      const cleanup = await fixture.cleanup();
      expect(cleanup).toEqual({ customer: null, archiveCount: 0, files: [], operations: [], objects: [] });
      expect(fixture.readTree()).toEqual({ folders: [], files: [], documents: [], batches: [] });
      await writeFile(testInfo.outputPath("recursive-delete-cleanup.json"), JSON.stringify(cleanup));
      // 目录删除后，仍须核对所有上传及目录删除凭证，防止账号清理后留下无主记录。
      expect(executeLearningSql(`select count(*) from public.document_operations where actor_id='${learningUser.id}';`)).toBe("0");
    }
  });
}

for (const locale of ["zh", "en"] as const) for (const width of [1440, 390]) {
  const copy = (locale === "zh" ? zh : en).Documents;
  test(`多层目录复制保留文件及模板，回执丢失后刷新恢复 ${locale}/${width}`, async ({ page, learningUser }, testInfo) => {
    test.setTimeout(120_000);
    const fixture = await prepareNestedDocumentTree(learningUser);
    const files = fixture.folders.map((folder, index) => ({ folder, name: `${fixture.id}-level-${index}.txt`,
      mimeType: "text/plain", buffer: Buffer.from(`Tree copy ${fixture.id}: level ${index}`) }));
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const consoleIssues: { type: string; text: string; path: string }[] = [];
    page.on("console", message => {
      if (!["error", "warning"].includes(message.type())) return;
      const address = message.location().url;
      consoleIssues.push({ type: message.type(), text: message.text(), path: address ? new URL(address).pathname : "" });
    });
    let posts = 0;
    const targetName = `Verified tree ${locale} ${width}`;
    try {
      await page.setViewportSize({ width, height: 900 });
      await page.addLocatorHandler(page.getByRole("dialog").filter({ hasText: "这是一条面向所有角色的本地测试公告" }), async () => {
        await page.keyboard.press("Escape");
      });
      await loginLearningUser(page, learningUser);
      await page.context().addCookies([{ name: "bs-locale", value: locale, url: "http://localhost:3000" }]);
      for (const file of files) {
        await page.goto(`/admin/documents?scope=folder&folder=${file.folder}`);
        await page.locator('input[type="file"]').setInputFiles([{ name: file.name, mimeType: file.mimeType, buffer: file.buffer }]);
        await expect(page.locator("[data-document-file]")).toHaveCount(1);
      }
      const before = fixture.readTree();
      expect(before.files).toHaveLength(3);
      expect(before.documents).toHaveLength(1);
      expect(before.documents[0]).toMatchObject({ id: fixture.documentId, revision: 2 });
      await page.goto(`/admin/documents?scope=folder&folder=${fixture.folderId}`);
      await page.locator(`[data-explorer-item="${fixture.folders[0]}"]`).click();
      await page.getByRole("button", { name: copy.explorer.copy, exact: true }).click();
      await page.locator(`[data-explorer-item="${fixture.destinationId}"]`).dblclick();
      await page.getByRole("button", { name: copy.explorer.paste, exact: true }).click();
      const dialog = page.getByRole("dialog");
      // 单项复制默认添加(2)；明确填写目标名，不能把默认副本名误判成目录丢失。
      const nameInput = dialog.getByRole("textbox").first();
      await expect(nameInput).toHaveValue("Tree source (2)");
      await nameInput.fill(targetName);
      await page.route("**/api/document-library/batch", async route => {
        if (route.request().method() !== "POST") return route.continue();
        posts += 1;
        // 真实应用已完成复制后，仅切断回浏览器的响应；刷新必须找回同一批次，不能再复制一棵树。
        await route.fetch({ maxRetries: 0 });
        await route.abort("connectionreset");
      });
      await dialog.getByRole("button", { name: copy.confirm, exact: true }).click();
      await expect(dialog.getByText(copy.errors.unconfirmed, { exact: false })).toBeVisible();
      const after = fixture.readTree();
      await writeFile(testInfo.outputPath("nested-copy-raw-state.json"), JSON.stringify({ before, after, targetName }, null, 2));
      expect(after.batches).toHaveLength(1);
      expect(after.batches[0]).toMatchObject({ action: "copy", status: "succeeded" });
      expect(after.batches[0].results).toHaveLength(7);
      expect(after.batches[0].results.every(row => row.status === "succeeded")).toBe(true);
      const copiedFolders = new Map<string, string>();
      for (const [index, originalId] of fixture.folders.entries()) {
        const original = before.folders.find(row => row.id === originalId)!;
        const targetParent = index === 0 ? fixture.destinationId : copiedFolders.get(fixture.folders[index - 1]);
        const duplicate = after.folders.find(row => row.parent_id === targetParent && row.name === (index === 0 ? targetName : original.name))!;
        expect(duplicate).toBeDefined();
        expect(duplicate.id).not.toBe(original.id);
        expect(duplicate.version).toBe(1);
        copiedFolders.set(original.id, duplicate.id);
      }
      const assertFileRows = (receipt: DocumentTreeReceipt) => {
        expect(receipt.files).toHaveLength(6);
        for (const original of before.files) {
          expect(receipt.files.find(row => row.id === original.id)).toEqual(original);
          const duplicate = receipt.files.find(row => row.folder_id === copiedFolders.get(original.folder_id) && row.original_name === original.original_name)!;
          expect(duplicate).toBeDefined();
          expect(duplicate.id).not.toBe(original.id);
          expect(duplicate.storage_path).not.toBe(original.storage_path);
          expect(duplicate).toMatchObject({ status: "ready", version: 2, sha256: original.sha256, size_bytes: original.size_bytes });
        }
      };
      assertFileRows(after);
      // 在专属副本上制造错误的权威指纹，证明独立核对会失败；立即恢复后才继续下载和刷新验收。
      const probe = after.files.find(row => !before.files.some(original => original.id === row.id))!;
      let mismatchedDigestRejected = false;
      try {
        executeLearningSql(`update public.document_files set sha256=repeat('0',64) where id='${probe.id}' and folder_id='${probe.folder_id}';`);
        const corrupted = fixture.readTree();
        expect(corrupted.files.find(row => row.id === probe.id)?.sha256).toBe("0".repeat(64));
        expect(() => assertFileRows(corrupted)).toThrow(/sha256/);
        mismatchedDigestRejected = true;
      } finally {
        executeLearningSql(`update public.document_files set sha256='${probe.sha256}' where id='${probe.id}' and folder_id='${probe.folder_id}';`);
      }
      expect(fixture.readTree()).toEqual(after);
      expect(after.documents).toHaveLength(2);
      expect(after.documents.find(row => row.id === fixture.documentId)).toEqual(before.documents[0]);
      const duplicatedDocument = after.documents.find(row => row.id !== fixture.documentId)!;
      expect(duplicatedDocument).toMatchObject({ folder_id: copiedFolders.get(fixture.folders[2]), revision: 1,
        template_version_id: before.documents[0].template_version_id, state: before.documents[0].state, state_sha256: before.documents[0].state_sha256 });
      expect(fixture.read().objects).toHaveLength(6);
      for (const row of after.files) {
        const expected = files.find(file => file.name === row.original_name)!;
        expect(row.sha256).toBe(createHash("sha256").update(expected.buffer).digest("hex"));
        expect(row.size_bytes).toBe(expected.buffer.length);
        expect(await fixture.download(row.storage_path)).toEqual(expected.buffer);
      }
      await page.reload();
      const batch = page.locator(`[data-document-batch="${after.batches[0].id}"]`);
      await expect(batch).toHaveAttribute("data-batch-status", "succeeded");
      const copiedRoot = copiedFolders.get(fixture.folders[0])!;
      await expect(page.locator(`[data-explorer-item="${copiedRoot}"]`)).toHaveCount(1);
      await page.locator(`[data-explorer-item="${copiedRoot}"]`).dblclick();
      await expect(page.locator("[data-document-file]")).toHaveCount(1);
      await page.locator(`[data-explorer-item="${copiedFolders.get(fixture.folders[1])}"]`).dblclick();
      await page.locator(`[data-explorer-item="${copiedFolders.get(fixture.folders[2])}"]`).dblclick();
      await expect(page.locator("[data-document-file]")).toHaveCount(1);
      await expect(page.locator(`[data-explorer-item="${duplicatedDocument.id}"]`)).toHaveCount(1);
      expect(fixture.readTree()).toEqual(after);
      expect(posts).toBe(1);
      expect(errors).toEqual([]);
      // 故意断开复制响应会产生对应请求错误；其他控制台错误/警告仍须单独拒绝并保存。
      const unexpectedConsole = consoleIssues.filter(issue => !(issue.path === "/api/document-library/batch" && /net::ERR_(CONNECTION_RESET|FAILED)/.test(issue.text)));
      expect(unexpectedConsole).toEqual([]);
      await expect(page.locator("nextjs-portal [data-nextjs-dialog], nextjs-portal [data-nextjs-dialog-overlay]")).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath("nested-copy-refreshed.png"), animations: "disabled" });
      await writeFile(testInfo.outputPath("nested-copy-receipts.json"), JSON.stringify({ before, after, mismatchedDigestRejected, posts, consoleIssues, unexpectedConsole }, null, 2));
    } finally {
      const cleanup = await fixture.cleanup();
      expect(cleanup).toEqual({ customer: null, archiveCount: 0, files: [], operations: [], objects: [] });
      expect(fixture.readTree()).toEqual({ folders: [], files: [], documents: [], batches: [] });
      await writeFile(testInfo.outputPath("nested-copy-cleanup.json"), JSON.stringify(cleanup));
      // 独立查询不复用 readTree 的目录范围，避免读取和清理共享同一个遗漏条件。
      expect(executeLearningSql(`select count(*) from public.document_operations where actor_id='${learningUser.id}';`)).toBe("0");
    }
  });
}
