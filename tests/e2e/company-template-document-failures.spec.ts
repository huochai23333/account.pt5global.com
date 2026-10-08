import {randomUUID} from "node:crypto";
import {expect,test,type Page} from "@playwright/test";
import {loginAs} from "./helpers/auth";
import {requireLocalAdminClient,deleteTemplate,fillPublishDialog,withDocumentProtocol} from "./helpers/company-template-actions";
import {openNewDocument,readPersonalDocument,expectDocumentContains,expectDocumentSaved} from "./helpers/company-template-documents";

test("浏览器离线保留内容，联网后自动保存并能在新登录会话打开",async({page,browser})=>{
  test.setTimeout(120000);const admin=requireLocalAdminClient();const ids:string[]=[];await loginAs(page,"salesman");
  try{
    const id=await openNewDocument(page,ids);const original=await readPersonalDocument(id);
    // 使用真实浏览器离线开关，不伪造在线事件；独立 Node 查库仍能核对未发生写入。
    await page.context().setOffline(true);await page.frameLocator("iframe").locator("#client").fill("Offline retained client");
    await expect(page.getByRole("status").filter({hasText:"保存失败"})).toBeVisible();expect((await readPersonalDocument(id)).revision).toBe(original.revision);await expect(page.frameLocator("iframe").locator("#client")).toHaveValue("Offline retained client");
    await page.context().setOffline(false);await expectDocumentContains(page,id,"Offline retained client");
    // 全新的登录会话验证文档跟随本人账号，不依赖原浏览器缓存或存储。
    const fresh=await browser.newContext();try{const next=await fresh.newPage();await loginAs(next,"salesman");await next.goto(page.url());await expect(next.frameLocator("iframe").locator("#client")).toHaveValue("Offline retained client");await expectDocumentSaved(next);}finally{await fresh.close();}
    await page.reload();await expect(page.frameLocator("iframe").locator("#client")).toHaveValue("Offline retained client");
  }finally{await page.context().setOffline(false);await admin.from("company_template_documents").delete().in("id",ids);}
});

test("断线重试防重、业务失败与未保存离开提醒",async({page})=>{
  test.setTimeout(120000);const admin=requireLocalAdminClient();const ids:string[]=[];await loginAs(page,"salesman");
  try{
    const id=await openNewDocument(page,ids);const frame=page.frameLocator("iframe");
    let rejectedOperation="";
    await page.route("**/api/company-template-documents",async route=>{
      const body=route.request().postDataJSON();if(body.action!=="save"){await route.continue();return;}
      rejectedOperation=body.operationId;
      // 真正提交到本地数据库后丢弃响应，模拟写入已经完成但浏览器断线。
      await route.fetch();await route.abort("connectionreset");
    });
    await frame.locator("#client").fill("Disconnect saved content");await expect(page.getByRole("status").filter({hasText:"保存失败"})).toBeVisible();
    const committed=await readPersonalDocument(id);expect(JSON.stringify(committed.state)).toContain("Disconnect saved content");
    let acceptedOperation="";await page.unroute("**/api/company-template-documents");
    await page.route("**/api/company-template-documents",async route=>{acceptedOperation=route.request().postDataJSON().operationId;await route.continue();});
    await page.evaluate(()=>window.dispatchEvent(new Event("online")));await expectDocumentSaved(page);
    expect(acceptedOperation).toBe(rejectedOperation);expect((await readPersonalDocument(id)).revision).toBe(committed.revision);
    await page.unroute("**/api/company-template-documents");
    await page.route("**/api/company-template-documents",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({ok:false,error:"document_failed"})}));
    await frame.locator("#client").fill("Business failure content");await expect(page.getByRole("status").filter({hasText:"保存失败"})).toBeVisible();expect((await readPersonalDocument(id)).revision).toBe(committed.revision);
    await page.getByRole("link",{name:"公司模板",exact:true}).first().click();await page.getByRole("dialog",{name:"尚有未保存内容"}).getByRole("button",{name:"暂不操作",exact:true}).click();await expect(page).toHaveURL(new RegExp(id+"$"));await expect(frame.locator("#client")).toHaveValue("Business failure content");
    await page.unroute("**/api/company-template-documents");await page.getByRole("button",{name:"保存",exact:true}).click();await expectDocumentContains(page,id,"Business failure content");
    await page.reload();await expect(frame.locator("#client")).toHaveValue("Business failure content");
  }finally{await admin.from("company_template_documents").delete().in("id",ids);}
});

