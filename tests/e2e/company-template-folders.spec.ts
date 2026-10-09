import {openItemMenu,enterFolder} from "./helpers/document-explorer";
import {test,expect} from "@playwright/test";
import {randomUUID} from "node:crypto";
import {writeFileSync} from "node:fs";
import {documentAdmin,documentLogin,documentUser,readLibrary,cleanupDocuments,uploadDocumentFiles} from "./helpers/document-library";
import {confirmDocumentFolder,openNewDocument,readPersonalDocument,expectDocumentContains,expectDocumentSaved} from "./helpers/company-template-documents";

test.use({video:"off"});

test("新建选择目录、暂停保存、换位置、复制及资料库混合列表",async({page})=>{
  test.setTimeout(150000);const admin=documentAdmin();const ids:string[]=[];const prefix=`folder-document-${Date.now()}-`;const errors:string[]=[];
  page.on("pageerror",error=>errors.push(error.message));
  try {
    await documentLogin(page,"salesman");await page.goto("/salesman/documents?scope=folder");await readLibrary(page);
    await page.getByRole("button",{name:"新建子文件夹",exact:true}).click();let dialog=page.getByRole("dialog");await dialog.getByLabel("名称",{exact:true}).fill(prefix+"目标");await dialog.getByRole("button",{name:"确认",exact:true}).click();await expect(dialog).toHaveCount(0);
    const personal=(await readLibrary(page)).folders.find(folder=>folder.name===prefix+"目标")!;expect(personal).toBeTruthy();
    await page.goto("/salesman/company-templates");await expect(page.getByRole("link",{name:"我的文档",exact:true})).toHaveCount(0);
    await page.getByRole("button",{name:"新建文档",exact:true}).first().click();dialog=page.getByRole("dialog");await expect(dialog.getByRole("button",{name:"确认",exact:true})).toBeDisabled();
    await confirmDocumentFolder(page,personal.id);await expect(page).toHaveURL(/\/documents\/templates\/[a-f0-9-]+$/);const id=page.url().split("/").pop()!;ids.push(id);await expectDocumentSaved(page);
    const frame=page.frameLocator("iframe");await frame.locator("#client").fill(prefix+"自动保存");await expectDocumentContains(page,id,prefix+"自动保存");expect((await readPersonalDocument(id)).folder_id).toBe(personal.id);
    await page.getByRole("button",{name:"保存",exact:true}).click();dialog=page.getByRole("dialog");await expect(dialog.getByRole("combobox",{name:"目标文件夹",exact:true})).toContainText(prefix+"目标");
    await page.screenshot({path:"output/template-folder-picker-desktop.png"});
    const before=await readPersonalDocument(id);
    // 修改仍由真实表单产生；弹窗打开后即使收到延迟快照，也不能自动提交到旧目录。
    await frame.locator("#client").fill(prefix+"手动归档");await page.waitForTimeout(1400);expect((await readPersonalDocument(id)).revision).toBe(before.revision);
    await dialog.getByRole("button",{name:"取消",exact:true}).click();await expectDocumentContains(page,id,prefix+"手动归档");expect((await readPersonalDocument(id)).folder_id).toBe(personal.id);
    await page.getByRole("button",{name:"保存",exact:true}).click();dialog=page.getByRole("dialog");
    const destinations=await (await page.request.get("/api/company-template-documents/destinations")).json();const customer=destinations.archives.find((item:{customer_id:string})=>item.customer_id==="c1000000-0000-4000-8000-000000000002");const internal=destinations.folders.find((item:{archive_id:string;system_key:string})=>item.archive_id===customer.id&&item.system_key==="customer_internal");
    await confirmDocumentFolder(page,internal.id);await expect(dialog).toHaveCount(0);await expectDocumentContains(page,id,prefix+"手动归档");const doc=await readPersonalDocument(id);expect(doc.folder_id).toBe(internal.id);
    await page.reload();await expect(frame.locator("#client")).toHaveValue(prefix+"手动归档");
    await page.getByRole("button",{name:"另存一份",exact:true}).click();dialog=page.getByRole("dialog");await dialog.getByLabel("文档名称").fill(prefix+"副本");await confirmDocumentFolder(page,personal.id);
    await expect(page).not.toHaveURL(new RegExp(id+"$"));const copyId=page.url().split("/").pop()!;ids.push(copyId);await expectDocumentSaved(page);expect((await readPersonalDocument(copyId)).state).toEqual(doc.state);expect((await readPersonalDocument(copyId)).folder_id).toBe(personal.id);
    await page.getByRole("button",{name:"返回所在文件夹",exact:true}).click();await expect(page).toHaveURL(new RegExp(personal.id));await uploadDocumentFiles(page,[prefix+"上传.txt"]);
    await expect(page.locator(`[data-template-document="${copyId}"]`)).toBeVisible();await expect(page.locator("[data-document-file]")).toHaveCount(1);expect((await readLibrary(page)).total).toBe(2);
    await page.getByRole("button",{name:"上一级",exact:true}).click();await openItemMenu(page,page.locator(`[data-explorer-item="${personal.id}"]`),"删除");await expect(page.getByRole("dialog")).toContainText("1 份模板文档");await expect(page.getByRole("dialog").getByRole("button",{name:"确认",exact:true})).toBeDisabled();await page.getByRole("dialog").getByRole("button",{name:"取消",exact:true}).click();await enterFolder(page,personal.id);
    const row=page.locator(`[data-template-document="${copyId}"]`);
    // 模板填写沿用电脑端边界；手机从资料库管理入口检查同一个目录弹窗。
    await page.setViewportSize({width:375,height:812});await openItemMenu(page, row, "另存一份");dialog=page.getByRole("dialog");await expect(dialog.getByRole("textbox",{name:"搜索人员或客户"})).toBeVisible();
    await page.screenshot({path:"output/template-folder-picker-mobile.png"});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.keyboard.press("Tab");expect(await dialog.evaluate(element=>element.contains(document.activeElement))).toBe(true);await dialog.getByRole("button",{name:"取消",exact:true}).click();await page.setViewportSize({width:1280,height:800});
    await openItemMenu(page, row, "重命名");dialog=page.getByRole("dialog");await dialog.getByRole("textbox",{name:"名称",exact:true}).fill(prefix+"改名");await dialog.getByRole("button",{name:"确认",exact:true}).click();await expect(row.getByText(prefix+"改名",{exact:true})).toBeVisible();expect((await readPersonalDocument(copyId)).name).toBe(prefix+"改名");
    await page.reload();await expect(row.getByText(prefix+"改名",{exact:true})).toBeVisible();await openItemMenu(page, row, "移动到");await confirmDocumentFolder(page,internal.id);await expect(row).toHaveCount(0);expect((await readPersonalDocument(copyId)).folder_id).toBe(internal.id);
    await page.goto(`/salesman/documents?customer=${customer.customer_id}&folder=${internal.id}`);await expect(row.getByText(prefix+"改名",{exact:true})).toBeVisible();await page.reload();await expect(row).toBeVisible();await openItemMenu(page, row, "删除");await page.getByRole("dialog").getByRole("checkbox",{name:/我确认永久删除/}).check(); await page.getByRole("dialog").getByRole("button",{name:"确认",exact:true}).click();await expect(row).toHaveCount(0);expect((await admin.from("company_template_documents").select("id").eq("id",copyId)).data).toEqual([]);
    // 删除后等待真实列表重新出现，不能用加载中空列表证明删除或响应式布局通过。
    await page.setViewportSize({width:1280,height:800});await expect(page.locator(`[data-template-document="${id}"]`)).toBeVisible();await page.screenshot({path:"output/template-folders-desktop.png"});await page.setViewportSize({width:375,height:812});await expect(page.locator(`[data-template-document="${id}"]`)).toBeVisible();await page.screenshot({path:"output/template-folders-mobile.png"});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.locator("nextjs-portal [data-nextjs-dialog-overlay]")).toHaveCount(0);expect(errors).toEqual([]);
    writeFileSync("output/template-folder-receipts.json",JSON.stringify({id,folderId:doc.folder_id,revision:doc.revision,hash:doc.state_sha256,copyId,deleted:true,pageErrors:errors},null,2));
  } finally {await admin.from("company_template_documents").delete().in("id",ids);await cleanupDocuments(prefix);}
});

