import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { authoritativeFiles, cleanupDocuments, documentAdmin, documentLogin, documentReader, documentUser, readLibrary, uploadDocumentFiles } from "./helpers/document-library";

// 同一账号可能有其他未完成资料，恢复必须点击本次文件对应的操作，不能选择首个同名按钮。
async function reconcileUpload(page:Page,name:string){
 const pending=page.getByRole("heading",{name:"需要继续处理的资料",exact:true}).locator("..").locator(":scope > div").filter({hasText:name});await expect(pending).toBeVisible();await pending.getByRole("button",{name:"继续核对",exact:true}).click();
}

test.use({video:"off"});

test("客户资料只有一个默认目录，内部协作和 Storage 均核对当前授权", async ({ page }) => {
  test.setTimeout(150000);const prefix=`docs-scope-${Date.now()}-`;const admin=documentAdmin();const clientId=await documentUser("client");
  const customer=(await admin.from("wholesale_customers").select("id").eq("registered_user_id",clientId).single()).data!;
  try {
    await documentLogin(page,"administrator");await page.goto(`/admin/documents?customer=${customer.id}&scope=folder`);await uploadDocumentFiles(page,[prefix+"资料.txt"]);
    const file=(await authoritativeFiles([prefix+"资料.txt"]))[0];const initial=await readLibrary(page);expect(initial.folders.filter(f=>f.archive_id===initial.archiveId&&f.parent_id===null)).toHaveLength(1);
    await expect(page.getByRole("tree").getByRole("button",{name:"资料文件夹",exact:true})).toHaveCount(1);
    for(const role of ["finance","salesman","operator"] as const){
      await documentLogin(page,role);await page.goto(`/${role}/documents?customer=${customer.id}&scope=folder`);const library=await readLibrary(page);expect(library.canManage).toBe(role!=="operator");await expect(page.locator(`[data-document-file="${file.id}"]`)).toBeVisible();
      if(role!=="operator")await uploadDocumentFiles(page,[prefix+role+".txt"]);
      else expect((await page.request.post("/api/document-library",{data:{operationId:randomUUID(),action:"rename_file",payload:{fileId:file.id,version:file.version,name:"越权.txt"}}})).status()).toBe(403);
      await page.reload();await expect(page.locator(`[data-document-file="${file.id}"]`)).toBeVisible();
    }
    // 客户账号没有资料库权限，目录、搜索数量、正文及对象地址都必须拒绝。
    await documentLogin(page,"client");await page.goto("/client/documents?scope=folder");await expect(page.locator(`[data-document-file="${file.id}"]`)).toHaveCount(0);await expect(page.getByRole("button",{name:"新建子文件夹"})).toHaveCount(0);
    expect((await page.request.get(`/api/document-library/files/${file.id}/content`)).status()).toBe(403);expect((await page.request.get(`/api/document-library?query=${prefix}`)).status()).toBe(403);
    const direct=await documentReader("client");for(const table of ["document_folders","document_files","company_template_documents","document_batches"]){const result=await direct.from(table).select("id");expect(result.error).toBeNull();expect(result.data).toEqual([]);}
    expect((await direct.storage.from("document-library").download(file.storage_path)).error).not.toBeNull();expect((await direct.storage.from("document-library").upload(`${randomUUID()}.txt`,Buffer.from("forged"))).error).not.toBeNull();
    expect((await page.request.post("/api/document-library",{data:{operationId:randomUUID(),action:"rename_file",payload:{fileId:file.id,version:file.version,name:prefix+"篡改.txt"}}})).status()).toBe(403);await page.reload();expect((await authoritativeFiles([file.name]))[0].version).toBe(file.version);
  }finally{await cleanupDocuments(prefix);}
});

