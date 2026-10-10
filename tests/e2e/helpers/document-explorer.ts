import {appendFileSync} from "node:fs";
import {expect,type Page,type Locator} from "@playwright/test";
import {documentAdmin,documentReader,cleanupDocuments} from "./document-library";
/** 验收操作全部来自真实页面；后台客户端仅用于独立核对及按测试前缀清理。 */
export async function createFolder(page:Page,name:string){
 await expect(page.getByRole("button",{name:"新建子文件夹",exact:true})).toBeEnabled();
 const parent=(await(await page.request.get(`/api/document-library${new URL(page.url()).search}`)).json()).folderId;expect(parent).toMatch(/^[a-f0-9-]{36}$/);
 await page.getByRole("button",{name:"新建子文件夹",exact:true}).click();const dialog=page.getByRole("dialog");
 await dialog.getByRole("textbox").fill(name);await dialog.getByRole("button",{name:"确认",exact:true}).click();await expect(dialog).toHaveCount(0);
 const result=await documentAdmin().from("document_folders").select("*").eq("name",name).eq("parent_id",parent).single();expect(result.error).toBeNull();return result.data!;
}
/** 查询后的条目会先显示，再解除操作锁；必须等可交互状态，不以旧 DOM 存在代替就绪。 */
export async function chooseRow(page:Page,id:string){const row=page.locator(`[data-explorer-item="${id}"]`);await expect(row.getByRole("checkbox")).toBeEnabled();await row.click();}
/** 老流程也走新版的可见菜单，不能为了保留断言在产品中恢复已移除的按钮。 */
export async function openItemMenu(page:Page,row:Locator,action:string){await row.click({button:"right"});await page.getByRole("menuitem",{name:action,exact:true}).click();}
export async function enterFolder(page:Page,id:string){const row=page.locator(`[data-explorer-item="${id}"]`);await expect(row.getByRole("checkbox")).toBeEnabled();await row.dblclick();await expect(page).toHaveURL(new RegExp(`folder=${id}`));await expect(page.locator('[data-document-content]')).toHaveAttribute("aria-busy","false");}
export async function confirmDeletion(page:Page){const dialog=page.getByRole("dialog");await dialog.getByRole("checkbox",{name:/我确认永久删除/}).check();await dialog.getByRole("button",{name:"确认",exact:true}).click();await expect(dialog).toHaveCount(0,{timeout:60000});}
export async function clean(prefix:string){
 const reader=await documentReader("administrator");const batches=await documentAdmin().from("document_batches").select("id,manifest");
 for(const batch of batches.data??[])if(batch.manifest.some((e:{record:{name:string}})=>e.record.name.startsWith(prefix))){appendFileSync("output/document-explorer-batches.jsonl",JSON.stringify({id:batch.id,entries:batch.manifest.map((e:{kind:string;id:string;version:number})=>({kind:e.kind,id:e.id,version:e.version}))})+"\n");await reader.rpc("document_batch_release",{p_id:batch.id});}
 const docs=await documentAdmin().from("company_template_documents").select("id").like("name",`${prefix}%`);if(docs.data?.length)await documentAdmin().from("company_template_documents").delete().in("id",docs.data.map(d=>d.id));
 await cleanupDocuments(prefix);
 for(const batch of batches.data??[])if(batch.manifest.some((e:{record:{name:string}})=>e.record.name.startsWith(prefix)))await documentAdmin().from("document_batches").delete().eq("id",batch.id);
}
