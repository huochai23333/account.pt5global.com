import {openItemMenu,enterFolder} from "./helpers/document-explorer";
import {test,expect} from "@playwright/test";
import {randomUUID} from "node:crypto";
import {writeFileSync} from "node:fs";
import {documentAdmin,documentLogin,documentUser,readLibrary,cleanupDocuments,uploadDocumentFiles} from "./helpers/document-library";
import {confirmDocumentFolder,openNewDocument,readPersonalDocument,expectDocumentContains,expectDocumentSaved} from "./helpers/company-template-documents";

test.use({video:"off"});

test("草稿首次另存、普通保存、显式移动、副本及我的文档混合列表",async({page})=>{
  test.setTimeout(150000);const admin=documentAdmin();const ids:string[]=[];const prefix=`folder-document-${Date.now()}-`;const errors:string[]=[];
  page.on("pageerror",error=>errors.push(error.message));
  try {
    await documentLogin(page,"salesman");await page.goto("/salesman/documents?scope=folder");await readLibrary(page);
    await page.getByRole("button",{name:"新建子文件夹",exact:true}).click();let dialog=page.getByRole("dialog");await dialog.getByLabel("名称",{exact:true}).fill(prefix+"目标");await dialog.getByRole("button",{name:"确认",exact:true}).click();await expect(dialog).toHaveCount(0);
    const personal=(await readLibrary(page)).folders.find(folder=>folder.name===prefix+"目标")!;expect(personal).toBeTruthy();
    await page.goto("/salesman/company-templates");await expect(page.getByRole("heading",{name:"我的草稿",exact:true})).toBeVisible();
    await page.getByRole("button",{name:"新建文档",exact:true}).first().click();await expect(page).toHaveURL(/\/documents\/drafts\//);await expect(page.getByRole("dialog")).toHaveCount(0);
    await confirmDocumentFolder(page,personal.id);await expect(page).toHaveURL(/\/documents\/templates\/[a-f0-9-]+$/);const id=page.url().split("/").pop()!;ids.push(id);await expectDocumentSaved(page);
    const frame=page.frameLocator("iframe");await frame.locator("#client").fill(prefix+"自动保存");await expectDocumentContains(page,id,prefix+"自动保存");expect((await readPersonalDocument(id)).folder_id).toBe(personal.id);
    await page.getByRole("button",{name:"保存",exact:true}).click();await expect(page.getByRole("dialog")).toHaveCount(0);
    await frame.locator("#client").fill(prefix+"手动归档");await expectDocumentContains(page,id,prefix+"手动归档");
    await page.getByRole("button",{name:"移动",exact:true}).click();dialog=page.getByRole("dialog");
    const destinations=await (await page.request.get("/api/company-template-documents/destinations",{maxRetries:2})).json();const customer=destinations.archives.find((item:{customer_id:string})=>item.customer_id==="c1000000-0000-4000-8000-000000000002");const internal=destinations.folders.find((item:{archive_id:string;system_key:string})=>item.archive_id===customer.id&&item.system_key==="personal");
    await confirmDocumentFolder(page,internal.id);await expect(dialog).toHaveCount(0);await expectDocumentContains(page,id,prefix+"手动归档");const doc=await readPersonalDocument(id);expect(doc.folder_id).toBe(internal.id);
    await page.reload();await expect(frame.locator("#client")).toHaveValue(prefix+"手动归档");
    await page.getByRole("button",{name:"另存为",exact:true}).click();dialog=page.getByRole("dialog");await dialog.getByLabel("文件名").fill(prefix+"副本");await confirmDocumentFolder(page,personal.id);
    await expect(page).not.toHaveURL(new RegExp(id+"$"));const copyId=page.url().split("/").pop()!;ids.push(copyId);await expectDocumentSaved(page);expect((await readPersonalDocument(copyId)).state).toEqual(doc.state);expect((await readPersonalDocument(copyId)).folder_id).toBe(personal.id);
    await page.getByRole("button",{name:"返回所在文件夹",exact:true}).click();await expect(page).toHaveURL(new RegExp(personal.id));await uploadDocumentFiles(page,[prefix+"上传.txt"]);
    await expect(page.locator(`[data-template-document="${copyId}"]`)).toBeVisible();await expect(page.locator("[data-document-file]")).toHaveCount(1);expect((await readLibrary(page)).total).toBe(2);
    await page.getByRole("button",{name:"上一级",exact:true}).click();await openItemMenu(page,page.locator(`[data-explorer-item="${personal.id}"]`),"删除");await expect(page.getByRole("dialog")).toContainText("1 份模板文档");await expect(page.getByRole("dialog").getByRole("button",{name:"确认",exact:true})).toBeDisabled();await page.getByRole("dialog").getByRole("button",{name:"取消",exact:true}).click();await enterFolder(page,personal.id);
    const row=page.locator(`[data-template-document="${copyId}"]`);
    // 模板填写沿用电脑端边界；手机从资料库管理入口检查同一个目录弹窗。
    await page.setViewportSize({width:375,height:812});await openItemMenu(page, row, "另存一份");dialog=page.getByRole("dialog");await expect(dialog.getByRole("textbox",{name:"搜索当前文件夹及下级"})).toBeVisible();
    await page.screenshot({path:"output/template-folder-picker-mobile.png"});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.keyboard.press("Tab");expect(await dialog.evaluate(element=>element.contains(document.activeElement))).toBe(true);await dialog.getByRole("button",{name:"取消",exact:true}).click();await page.setViewportSize({width:1280,height:800});
    await openItemMenu(page, row, "重命名");dialog=page.getByRole("dialog");await dialog.getByRole("textbox",{name:"名称",exact:true}).fill(prefix+"改名");await dialog.getByRole("button",{name:"确认",exact:true}).click();await expect(row.getByText(prefix+"改名",{exact:true})).toBeVisible();expect((await readPersonalDocument(copyId)).name).toBe(prefix+"改名");
    await page.reload();await expect(row.getByText(prefix+"改名",{exact:true})).toBeVisible();await openItemMenu(page, row, "移动到");await confirmDocumentFolder(page,internal.id);await expect(row).toHaveCount(0);expect((await readPersonalDocument(copyId)).folder_id).toBe(internal.id);
    await page.goto(`/salesman/documents?customer=${customer.customer_id}&folder=${internal.id}`);await expect(row.getByText(prefix+"改名",{exact:true})).toBeVisible();await page.reload();await expect(row).toBeVisible();await openItemMenu(page, row, "删除");await page.getByRole("dialog").getByRole("checkbox",{name:/我确认永久删除/}).check(); await page.getByRole("dialog").getByRole("button",{name:"确认",exact:true}).click();await expect(row).toHaveCount(0);expect((await admin.from("company_template_documents").select("id").eq("id",copyId)).data).toEqual([]);
    // 删除后等待真实列表重新出现，不能用加载中空列表证明删除或响应式布局通过。
    await page.setViewportSize({width:1280,height:800});await expect(page.locator(`[data-template-document="${id}"]`)).toBeVisible();await page.screenshot({path:"output/template-folders-desktop.png"});await page.setViewportSize({width:375,height:812});await expect(page.locator(`[data-template-document="${id}"]`)).toBeVisible();await page.screenshot({path:"output/template-folders-mobile.png"});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.locator("nextjs-portal [data-nextjs-dialog-overlay]")).toHaveCount(0);expect(errors).toEqual([]);
    writeFileSync("output/template-folder-receipts.json",JSON.stringify({id,folderId:doc.folder_id,revision:doc.revision,hash:doc.state_sha256,copyId,deleted:true,pageErrors:errors},null,2));
  } finally {await admin.from("company_template_document_drafts").delete().in("id",ids);await admin.from("company_template_draft_operations").delete().in("draft_id",ids);await admin.from("company_template_documents").delete().in("id",ids);await cleanupDocuments(prefix);}
});