test("多窗口冲突保留当前内容并可另存一份",async({page})=>{
  test.setTimeout(120000);const admin=requireLocalAdminClient();const ids:string[]=[];await loginAs(page,"salesman");let second:Page|undefined;
  try{
    const id=await openNewDocument(page,ids);second=await page.context().newPage();await second.goto(page.url());await expectDocumentSaved(second);
    await page.frameLocator("iframe").locator("#client").fill("First window authoritative");await expectDocumentContains(page,id,"First window authoritative");
    await second.frameLocator("iframe").locator("#client").fill("Second window unsaved");await expect(second.getByRole("status").filter({hasText:"其他窗口修改"})).toBeVisible();expect(JSON.stringify((await readPersonalDocument(id)).state)).toContain("First window authoritative");
    await second.getByRole("button",{name:"另存一份",exact:true}).click();const dialog=second.getByRole("dialog");await dialog.getByLabel("文档名称").fill("Conflict copy");await dialog.getByRole("button",{name:"确认",exact:true}).click();await expect(second).not.toHaveURL(new RegExp(id+"$"));const copyId=second.url().split("/").pop()!;ids.push(copyId);await expectDocumentContains(second,copyId,"Second window unsaved");
    await page.reload();await expect(page.frameLocator("iframe").locator("#client")).toHaveValue("First window authoritative");
    // 两种冲突处理都从页面验证：另存后再制造一次冲突，选择重新打开数据库最新内容。
    await second.goto(page.url());await expectDocumentSaved(second);await page.frameLocator("iframe").locator("#client").fill("Latest other window content");await expectDocumentContains(page,id,"Latest other window content");
    await second.frameLocator("iframe").locator("#client").fill("Explicitly discarded edit");await expect(second.getByRole("status").filter({hasText:"其他窗口修改"})).toBeVisible();
    second.once("dialog",async prompt=>{await prompt.accept();});await second.getByRole("button",{name:"重新打开最新内容",exact:true}).click();await second.getByRole("dialog",{name:"尚有未保存内容"}).getByRole("button",{name:"确认操作",exact:true}).click();
    await expect(second.frameLocator("iframe").locator("#client")).toHaveValue("Latest other window content");await expectDocumentSaved(second);expect(JSON.stringify((await readPersonalDocument(id)).state)).toContain("Latest other window content");
  }finally{await second?.close();await admin.from("company_template_documents").delete().in("id",ids);}
});

test("模板更新和停用不改变个人文档绑定的版本",async({page,browser})=>{
  test.setTimeout(120000);const admin=requireLocalAdminClient();const ids:string[]=[];const templateId=randomUUID();const v1=randomUUID();const v2=randomUUID();const marker=`Document version ${Date.now()}`;
  const manager=await browser.newContext();const managerPage=await manager.newPage();await loginAs(managerPage,"administrator");
  const {data:seed,error}=await admin.from("company_template_versions").select("html_content").eq("id","a3200000-0000-4000-8000-000000000003").single();if(error)throw error;
  const publish=async(versionId:string,revision:string,html:string)=>{const response=await managerPage.request.post("/api/company-templates/publish",{multipart:{templateId,versionId,expectedRevision:revision,name:marker,slug:`doc-version-${templateId}`,description:"Document version test",htmlFile:{name:"version.html",mimeType:"text/html",buffer:Buffer.from(html)}}});expect(response.ok()).toBe(true);};
  try{
    await publish(v1,"",seed.html_content);await loginAs(page,"salesman");await page.goto("/salesman/company-templates");await page.locator("article").filter({hasText:marker}).getByRole("button",{name:"新建文档",exact:true}).click();await expect(page).toHaveURL(/\/documents\/[a-f0-9-]+$/);const id=page.url().split("/").pop()!;ids.push(id);await expectDocumentSaved(page);
    await page.frameLocator("iframe").locator("#client").fill("Pinned document client");await expectDocumentContains(page,id,"Pinned document client");await publish(v2,"1",seed.html_content+"<!-- second version -->");
    await page.goto("/salesman/company-templates");await page.locator("article").filter({hasText:marker}).getByRole("button",{name:"新建文档",exact:true}).click();await expect(page).toHaveURL(/\/documents\/[a-f0-9-]+$/);const newId=page.url().split("/").pop()!;ids.push(newId);await expectDocumentSaved(page);expect((await readPersonalDocument(newId)).template_version_id).toBe(v2);
    await managerPage.goto("/admin/company-templates");await managerPage.locator("article").filter({hasText:marker}).getByRole("button",{name:"停用",exact:true}).click();await expect.poll(async()=>{const {data}=await admin.from("company_templates").select("status").eq("id",templateId).single();return data?.status;}).toBe("inactive");
    await page.goto(`/salesman/company-templates/documents/${id}`);await expect(page.frameLocator("iframe").locator("#client")).toHaveValue("Pinned document client");await page.frameLocator("iframe").locator("#client").fill("Edited after disabled");await expectDocumentContains(page,id,"Edited after disabled");expect((await readPersonalDocument(id)).template_version_id).toBe(v1);
    await page.reload();await expect(page.frameLocator("iframe").locator("#client")).toHaveValue("Edited after disabled");
  }finally{await admin.from("company_template_documents").delete().in("id",ids);await deleteTemplate(admin,templateId);await manager.close();}
});