test("管理员创建客户文档，业务员编辑、共享客户只读与撤回",async({page,browser})=>{
  test.setTimeout(150000);const admin=documentAdmin();const ids:string[]=[];const viewer=await browser.newContext();const client=await viewer.newPage();
  try {
    await documentLogin(page,"administrator");await page.goto("/admin/company-templates");const destinations=await (await page.request.get("/api/company-template-documents/destinations")).json();const archive=destinations.archives.find((item:{customer_id:string})=>item.customer_id==="c1000000-0000-4000-8000-000000000002");const internal=destinations.folders.find((item:{archive_id:string;system_key:string})=>item.archive_id===archive.id&&item.system_key==="customer_internal");const shared=destinations.folders.find((item:{archive_id:string;system_key:string})=>item.archive_id===archive.id&&item.system_key==="shared");
    await page.getByRole("button",{name:"新建文档",exact:true}).first().click();await confirmDocumentFolder(page,internal.id);await expectDocumentSaved(page);const id=page.url().split("/").pop()!;ids.push(id);
    await page.frameLocator("iframe").locator("#client").fill("Admin created customer doc");await expectDocumentContains(page,id,"Admin created customer doc");
    await documentLogin(page,"salesman");await page.goto(`/salesman/documents/templates/${id}`);await expect(page.frameLocator("iframe").locator("#client")).toHaveValue("Admin created customer doc");await page.frameLocator("iframe").locator("#client").fill("Salesman edited other employee");await expectDocumentContains(page,id,"Salesman edited other employee");
    await page.getByRole("button",{name:"保存",exact:true}).click();const dialog=page.getByRole("dialog");await dialog.getByRole("combobox",{name:"目标文件夹",exact:true}).click();await page.getByRole("option",{name:"共享资料",exact:true}).click();await expect(dialog.getByRole("button",{name:"确认",exact:true})).toBeDisabled();await dialog.getByRole("checkbox").check();await dialog.getByRole("button",{name:"确认",exact:true}).click();await expect(dialog).toHaveCount(0);expect((await readPersonalDocument(id)).folder_id).toBe(shared.id);
    // 默认位置已经共享时，手动保存仍明确要求确认；自动保存由另外的通道处理。
    await page.getByRole("button",{name:"保存",exact:true}).click();await expect(dialog.getByRole("checkbox")).toBeVisible();await expect(dialog.getByRole("button",{name:"确认",exact:true})).toBeDisabled();await dialog.getByRole("checkbox").check();await dialog.getByRole("button",{name:"确认",exact:true}).click();await expect(dialog).toHaveCount(0);
    await documentLogin(client,"client");await client.addInitScript(()=>Object.defineProperty(window,"print",{value:()=>document.documentElement.dataset.printCalled="yes"}));await client.goto("/client/documents?scope=folder");await expect(client.locator(`[data-template-document="${id}"]`)).toBeVisible();await openItemMenu(client, client.locator(`[data-template-document="${id}"]`), "打开");await expect(client.getByRole("status").filter({hasText:"仅可查看"})).toBeVisible();await expect(client.getByRole("button",{name:"保存",exact:true})).toHaveCount(0);expect(await client.frameLocator("iframe").locator("body").evaluate(element=>(element as HTMLElement).inert)).toBe(true);
    await client.getByRole("button",{name:"打印或另存为 PDF",exact:true}).click();await expect(client.frameLocator("iframe").locator("html")).toHaveAttribute("data-print-called","yes");
    const doc=await readPersonalDocument(id);const blocked=await client.request.post("/api/company-template-documents",{data:{action:"save",documentId:id,operationId:randomUUID(),expectedRevision:doc.revision,state:{forbidden:true}}});expect(blocked.status()).toBe(403);expect((await readPersonalDocument(id)).revision).toBe(doc.revision);
    await page.getByRole("button",{name:"保存",exact:true}).click();await confirmDocumentFolder(page,internal.id);await client.reload();await expect(client.frameLocator("iframe").locator("#client")).toHaveCount(0);expect((await client.request.get(`/api/company-template-documents/${id}/content?loadToken=${randomUUID()}`)).status()).toBe(404);
    await page.reload();await expect(page.frameLocator("iframe").locator("#client")).toHaveValue("Salesman edited other employee");
    // 业务员不能通过目录接口看到其他员工的本人资料。
    const salesmanDestinations=await (await page.request.get("/api/company-template-documents/destinations")).json();const adminUser=await documentUser("administrator");expect(salesmanDestinations.archives.some((item:{user_id:string})=>item.user_id===adminUser)).toBe(false);
  } finally {await viewer.close();await admin.from("company_template_documents").delete().in("id",ids);}
});

