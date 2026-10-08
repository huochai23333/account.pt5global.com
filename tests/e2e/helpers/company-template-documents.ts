import {expect,type Page} from "@playwright/test";
import {requireLocalAdminClient} from "./company-template-actions";
export const DOCUMENT_TEMPLATE_ID="a3200000-0000-4000-8000-000000000001";
/** 在编号出现时立即记录，之后任何断言失败都能准确清理这次新建的文档。 */
export async function openNewDocument(page:Page,ids:string[]){
  await page.goto("/salesman/company-templates");await page.getByRole("button",{name:"新建文档",exact:true}).first().click();
  await expect(page).toHaveURL(/\/documents\/[a-f0-9-]+$/);const id=page.url().split("/").pop()!;ids.push(id);
  await expectDocumentSaved(page);return id;
}
export async function readPersonalDocument(id:string){const {data,error}=await requireLocalAdminClient().from("company_template_documents").select("*").eq("id",id).single();if(error)throw error;return data;}
export async function expectDocumentSaved(page:Page){await expect(page.getByRole("status").filter({hasText:/^已保存$/})).toBeVisible({timeout:30000});}
export async function expectDocumentContains(page:Page,id:string,value:string){await expect.poll(async()=>JSON.stringify((await readPersonalDocument(id)).state),{timeout:15000}).toContain(value);await expectDocumentSaved(page);}
