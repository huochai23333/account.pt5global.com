import {expect,test} from "@playwright/test";
import {loginAs} from "./helpers/auth";
import {requireLocalAdminClient,fillQuotationRow,clickStableTemplateButton} from "./helpers/company-template-actions";
import {openNewDocument,readPersonalDocument,expectDocumentContains,expectDocumentSaved} from "./helpers/company-template-documents";

test("删行、汇率计算和打印设置保存后恢复，必填检查继续生效",async({page})=>{
  test.setTimeout(120000);const admin=requireLocalAdminClient();const ids:string[]=[];
  await page.emulateMedia({reducedMotion:"reduce"});
  // 只记录浏览器是否调用打印；系统打印窗口和实际 PDF 文件不属于此自动化凭证。
  await page.addInitScript(()=>Object.defineProperty(window,"print",{value:()=>document.documentElement.dataset.printCalled="yes"}));
  await loginAs(page,"salesman");
  try{
    const id=await openNewDocument(page,ids);const frame=page.frameLocator("iframe");
    let printNotice="";page.once("dialog",async prompt=>{printNotice=prompt.message();await prompt.accept();});await clickStableTemplateButton(page,frame,"Print all");expect(printNotice).toContain("必填");await expect(frame.locator("html")).not.toHaveAttribute("data-print-called","yes");
    await frame.locator("#client").fill("Print restoration client");await frame.locator("#quoter").fill("Sales");await frame.locator("#lhMail").fill("sales@example.test");await fillQuotationRow(frame,0);
    await clickStableTemplateButton(page,frame,"+ Add product");await expect(frame.locator("tr.prow")).toHaveCount(2);await frame.locator("tr.prow").nth(1).locator(".rowtools button").last().click();await expect(frame.locator("tr.prow")).toHaveCount(1);
    await frame.locator("#rate").fill("7.25");await frame.locator("#play").selectOption("portrait");await frame.locator("#rowh").fill("30");await frame.locator("#incTerms").uncheck();
    await page.getByRole("button",{name:"保存",exact:true}).click();await expectDocumentContains(page,id,"Print restoration client");const total=await frame.locator(".o-tot").first().innerText();expect(total).not.toBe("—");const record=await readPersonalDocument(id);expect(record.state.pages[0].rows).toHaveLength(1);
    await page.reload();await expect(frame.locator("#rate")).toHaveValue("7.25");await expect(frame.locator("#play")).toHaveValue("portrait");await expect(frame.locator("#rowh")).toHaveValue("30");await expect(frame.locator("#incTerms")).not.toBeChecked();await expect(frame.locator(".o-tot").first()).toHaveText(total);await expect(frame.locator("#needBadge")).toContainText("all required fields filled");
    await clickStableTemplateButton(page,frame,"Print all");await expect(frame.locator("html")).toHaveAttribute("data-print-called","yes");await expect(frame.locator("#termsPage")).toHaveClass(/print-hide/);
  }finally{await admin.from("company_template_documents").delete().in("id",ids);}
});

test("超限图片保留页面内容，移除后能够保存",async({page})=>{
  test.setTimeout(120000);const admin=requireLocalAdminClient();const ids:string[]=[];await page.emulateMedia({reducedMotion:"reduce"});await loginAs(page,"salesman");
  try{
    const id=await openNewDocument(page,ids);const original=await readPersonalDocument(id);const frame=page.frameLocator("iframe");
    // 真实文件输入读取图片内容；填充超过上限的数据仍留在沙箱，不提交数据库。
    const image=Buffer.concat([Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z4l8AAAAASUVORK5CYII=","base64"),Buffer.alloc(8*1024*1024)]);
    await frame.locator(".photo").first().dblclick();await frame.locator("#photoFileInput").setInputFiles({name:"large.png",mimeType:"image/png",buffer:image});
    await expect(page.getByRole("alert").filter({hasText:"10 MiB"})).toBeVisible({timeout:30000});expect((await readPersonalDocument(id)).revision).toBe(original.revision);expect((await frame.locator(".f-imgdata").first().inputValue()).length).toBeGreaterThan(10*1024*1024);
    await clickStableTemplateButton(page,frame,"× image");await expect(frame.locator(".f-imgdata").first()).toHaveValue("");await frame.locator("#client").fill("Reduced document data");await page.getByRole("button",{name:"保存",exact:true}).click();await expectDocumentContains(page,id,"Reduced document data");await page.reload();await expect(frame.locator("#client")).toHaveValue("Reduced document data");await expect(frame.locator(".f-imgdata").first()).toHaveValue("");
  }finally{await admin.from("company_template_documents").delete().in("id",ids);}
});

test("保存串行执行并追上请求期间的新修改",async({page})=>{
  test.setTimeout(120000);const admin=requireLocalAdminClient();const ids:string[]=[];await loginAs(page,"salesman");
  try{
    const id=await openNewDocument(page,ids);let active=0;let maximum=0;
    await page.route("**/api/company-template-documents",async route=>{active++;maximum=Math.max(maximum,active);await new Promise(resolve=>setTimeout(resolve,1800));await route.continue();active--;});
    const frame=page.frameLocator("iframe");await frame.locator("#client").fill("First pending edit");await expect(page.getByRole("status").filter({hasText:"正在保存"})).toBeVisible();await frame.locator("#client").fill("Newest pending edit");await expectDocumentContains(page,id,"Newest pending edit");expect(maximum).toBe(1);await page.unroute("**/api/company-template-documents");await page.reload();await expect(frame.locator("#client")).toHaveValue("Newest pending edit");await expectDocumentSaved(page);
  }finally{await admin.from("company_template_documents").delete().in("id",ids);}
});