test("文件失败、部分完成、错误凭证和断线恢复不会伪报成功", async ({ page }) => {
  test.setTimeout(150_000); const prefix = `docs-failure-${Date.now()}-`;
  try {
    await documentLogin(page, "administrator"); await page.goto("/admin/documents?scope=folder");
    // 错误提示先出现，目录核对随后结束；必须等上传按钮恢复，不能向禁用控件注入下一次选择。
    await expect(page.getByRole("button",{name:"上传资料",exact:true})).toBeEnabled();
    await page.locator('input[type="file"]').setInputFiles([{ name: `${prefix}有效.txt`, mimeType: "text/plain", buffer: Buffer.from("valid") }, { name: `${prefix}假PDF.pdf`, mimeType: "application/pdf", buffer: Buffer.from("<html>fake</html>") }]);
    await expect(page.locator('[data-document-result="partial_failed"]')).toBeVisible();
    expect(await authoritativeFiles([`${prefix}有效.txt`])).toHaveLength(1); expect(await authoritativeFiles([`${prefix}假PDF.pdf`])).toHaveLength(0);
    await expect(page.getByRole("button",{name:"上传资料",exact:true})).toBeEnabled();
    await page.locator('input[type="file"]').setInputFiles({ name: `${prefix}空.txt`, mimeType: "text/plain", buffer: Buffer.alloc(0) }); await expect(page.locator("[data-document-result]").filter({ hasText: "文件格式或名称不符合要求，请检查后重试。" })).toBeVisible();
    await expect(page.getByRole("button",{name:"上传资料",exact:true})).toBeEnabled();
    await page.locator('input[type="file"]').setInputFiles({ name: `${prefix}大.png`, mimeType: "image/png", buffer: Buffer.alloc(5 * 1024 * 1024) }); await expect(page.locator("[data-document-result]").filter({ hasText: "文件太大，请按页面说明压缩后上传。" })).toBeVisible();
    let originalId = "";
    await page.route("**/api/document-library/upload", async (route) => {
      const response = await route.fetch(); const result = await response.json(); originalId = result.record.id;
      await route.fulfill({ response, json: { ...result, record: { ...result.record, id: randomUUID() } } });
    });
    await expect(page.getByRole("button",{name:"上传资料",exact:true})).toBeEnabled();
    await page.locator('input[type="file"]').setInputFiles({ name: `${prefix}凭证.txt`, mimeType: "text/plain", buffer: Buffer.from("proof") });
    await expect(page.locator("[data-document-result]").filter({ hasText: "尚未确认处理完成，请继续核对原操作。" })).toBeVisible(); await expect(page.locator('[data-document-result="succeeded"]')).toHaveCount(0);
    const actual = (await authoritativeFiles([`${prefix}凭证.txt`]))[0]; expect(actual.id).toBe(originalId);
    await page.unroute("**/api/document-library/upload"); await page.reload(); await reconcileUpload(page,`${prefix}凭证.txt`); await expect(page.locator('[data-document-result="succeeded"]')).toBeVisible();
    expect(await authoritativeFiles([`${prefix}凭证.txt`])).toHaveLength(1);
    // 服务端完成但响应丢失，刷新后沿用原操作核对，不重复保存文件。
    await page.route("**/api/document-library/upload", async (route) => { await route.fetch(); await route.abort("connectionreset"); });
    await expect(page.getByRole("button",{name:"上传资料",exact:true})).toBeEnabled();
    await page.locator('input[type="file"]').setInputFiles({ name: `${prefix}断线.txt`, mimeType: "text/plain", buffer: Buffer.from("disconnect") }); await expect(page.locator("[data-document-result]").filter({ hasText: "尚未确认处理完成，请继续核对原操作。" })).toBeVisible();
    await page.unroute("**/api/document-library/upload"); await page.reload(); await reconcileUpload(page,`${prefix}断线.txt`); await expect(page.locator('[data-document-result="succeeded"]')).toBeVisible(); expect(await authoritativeFiles([`${prefix}断线.txt`])).toHaveLength(1);
    const library = await readLibrary(page); const file = (await authoritativeFiles([`${prefix}有效.txt`]))[0];
    const operationId = randomUUID(); const body = { operationId, action: "rename_file", payload: { fileId: file.id, version: file.version, name: `${prefix}新.txt` } };
    const first = await page.request.post("/api/document-library", { data: body }); const repeated = await page.request.post("/api/document-library", { data: body }); expect(await repeated.json()).toEqual(await first.json());
    const stale = await page.request.post("/api/document-library", { data: { ...body, operationId: randomUUID() } }); expect(stale.status()).toBe(400);
    const missing = await page.request.post("/api/document-library", { data: { operationId: randomUUID(), action: "delete_file", payload: { fileId: randomUUID(), version: 1 } } }); expect(missing.status()).toBe(403);
    const defaultDelete = await page.request.post("/api/document-library", { data: { operationId: randomUUID(), action: "delete_folder", payload: { folderId: library.folderId, version: 1 } } }); expect(defaultDelete.status()).toBe(400);
    // 从文件选择发起真实上传，在网络层同时重送同一操作，两个结果必须是同一份完整凭证。
    await page.route("**/api/document-library/upload", async (route) => {
      const responses = await Promise.all([route.fetch(), route.fetch()]); const receipts = await Promise.all(responses.map((response) => response.json()));
      expect(receipts[0].status).toBe("succeeded"); expect(receipts[1]).toEqual(receipts[0]); await route.fulfill({ response: responses[0] });
    });
    await uploadDocumentFiles(page, [`${prefix}并发上传.txt`]); await page.unroute("**/api/document-library/upload");
    const repeatedUpload = await authoritativeFiles([`${prefix}并发上传.txt`]); expect(repeatedUpload).toHaveLength(1); expect((await documentAdmin().storage.from("document-library").exists(repeatedUpload[0].storage_path)).data).toBe(true);
    await page.reload(); await expect(page.locator(`[data-document-file="${repeatedUpload[0].id}"]`)).toHaveCount(1);
  } finally { await cleanupDocuments(prefix); }
});
