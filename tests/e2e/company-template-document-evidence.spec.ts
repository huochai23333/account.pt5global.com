import {expect,test} from "@playwright/test";
import {loginAs} from "./helpers/auth";
import {requireLocalAdminClient} from "./helpers/company-template-actions";
import {openNewDocument,readPersonalDocument,expectDocumentContains} from "./helpers/company-template-documents";

test("独立业务断言能识别错误记录，恢复后重新保存通过",async({page})=>{
  const admin=requireLocalAdminClient();const ids:string[]=[];await loginAs(page,"salesman");
  try{
    const id=await openNewDocument(page,ids);await page.frameLocator("iframe").locator("#client").fill("Evidence correct client");await expectDocumentContains(page,id,"Evidence correct client");const correct=await readPersonalDocument(id);
    // 仅在本地修改这次创建的测试记录；先证明“查库对比”遇到错误业务结果确实失败。
    const broken=structuredClone(correct.state);broken.toolbar[0].value="Evidence wrong client";
    const {error}=await admin.from("company_template_documents").update({state:broken}).eq("id",id);if(error)throw error;
    let detected=false;
    try{expect((await readPersonalDocument(id)).state).toEqual(correct.state);}catch{detected=true;}
    expect(detected,"authoritative comparison must reject the wrong persisted result").toBe(true);
    await page.reload();await expect(page.frameLocator("iframe").locator("#client")).toHaveValue("Evidence wrong client");
    // 从真实页面重新填写并保存，恢复正确结果，最后再刷新核对。
    await page.frameLocator("iframe").locator("#client").fill("Evidence correct client");await page.getByRole("button",{name:"保存",exact:true}).click();await expectDocumentContains(page,id,"Evidence correct client");
    const restored=await readPersonalDocument(id);expect(restored.revision).toBeGreaterThan(correct.revision);expect(restored.state).toEqual(correct.state);await page.reload();await expect(page.frameLocator("iframe").locator("#client")).toHaveValue("Evidence correct client");
  }finally{await admin.from("company_template_documents").delete().in("id",ids);}
});