test("发布弹窗拒绝无法恢复填写数据的模板",async({page})=>{
  await loginAs(page,"administrator");await page.goto("/admin/company-templates");const slug=`invalid-document-${randomUUID()}`;
  await page.getByRole("button",{name:"新建模板"}).click();const dialog=page.getByRole("dialog");
  const html=withDocumentProtocol('<html><head></head><body><input id="customer" value="initial"><script>window.PT5Template={version:1,exportState:()=>({value:document.getElementById("customer").value}),importState:s=>{document.getElementById("customer").value="wrong";},subscribe:()=>()=>{}};</script></body></html>');
  // 让最后的接口也明确恢复错误，避免示例包装器覆盖测试故障。
  const broken=html.replace("window.PT5Template={version:1,exportState:function()", "window.UnusedTemplate={version:1,exportState:function()");
  await fillPublishDialog(dialog,{html:broken,name:"Invalid document protocol",slug});await dialog.getByRole("button",{name:"上传并启用"}).click();await expect(dialog.getByRole("alert")).toContainText("恢复检查");const {count}=await requireLocalAdminClient().from("company_templates").select("id",{count:"exact",head:true}).eq("slug",slug);expect(count).toBe(0);
});

test("超时与零行写入不能显示已保存，伪造消息不能修改数据",async({page})=>{
  test.setTimeout(120000);const admin=requireLocalAdminClient();const ids:string[]=[];await loginAs(page,"salesman");
  try{
    const id=await openNewDocument(page,ids);const original=await readPersonalDocument(id);
    const token=new URL((await page.locator("iframe").getAttribute("src"))!,page.url()).searchParams.get("loadToken");
    await page.evaluate(token=>window.postMessage({type:"pt5.document.state",token,state:{forged:true}},"*"),token);
    expect((await readPersonalDocument(id)).revision).toBe(original.revision);
    await page.route("**/api/company-template-documents",async route=>{await new Promise(resolve=>setTimeout(resolve,31000));await route.abort("timedout").catch(()=>{});});
    await page.frameLocator("iframe").locator("#client").fill("Timeout pending content");await expect(page.getByRole("status").filter({hasText:"正在保存"})).toBeVisible();await expect(page.getByRole("status").filter({hasText:/^已保存$/})).toHaveCount(0);await expect(page.getByRole("status").filter({hasText:"保存失败"})).toBeVisible({timeout:40000});
    expect((await readPersonalDocument(id)).revision).toBe(original.revision);await page.unroute("**/api/company-template-documents");
    await page.getByRole("button",{name:"保存",exact:true}).click();await expectDocumentContains(page,id,"Timeout pending content");
    await admin.from("company_template_documents").delete().eq("id",id);
    await page.frameLocator("iframe").locator("#client").fill("Deleted record cannot be saved");await expect(page.getByRole("status").filter({hasText:"保存失败"})).toBeVisible();await expect(page.getByRole("alert").filter({hasText:"没有找到"})).toBeVisible();const {count}=await admin.from("company_template_documents").select("id",{count:"exact",head:true}).eq("id",id);expect(count).toBe(0);
  }finally{await admin.from("company_template_documents").delete().in("id",ids);}
});
