import {test,expect} from "@playwright/test";
import {documentLogin,documentAdmin,readLibrary} from "./helpers/document-library";
import {createFolder,enterFolder,clean} from "./helpers/document-explorer";
/** 使用产品原有 90 秒上限，不缩短等待，也不以假页面代替真实写入入口。 */
test.use({video:"off"});
test("新建超过90秒等待上限时保持未确认，独立数据库没有新增目录",async({page})=>{
 test.setTimeout(130000);const prefix=`windows-timeout-${Date.now()}-`;let operationId="";
 try{await documentLogin(page,"administrator");await page.goto("/admin/documents?scope=folder");const parent=await createFolder(page,prefix+"sandbox");await enterFolder(page,parent.id);
  await page.route("**/api/document-library",route=>{operationId=route.request().postDataJSON().operationId;});
  await page.locator("[data-explorer-create]").click();await expect(page.locator('[data-document-result="failed"]')).toContainText("尚未确认",{timeout:100000});await expect(page.locator('[data-document-result="succeeded"]')).toHaveCount(0);
  const folders=await documentAdmin().from("document_folders").select("id").eq("parent_id",parent.id);expect(folders.error).toBeNull();expect(folders.data).toEqual([]);const operations=await documentAdmin().from("document_operations").select("id").eq("id",operationId);expect(operations.error).toBeNull();expect(operations.data).toEqual([]);
  await page.unrouteAll({behavior:"ignoreErrors"});await page.reload();expect((await readLibrary(page)).total).toBe(0);await expect(page.locator("[data-inline-name]")).toHaveCount(0);
 }finally{await page.unrouteAll({behavior:"ignoreErrors"}).catch(()=>{});await clean(prefix);}
});
