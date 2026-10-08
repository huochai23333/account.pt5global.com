import {expect,test,type Page} from "@playwright/test";
import {writeFileSync} from "node:fs";
import {loginAs} from "./helpers/auth";
import {requireLocalAdminClient,expectNoPageOverflow,fillQuotationRow,clickStableTemplateButton} from "./helpers/company-template-actions";

async function openNew(page:Page,ids:string[]){await page.goto("/salesman/company-templates");await page.getByRole("button",{name:"新建文档",exact:true}).first().click();await expect(page).toHaveURL(/\/documents\/[a-f0-9-]+$/);const id=page.url().split("/").pop()!;ids.push(id);await expect(page.getByRole("status").filter({hasText:/^已保存$/})).toBeVisible({timeout:30000});return id;}
async function readDocument(id:string){const {data,error}=await requireLocalAdminClient().from("company_template_documents").select("*").eq("id",id).single();if(error)throw error;return data;}
async function saved(page:Page,id:string,value:string){await expect.poll(async()=>JSON.stringify((await readDocument(id)).state),{timeout:15000}).toContain(value);await expect(page.getByRole("status").filter({hasText:/^已保存$/})).toBeVisible();}
// 操作从真实页面发起，独立管理客户端只读取最终凭证和清理精确的测试编号。
test("个人报价文档完整保存、恢复、管理和隔离",async({page,browser})=>{
  test.setTimeout(180000);const admin=requireLocalAdminClient();const ids:string[]=[];const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  const frameworkWarnings:string[]=[];page.on("console",message=>{if(["warning","error"].includes(message.type())&&/hydration|hydrated|React.*error|Server Component|Invalid hook/i.test(message.text()))frameworkWarnings.push(message.text());});
  await page.emulateMedia({reducedMotion:"reduce"});
  await loginAs(page,"salesman");
  try{
    const id=await openNew(page,ids);const frame=page.frameLocator("iframe");
    await frame.locator("#client").fill("Document E2E Client");await frame.locator("#qDate").fill("2026-09-15");await frame.locator("#quoter").fill("Document E2E Sales");await frame.locator("#lhMail").fill("sales@example.com");
    await fillQuotationRow(frame,0);await clickStableTemplateButton(page,frame,"+ Add product");await expect(frame.locator("tr.prow")).toHaveCount(2);await fillQuotationRow(frame,1);
    await clickStableTemplateButton(page,frame,"+ Add destination");await frame.locator(".f-dest").nth(1).fill("DE");await frame.locator(".f-qno").first().fill("MANUAL-NUMBER");
    await frame.locator("#incPay").check();await frame.locator("#pmtRef").fill("MANUAL-REF");await clickStableTemplateButton(page,frame,"+ Add payment route");
    await frame.locator("#customRoutes .ttl").fill("Personal bank");await frame.locator("#customRoutes .row input").nth(0).fill("Account label");await frame.locator("#customRoutes .row input").nth(1).fill("Account value");
    const image=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z4l8AAAAASUVORK5CYII=","base64");
    await frame.locator(".f-imgurl").first().fill("");await frame.locator(".photo").first().dblclick();
    await frame.locator("#photoFileInput").setInputFiles({name:"document.png",mimeType:"image/png",buffer:image});
    await expect(frame.locator(".f-imgdata").first()).toHaveValue(/^data:image\/png;base64,/);
    // 浏览器中派发包含文件的粘贴事件，验证实际模板的粘贴处理与异步文件读取；不调用模板的图片写入函数。
    await frame.locator(".photo").nth(1).evaluate((element,base64)=>{const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));const transfer=new DataTransfer();transfer.items.add(new File([bytes],"pasted.png",{type:"image/png"}));element.dispatchEvent(new ClipboardEvent("paste",{bubbles:true,clipboardData:transfer}));},image.toString("base64"));
    await expect(frame.locator(".f-imgdata").nth(1)).toHaveValue(/^data:image\/png;base64,/);
    await page.getByRole("button",{name:"保存",exact:true}).click();
    await saved(page,id,"Account value");const before=await readDocument(id);expect(before.revision).toBeGreaterThan(1);expect(before.template_version_id).toBe("a3200000-0000-4000-8000-000000000003");expect(before.state.pages).toHaveLength(2);expect(before.state.pages[0].rows).toHaveLength(2);
    await page.reload();await expect(frame.locator("#client")).toHaveValue("Document E2E Client");await expect(frame.locator("#qDate")).toHaveValue("2026-09-15");await expect(frame.locator(".f-qno").first()).toHaveValue("MANUAL-NUMBER");await expect(frame.locator("#pmtRef")).toHaveValue("MANUAL-REF");await expect(frame.locator("#customRoutes .ttl")).toHaveValue("Personal bank");await expect(frame.locator("tr.prow")).toHaveCount(3);await expect(frame.locator(".f-imgdata").first()).toHaveValue(/^data:image\/png;base64,/);await expect(frame.locator(".f-imgdata").nth(1)).toHaveValue(/^data:image\/png;base64,/);
    await page.evaluate(()=>window.scrollTo({top:0,behavior:"instant"}));await page.screenshot({path:"output/company-template-documents-desktop.png"});
    await page.getByRole("button",{name:"重命名",exact:true}).click();let dialog=page.getByRole("dialog");await dialog.getByLabel("文档名称").fill("Document E2E renamed");await dialog.getByRole("button",{name:"确认",exact:true}).click();await expect(page.getByRole("heading",{name:"Document E2E renamed"})).toBeVisible();expect((await readDocument(id)).name).toBe("Document E2E renamed");
    await expect(page.getByRole("status").filter({hasText:/^已保存$/})).toBeVisible();await page.getByRole("button",{name:"另存一份",exact:true}).click();dialog=page.getByRole("dialog");await dialog.getByLabel("文档名称").fill("Document E2E copy");await dialog.getByRole("button",{name:"确认",exact:true}).click();await expect(page).not.toHaveURL(new RegExp(id+"$"));const copyId=page.url().split("/").pop()!;ids.push(copyId);await expect(frame.locator("#client")).toHaveValue("Document E2E Client");expect((await readDocument(copyId)).state).toEqual((await readDocument(id)).state);
    const other=await browser.newContext();const otherPage=await other.newPage();await loginAs(otherPage,"administrator");await otherPage.goto("/admin/company-templates?tab=documents");await expect(otherPage.getByRole("heading",{name:"Document E2E renamed"})).toHaveCount(0);expect((await otherPage.request.get(`/api/company-template-documents/${id}/content?loadToken=11111111-1111-4111-8111-111111111111`)).status()).toBe(404);await other.close();
    await page.getByRole("button",{name:"返回我的文档"}).click();await page.getByLabel("搜索文档名称").fill("Document E2E copy");await expect(page.getByRole("heading",{name:"Document E2E copy"})).toBeVisible();await page.locator("article").filter({has:page.getByRole("heading",{name:"Document E2E copy",exact:true})}).getByRole("button",{name:"删除",exact:true}).click();await page.getByRole("dialog").getByRole("button",{name:"确认",exact:true}).click();await expect.poll(async()=>{const {count}=await admin.from("company_template_documents").select("id",{count:"exact",head:true}).eq("id",copyId);return count;}).toBe(0);
    await page.reload();await expect(page.getByRole("heading",{name:"Document E2E copy",exact:true})).toHaveCount(0);
    for(const width of [320,360,390]){await page.setViewportSize({width,height:844});await expectNoPageOverflow(page);}await page.screenshot({path:"output/company-template-documents-mobile.png"});
    expect(errors).toEqual([]);expect(frameworkWarnings).toEqual([]);await expect(page.locator("nextjs-portal [data-nextjs-dialog]")).toHaveCount(0);
    // 交付凭证只保留编号、修订与哈希，不导出填写内容或登录资料。
    writeFileSync("output/company-template-document-business-evidence.json",JSON.stringify({document:{id,revision:before.revision,state_sha256:before.state_sha256,template_version_id:before.template_version_id},copy:{id:copyId,deleted_count:0,reload_absent:true},rename:{id,name:"Document E2E renamed"},viewports:[320,360,390],pageErrors:errors,frameworkWarnings},null,2));
  }finally{await admin.from("company_template_documents").delete().in("id",ids);}
});