test("位置断言识别错误归档，响应丢失重试确认同一文档及位置",async({page})=>{
  test.setTimeout(120000);const admin=documentAdmin();const ids:string[]=[];
  try {
    await documentLogin(page,"salesman");const id=await openNewDocument(page,ids);const original=await readPersonalDocument(id);
    const destinations=await (await page.request.get("/api/company-template-documents/destinations")).json();const archive=destinations.archives.find((item:{customer_id:string})=>item.customer_id==="c1000000-0000-4000-8000-000000000002");const internal=destinations.folders.find((item:{archive_id:string;system_key:string})=>item.archive_id===archive.id&&item.system_key==="customer_internal");
    await page.frameLocator("iframe").locator("#client").fill("Folder receipt proof");await expectDocumentContains(page,id,"Folder receipt proof");
    let lostOperation="";await page.route("**/api/company-template-documents",async route=>{const body=route.request().postDataJSON();lostOperation=body.operationId;await route.fetch();await route.abort("connectionreset");});
    await page.getByRole("button",{name:"保存",exact:true}).click();await confirmDocumentFolder(page,internal.id);await expect(page.getByRole("dialog").getByRole("alert")).toContainText("操作未完成");const committed=await readPersonalDocument(id);expect(committed.folder_id).toBe(internal.id);
    await page.unroute("**/api/company-template-documents");const retried:string[]=[];await page.route("**/api/company-template-documents",async route=>{retried.push(route.request().postDataJSON().operationId);await route.continue();});
    await page.getByRole("dialog").getByRole("button",{name:"确认",exact:true}).click();await expect(page.getByRole("dialog")).toHaveCount(0);expect(retried[0]).toBe(lostOperation);expect((await admin.from("company_template_documents").select("id").eq("id",id)).data).toHaveLength(1);await page.unroute("**/api/company-template-documents");
    // 只改变本次夹具的位置，让独立断言先失败，再由真实页面重新保存到正确目录。
    const broken=await admin.from("company_template_documents").update({folder_id:original.folder_id}).eq("id",id);expect(broken.error).toBeNull();let detected=false;
    try{expect((await readPersonalDocument(id)).folder_id).toBe(internal.id);}catch{detected=true;}expect(detected).toBe(true);
    await page.reload();await expectDocumentSaved(page);await page.getByRole("button",{name:"保存",exact:true}).click();await confirmDocumentFolder(page,internal.id);await expect(page.getByRole("dialog")).toHaveCount(0);expect((await readPersonalDocument(id)).folder_id).toBe(internal.id);
    await page.reload();await expect(page.frameLocator("iframe").locator("#client")).toHaveValue("Folder receipt proof");await page.getByRole("button",{name:"返回所在文件夹",exact:true}).click();await expect(page).toHaveURL(new RegExp(internal.id));await expect(page.locator(`[data-template-document="${id}"]`)).toBeVisible();
    await page.goto(`/salesman/documents/templates/${id}`);await expectDocumentSaved(page);
    // 请求根本未到服务器时取消归档，恢复的自动保存只能更新内容，不能暗中移动。
    await page.route("**/api/company-template-documents",route=>route.abort("connectionreset"));await page.getByRole("button",{name:"保存",exact:true}).click();await confirmDocumentFolder(page,original.folder_id);await expect(page.getByRole("dialog").getByRole("alert")).toContainText("操作未完成");await page.unroute("**/api/company-template-documents");await page.getByRole("dialog").getByRole("button",{name:"取消",exact:true}).click();await expectDocumentSaved(page);expect((await readPersonalDocument(id)).folder_id).toBe(internal.id);
    // 已经落库但回执丢失的操作不能被取消撤销；旧修订必须停止自动保存并要求重新打开。
    await page.route("**/api/company-template-documents",async route=>{await route.fetch();await route.abort("connectionreset");});await page.getByRole("button",{name:"保存",exact:true}).click();await confirmDocumentFolder(page,original.folder_id);await expect(page.getByRole("dialog").getByRole("alert")).toContainText("操作未完成");await page.unroute("**/api/company-template-documents");await page.getByRole("dialog").getByRole("button",{name:"取消",exact:true}).click();await expect(page.getByRole("status").filter({hasText:"已有新修改"})).toBeVisible();expect((await readPersonalDocument(id)).folder_id).toBe(original.folder_id);await page.reload();await expectDocumentSaved(page);await expect(page.frameLocator("iframe").locator("#client")).toHaveValue("Folder receipt proof");
    writeFileSync("output/template-folder-retry-evidence.json",JSON.stringify({id,folderId:(await readPersonalDocument(id)).folder_id,redGreenDetected:detected,retriedOriginalOperation:retried[0]===lostOperation,cancelledUnsentMove:true,cancelledCommittedMoveRequiresReload:true},null,2));
  } finally {await admin.from("company_template_documents").delete().in("id",ids);}
});
