import { expect, test } from "@playwright/test";
import { setTestLocale } from "./helpers/auth";
import { authoritativeFiles, checkDocumentViewport, chooseDocumentFolder, cleanupDocuments, confirmFileObjects, documentAdmin, documentLogin, documentPdf, documentReader, documentUser, readLibrary, uploadDocumentFiles } from "./helpers/document-library";

test("资料库：建目录、上传同名文件、重命名、移动、搜索、预览与删除保持真实结果", async ({ page }) => {
  test.setTimeout(180_000);
  const prefix = `docs-crud-${Date.now()}-`;
  const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  try {
    await documentLogin(page, "administrator"); await page.goto("/admin/documents");
    await expect(page.getByRole("heading", { name: "本人资料", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "新建子文件夹", exact: true }).click();
    let dialog = page.getByRole("dialog"); await dialog.getByRole("textbox", { name: "名称" }).fill(`${prefix}合同`); await dialog.getByRole("button", { name: "确认", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    const folder = (await readLibrary(page)).folders.find((item) => item.name === `${prefix}合同`)!;
    expect(folder.version).toBe(1); expect(folder.system_key).toBeNull();
    await chooseDocumentFolder(page, `${prefix}合同`);
    await page.getByRole("button", { name: "重命名文件夹", exact: true }).click();
    dialog = page.getByRole("dialog"); await dialog.getByRole("textbox", { name: "名称" }).fill(`${prefix}归档`); await dialog.getByRole("button", { name: "确认", exact: true }).click();
    await expect(dialog).toHaveCount(0); expect((await readLibrary(page)).folders.find((item) => item.id === folder.id)?.version).toBe(2);
    await uploadDocumentFiles(page, [`${prefix}资料.txt`, `${prefix}资料.txt`]);
    let files = await authoritativeFiles([`${prefix}资料.txt`]); expect(files).toHaveLength(2); expect(new Set(files.map((file) => file.id)).size).toBe(2); await confirmFileObjects(files);
    await page.reload(); await expect(page.locator('[data-document-file]')).toHaveCount(2);
    const first = files[0]; let card = page.locator(`[data-document-file="${first.id}"]`);
    await card.getByRole("button", { name: "重命名文件", exact: true }).click(); dialog = page.getByRole("dialog"); await dialog.getByRole("textbox", { name: "名称" }).fill(`${prefix}新名称.txt`); await dialog.getByRole("button", { name: "确认", exact: true }).click(); await expect(dialog).toHaveCount(0);
    files = await authoritativeFiles([`${prefix}新名称.txt`]); expect(files[0].id).toBe(first.id); expect(files[0].version).toBe(first.version + 1); expect(files[0].storage_path).toBe(first.storage_path);
    await page.getByRole("textbox", { name: "搜索文件" }).fill("新名称"); await page.getByRole("button", { name: "搜索文件", exact: true }).click(); await expect(page.locator('[data-document-file]')).toHaveCount(1);
    card = page.locator(`[data-document-file="${first.id}"]`); await card.getByRole("button", { name: "移动文件", exact: true }).click(); dialog = page.getByRole("dialog"); await dialog.getByRole("combobox", { name: "目标文件夹" }).click(); await page.getByRole("option", { name: "本人资料", exact: true }).click(); await dialog.getByRole("button", { name: "确认", exact: true }).click(); await expect(dialog).toHaveCount(0);
    const moved = (await authoritativeFiles([`${prefix}新名称.txt`]))[0]; expect(moved.folder_id).not.toBe(folder.id); expect(moved.storage_path).toBe(first.storage_path);
    await chooseDocumentFolder(page, "本人资料"); await uploadDocumentFiles(page, [`${prefix}预览.pdf`], documentPdf(), "application/pdf");
    const pdf = (await authoritativeFiles([`${prefix}预览.pdf`]))[0]; await page.locator(`[data-document-file="${pdf.id}"]`).getByRole("button", { name: "预览", exact: true }).click();
    await expect(page.getByRole("dialog").locator("iframe")).toHaveAttribute("src", `/api/document-library/files/${pdf.id}/content?preview=1`);
    const response = await page.request.get(`/api/document-library/files/${pdf.id}/content?preview=1`); expect(response.status()).toBe(200); expect(response.headers()["cache-control"]).toBe("private, no-store"); expect(response.headers()["content-type"]).toBe("application/pdf");
    expect(response.headers()["content-security-policy"]).not.toContain("sandbox");
    // 保存实际预览界面供人工核对，不能只凭内容接口成功推断浏览器已经显示 PDF。
    // 工作台有持续连接，不能等待全站网络空闲；读取 Chrome 原生阅读器的实际首屏加载状态。
    await expect.poll(async () => {
      for (const frame of page.frames()) {
        const viewer = frame.locator("pdf-viewer");
        if (await viewer.count()) return viewer.evaluate((element) => Reflect.get(element, "initialLoadComplete_") === true).catch(() => false);
      }
      return false;
    }, { timeout: 10_000 }).toBe(true);
    await page.screenshot({ path: "output/documents-pdf-preview.png", fullPage: true });
    await page.getByRole("dialog").getByRole("button", { name: "取消", exact: true }).click();
    const imageBytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aAtIAAAAASUVORK5CYII=", "base64");
    await uploadDocumentFiles(page, [`${prefix}图片.png`], imageBytes, "image/png"); const image = (await authoritativeFiles([`${prefix}图片.png`]))[0];
    await page.locator(`[data-document-file="${image.id}"]`).getByRole("button", { name: "预览", exact: true }).click();
    await expect.poll(() => page.frameLocator("iframe").locator("img").evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBe(1);
    await page.getByRole("dialog").getByRole("button", { name: "取消", exact: true }).click();
    for (const width of [1440, 390, 320]) await checkDocumentViewport(page, width, "crud");
    const download = await page.request.get(`/api/document-library/files/${first.id}/content`); expect(download.ok()).toBe(true); expect(download.headers()["content-disposition"]).toContain("attachment");
    await page.locator(`[data-document-file="${first.id}"]`).getByRole("button", { name: "删除文件", exact: true }).click(); dialog = page.getByRole("dialog"); await dialog.getByRole("button", { name: "确认", exact: true }).click(); await expect(dialog).toHaveCount(0);
    expect(await authoritativeFiles([`${prefix}新名称.txt`])).toHaveLength(0);
    const missing = await documentAdmin().storage.from("document-library").exists(first.storage_path); expect(missing.data).toBe(false);
    await page.reload(); await expect(page.locator(`[data-document-file="${first.id}"]`)).toHaveCount(0);
    expect(errors).toEqual([]);
    await setTestLocale(page, "en"); await page.reload(); await expect(page.getByRole("heading", { name: "Documents", exact: true })).toBeVisible();
  } finally { await cleanupDocuments(prefix); }
});

test("员工本人资料与管理员内部资料隔离，无业务员工也能进入", async ({ page }) => {
  test.setTimeout(120_000); const prefix = `docs-employee-${Date.now()}-`;
  try {
    const employee = await documentUser("operator");
    await documentLogin(page, "administrator"); await page.goto(`/admin/documents?user=${employee}`); await chooseDocumentFolder(page, "内部资料"); await uploadDocumentFiles(page, [`${prefix}人事.txt`]);
    const internal = (await authoritativeFiles([`${prefix}人事.txt`]))[0];
    await documentLogin(page, "operator"); await page.goto("/operator/documents"); await expect(page.getByRole("heading", { name: "本人资料", exact: true })).toBeVisible();
    const library = await readLibrary(page); expect(library.folders.some((folder) => folder.zone === "staff_internal")).toBe(false); expect(library.archives.filter((archive) => archive.kind === "employee").every((archive) => archive.user_id === employee)).toBe(true);
    expect((await page.request.get(`/api/document-library/files/${internal.id}/content`)).status()).toBe(403);
    await uploadDocumentFiles(page, [`${prefix}本人.txt`]); const own = await authoritativeFiles([`${prefix}本人.txt`]); expect(own[0].uploaded_by).toBe(employee); await confirmFileObjects(own);
    await documentLogin(page, "administrator"); await page.goto(`/admin/documents?user=${employee}`);
    await page.locator(`[data-document-file="${own[0].id}"]`).getByRole("button", { name: "移动文件", exact: true }).click(); const dialog = page.getByRole("dialog"); await dialog.getByRole("combobox", { name: "目标文件夹" }).click(); await page.getByRole("option", { name: "内部资料", exact: true }).click(); await dialog.getByRole("button", { name: "确认", exact: true }).click(); await expect(dialog).toHaveCount(0);
    // 原上传凭证也按当前目录重新授权，不泄露转入内部区域后的文件登记信息。
    const employeeClient = await documentReader("operator"); const receipts = await employeeClient.from("document_operations").select("receipt").contains("receipt", { record: { id: own[0].id } }); expect(receipts.error).toBeNull(); expect(receipts.data).toEqual([]);
    const originalOperation = await documentAdmin().from("document_operations").select("id,payload").eq("action", "reserve_upload").contains("receipt", { record: { id: own[0].id } }).single();
    expect((await employeeClient.rpc("document_library_command", { p_operation: originalOperation.data!.id, p_action: "reserve_upload", p_payload: originalOperation.data!.payload })).error).not.toBeNull();
    expect((await employeeClient.storage.from("document-library").download(own[0].storage_path)).error).not.toBeNull();
    // 管理员删除员工上传的文件，也必须证明对象与登记均消失，不能仅测试删除自己上传的文件。
    await chooseDocumentFolder(page, "内部资料"); await page.locator(`[data-document-file="${own[0].id}"]`).getByRole("button", { name: "删除文件", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "确认", exact: true }).click(); await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(await authoritativeFiles([`${prefix}本人.txt`])).toHaveLength(0); expect((await documentAdmin().storage.from("document-library").exists(own[0].storage_path)).data).toBe(false);
    await documentLogin(page, "promoter"); await page.getByRole("link", { name: "资料库", exact: true }).click(); await expect(page).toHaveURL(/\/promoter\/documents/); await expect(page.getByRole("heading", { name: "本人资料", exact: true })).toBeVisible();
    await uploadDocumentFiles(page, [`${prefix}无业务.txt`]); await confirmFileObjects(await authoritativeFiles([`${prefix}无业务.txt`]));
  } finally { await cleanupDocuments(prefix); }
});
