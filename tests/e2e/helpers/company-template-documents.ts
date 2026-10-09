import {expect,type Page} from "@playwright/test";
import {requireLocalAdminClient} from "./company-template-actions";
import {documentUser} from "./document-library";
import type {RegressionRole} from "./accounts";
/** 只通过弹窗选择位置并确认，接口读取仅用于找出真实授权目录，不直接创建或保存。 */
export async function confirmDocumentFolder(page:Page, folderId?:string) {
  const response=await page.request.get("/api/company-template-documents/destinations");expect(response.ok()).toBe(true);
  const data=await response.json();
  const segment=new URL(page.url()).pathname.split("/")[1];const role=(segment==="admin"?"administrator":segment) as RegressionRole;
  const userId=await documentUser(role);
  const folder=folderId?data.folders.find((item:{id:string})=>item.id===folderId):data.folders.find((item:{archive_id:string;system_key:string})=>item.system_key==="personal"&&data.archives.find((a:{id:string;user_id:string})=>a.id===item.archive_id)?.user_id===userId);
  expect(folder).toBeTruthy();const archive=data.archives.find((item:{id:string})=>item.id===folder.archive_id);
  const dialog=page.getByRole("dialog");await expect(dialog.getByRole("status")).toHaveCount(0);
  await dialog.getByRole("combobox",{name:"人员或客户",exact:true}).click();await page.getByRole("option",{name:archive.name,exact:true}).click();
  const names:string[]=[];let current=folder;
  while(current){names.unshift(current.system_key?(current.zone==="personal"?"本人资料":current.zone==="shared"?"共享资料":"内部资料"):current.name);current=data.folders.find((item:{id:string})=>item.id===current.parent_id);}
  await dialog.getByRole("combobox",{name:"目标文件夹",exact:true}).click();await page.getByRole("option",{name:names.join(" / "),exact:true}).click();
  if(folder.zone==="shared")await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button",{name:"确认",exact:true}).click();
}
export const DOCUMENT_TEMPLATE_ID="a3200000-0000-4000-8000-000000000001";
/** 在编号出现时立即记录，之后任何断言失败都能准确清理这次新建的文档。 */
export async function openNewDocument(page:Page,ids:string[]){
  await page.goto("/salesman/company-templates");await page.getByRole("button",{name:"新建文档",exact:true}).first().click();
  await confirmDocumentFolder(page);
  await expect(page).toHaveURL(/\/documents\/templates\/[a-f0-9-]+$/);const id=page.url().split("/").pop()!;ids.push(id);
  await expectDocumentSaved(page);return id;
}
export async function readPersonalDocument(id:string){const {data,error}=await requireLocalAdminClient().from("company_template_documents").select("*").eq("id",id).single();if(error)throw error;return data;}
export async function expectDocumentSaved(page:Page){await expect(page.getByRole("status").filter({hasText:/^已保存$/})).toBeVisible({timeout:30000});}
export async function expectDocumentContains(page:Page,id:string,value:string){await expect.poll(async()=>JSON.stringify((await readPersonalDocument(id)).state),{timeout:15000}).toContain(value);await expectDocumentSaved(page);}