test("管理员创建客户文档，业务员编辑及归档，客户始终不可访问",async({page,browser})=>{
  test.setTimeout(150000);const admin=documentAdmin();const ids:string[]=[];const viewer=await browser.newContext();const client=await viewer.newPage();
  try {
    await documentLogin(page,"administrator");await page.goto("/admin/company-templates");const destinations=await (await page.request.get("/api/company-template-documents/destinations",{maxRetries:2})).json();const archive=destinations.archives.find((item:{customer_id:string})=>item.customer_id==="c1000000-0000-4000-8000-000000000002");const internal=destinations.folders.find((item:{archive_id:string;system_key:string})=>item.archive_id===archive.id&&item.system_key==="personal");
    await page.getByRole("button",{name:"新建文档",exact:true}).first().click();await expect(page).toHaveURL(/documents\/drafts\//);ids.push(page.url().split("/").pop()!);await confirmDocumentFolder(page,internal.id);await expectDocumentSaved(page);const id=page.url().split("/").pop()!;ids.push(id);
    await page.frameLocator("iframe").locator("#client").fill("Admin created customer doc");await expectDocumentContains(page,id,"Admin created customer doc");
    await documentLogin(page,"salesman");await page.goto(`/salesman/documents/templates/${id}`);await expect(page.frameLocator("iframe").locator("#client")).toHaveValue("Admin created customer doc");await page.frameLocator("iframe").locator("#client").fill("Salesman edited other employee");await expectDocumentContains(page,id,"Salesman edited other employee");
    await page.getByRole("button",{name:"保存",exact:true}).click();const dialog=page.getByRole("dialog");await expect(dialog).toHaveCount(0);expect((await readPersonalDocument(id)).folder_id).toBe(internal.id);
    // 手动保存可以直接确认当前资料目录；客户权限由档案授权独立核对。
    await page.getByRole("button",{name:"保存",exact:true}).click();await expect(dialog).toHaveCount(0);
    // 客户身份始终没有资料库访问权，不能打开或读取文档正文。
    await documentLogin(client,"client");await client.goto("/client/documents?scope=folder");await expect(client.locator(`[data-template-document="${id}"]`)).toHaveCount(0);await client.goto(`/client/documents/templates/${id}`);await expect(client.locator("iframe")).toHaveCount(0);expect((await client.request.get(`/api/company-template-documents/${id}/content?loadToken=${randomUUID()}`)).status()).toBe(403);
    const doc=await readPersonalDocument(id);const blocked=await client.request.post("/api/company-template-documents",{data:{action:"save",documentId:id,operationId:randomUUID(),expectedRevision:doc.revision,state:{forbidden:true}}});expect(blocked.status()).toBe(403);expect((await readPersonalDocument(id)).revision).toBe(doc.revision);
    await page.getByRole("button",{name:"保存",exact:true}).click();await expect(page.getByRole("dialog")).toHaveCount(0);await client.reload();await expect(client.frameLocator("iframe").locator("#client")).toHaveCount(0);expect((await client.request.get(`/api/company-template-documents/${id}/content?loadToken=${randomUUID()}`)).status()).toBe(403);
    await page.reload();await expect(page.frameLocator("iframe").locator("#client")).toHaveValue("Salesman edited other employee");
    // 业务员不能通过目录接口看到其他员工的资料文件夹。
    const salesmanDestinations=await (await page.request.get("/api/company-template-documents/destinations",{maxRetries:2})).json();const adminUser=await documentUser("administrator");expect(salesmanDestinations.archives.some((item:{user_id:string})=>item.user_id===adminUser)).toBe(false);
  } finally {await viewer.close();await admin.from("company_template_document_drafts").delete().in("id",ids);await admin.from("company_template_draft_operations").delete().in("draft_id",ids);await admin.from("company_template_documents").delete().in("id",ids);}
});

test("另存为响应丢失沿用原编号，独立位置断言识别错误归档后恢复",async({page})=>{
 test.setTimeout(150000);const admin=documentAdmin();const ids:string[]=[];const prefix=`folder-retry-${Date.now()}-`;
 try{await documentLogin(page,"salesman");const id=await openNewDocument(page,ids);await page.frameLocator("iframe").locator("#client").fill(prefix);await expectDocumentContains(page,id,prefix);const original=await readPersonalDocument(id);
  const destinations=await(await page.request.get("/api/company-template-documents/destinations",{maxRetries:2})).json();const archive=destinations.archives.find((a:{customer_id:string})=>a.customer_id==="c1000000-0000-4000-8000-000000000002");const target=destinations.folders.find((f:{archive_id:string;system_key:string})=>f.archive_id===archive.id&&f.system_key==="personal");
  await page.getByRole("button",{name:"另存为",exact:true}).click();const dialog=page.getByRole("dialog");await dialog.getByLabel("文件名",{exact:true}).fill(prefix+"副本");await dialog.locator(`[data-save-as-tree-folder="${target.id}"]`).click();await expect(dialog.locator("[data-save-as-content]")).toHaveAttribute("aria-busy","false");let operation="";let copyId="";
  await page.route("**/api/company-template-documents",async route=>{const body=route.request().postDataJSON();operation=body.operationId;copyId=body.documentId;ids.push(copyId);await route.fetch();await route.abort("connectionreset");});await dialog.getByRole("button",{name:"保存",exact:true}).click();await expect(dialog.getByRole("alert")).toBeVisible();await expect(dialog.getByLabel("文件名",{exact:true})).toBeDisabled();await expect(dialog.locator(`[data-save-as-tree-folder="${target.id}"]`)).toBeDisabled();await page.unroute("**/api/company-template-documents");const committed=await readPersonalDocument(copyId);expect(committed.folder_id).toBe(target.id);
  let retried="";await page.route("**/api/company-template-documents",async route=>{retried=route.request().postDataJSON().operationId;await route.continue();});await dialog.getByRole("button",{name:"保存",exact:true}).click();await expect(page).toHaveURL(new RegExp(copyId+"$"));await page.unroute("**/api/company-template-documents");expect(retried).toBe(operation);expect((await admin.from("company_template_documents").select("id").eq("id",copyId)).data).toHaveLength(1);expect((await readPersonalDocument(id)).folder_id).toBe(original.folder_id);
  // 只改变已记录的夹具编号，确认读回断言会拒绝错误位置，再恢复真实位置。
  expect((await admin.from("company_template_documents").update({folder_id:original.folder_id}).eq("id",copyId)).error).toBeNull();let detected=false;try{expect((await readPersonalDocument(copyId)).folder_id).toBe(target.id);}catch{detected=true;}expect(detected).toBe(true);expect((await admin.from("company_template_documents").update({folder_id:target.id}).eq("id",copyId)).error).toBeNull();await page.reload();await expect(page.frameLocator("iframe").locator("#client")).toHaveValue(prefix);await page.getByRole("button",{name:"返回所在文件夹",exact:true}).click();await expect(page.locator(`[data-template-document="${copyId}"]`)).toBeVisible();
  writeFileSync("output/template-folder-retry-evidence.json",JSON.stringify({sourceId:id,copyId,folderId:target.id,retriedOriginalOperation:true,redGreenDetected:detected},null,2));
 }finally{await admin.from("company_template_document_drafts").delete().in("id",ids);await admin.from("company_template_draft_operations").delete().in("draft_id",ids);await admin.from("company_template_documents").delete().in("id",ids);}
});
