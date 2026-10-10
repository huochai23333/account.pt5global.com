import {test,expect} from "@playwright/test";
import {execFileSync} from "node:child_process";
import {randomUUID} from "node:crypto";
import {documentLogin,documentAdmin,documentUser,documentReader,uploadDocumentFiles,authoritativeFiles,confirmFileObjects} from "./helpers/document-library";
import {createFolder,chooseRow,enterFolder,clean} from "./helpers/document-explorer";

test.use({video:"off"});
const errors=new WeakMap<object,string[]>();
test.beforeEach(async({page})=>{const list:string[]=[];errors.set(page,list);page.on("pageerror",e=>list.push(e.message));});
test.afterEach(async({page})=>{expect(errors.get(page)??[]).toEqual([]);});
/** 故障只注入本次测试编号对应的本地记录；结束时撤销触发器并按随机前缀清理。 */
function sql(statement:string){execFileSync("docker",["exec","-i","supabase_db_pt5-dropshipping","psql","-U","postgres","-d","postgres","-v","ON_ERROR_STOP=1"],{input:statement,stdio:["pipe","pipe","pipe"]});}

test("资源管理器：真实文件拖入、条目拖放、F2及Shift连选",async({page})=>{
 test.setTimeout(120000);const prefix=`explorer-drag-${Date.now()}-`;await documentLogin(page,"administrator");
 try{
  await page.goto("/admin/documents?scope=folder");const folder=await createFolder(page,`${prefix}dest`);
  const transfer=await page.evaluateHandle(name=>{const data=new DataTransfer();data.items.add(new File(["真实拖入内容"],name,{type:"text/plain"}));return data;},`${prefix}drag.txt`);
  const zone=page.locator('[data-document-content]');await zone.dispatchEvent("dragover",{dataTransfer:transfer});await expect(page.getByText(/^松开鼠标，将文件上传到当前文件夹。/)).toBeVisible();await zone.dispatchEvent("drop",{dataTransfer:transfer});await expect(page.locator('[data-document-result="succeeded"]')).toBeVisible();await transfer.dispose();
  const file=(await authoritativeFiles([`${prefix}drag.txt`]))[0];await confirmFileObjects([file]);
  const row=page.locator(`[data-explorer-item="${file.id}"]`);await row.click();await row.press("F2");await page.getByRole("dialog").getByRole("textbox").fill(`${prefix}renamed.txt`);await page.getByRole("dialog").getByRole("button",{name:"确认",exact:true}).click();await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.locator(`[data-explorer-item="${file.id}"]`).dragTo(page.locator(`[data-explorer-item="${folder.id}"]`));await page.getByRole("dialog").getByRole("button",{name:"确认",exact:true}).click();await expect(page.getByRole("dialog")).toHaveCount(0);expect((await authoritativeFiles([`${prefix}renamed.txt`]))[0].folder_id).toBe(folder.id);
  await enterFolder(page,folder.id);await uploadDocumentFiles(page,[`${prefix}b.txt`,`${prefix}c.txt`]);const rows=page.locator('[data-document-file]');await rows.first().click();await rows.last().click({modifiers:["Shift"]});await expect(page.getByText("已选 3 项",{exact:true})).toBeVisible();await page.reload();await expect(page.getByText("已选 0 项",{exact:true})).toBeVisible();await expect(rows).toHaveCount(3);
 }finally{await clean(prefix);}
});

test("资源管理器：响应丢失后刷新续办原批次，重复提交不重复移动",async({page})=>{
 test.setTimeout(180000);const prefix=`explorer-resume-${Date.now()}-`;await documentLogin(page,"administrator");
 try{
  await page.goto("/admin/documents?scope=folder");const folder=await createFolder(page,`${prefix}dest`);const names=Array.from({length:11},(_,i)=>`${prefix}${String(i).padStart(2,"0")}.txt`);await uploadDocumentFiles(page,names);const files=await authoritativeFiles(names);expect(files).toHaveLength(11);
  for(const file of files)await page.locator(`[data-explorer-item="${file.id}"]`).getByRole("checkbox").check();await page.getByRole("button",{name:"剪切",exact:true}).click();await enterFolder(page,folder.id);await page.getByRole("button",{name:"粘贴",exact:true}).click();
  let batchId="";let saved:unknown;await page.route("**/api/document-library/batch",async route=>{batchId=route.request().postDataJSON().id;saved=route.request().postDataJSON();await route.fetch();await route.abort("connectionreset");});
  await page.getByRole("dialog").getByRole("button",{name:"确认",exact:true}).click();await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();await page.unroute("**/api/document-library/batch");
  const interrupted=await documentAdmin().from("document_batches").select("*").eq("id",batchId).single();expect(interrupted.data!.status).toBe("pending");expect(interrupted.data!.results.filter((r:{status:string})=>r.status==="succeeded")).toHaveLength(10);
  await page.reload();await page.locator(`[data-document-batch="${batchId}"]`).getByRole("button",{name:"继续核对",exact:true}).click();await expect(page.locator(`[data-document-batch="${batchId}"]`)).toHaveAttribute("data-batch-status","succeeded",{timeout:60000});
  const repeated=await page.request.post("/api/document-library/batch",{data:saved});expect(repeated.ok()).toBe(true);expect((await repeated.json()).id).toBe(batchId);
  const actual=await authoritativeFiles(names);expect(actual.every(f=>f.folder_id===folder.id&&f.version===files.find(old=>old.id===f.id)!.version+1)).toBe(true);await confirmFileObjects(actual);await page.reload();await expect(page.locator('[data-document-file]')).toHaveCount(11);
 }finally{await clean(prefix);}
});

test("资源管理器：删除零行保留未完成目录并报告部分失败，原清单可续办",async({page})=>{
 test.setTimeout(180000);const prefix=`explorer-partial-${Date.now()}-`;await documentLogin(page,"administrator");
 try{
  await page.goto("/admin/documents?scope=folder");const folder=await createFolder(page,`${prefix}folder`);await enterFolder(page,folder.id);await uploadDocumentFiles(page,[`${prefix}a.txt`,`${prefix}b.txt`]);const files=await authoritativeFiles([`${prefix}a.txt`,`${prefix}b.txt`]);
  sql(`create function public.explorer_test_zero_delete() returns trigger language plpgsql as $$begin if old.id='${files[1].id}'::uuid then return null;end if;return old;end$$;create trigger explorer_test_zero_delete before delete on public.document_files for each row execute function public.explorer_test_zero_delete();`);
  await page.getByRole("button",{name:"上一级",exact:true}).click();await chooseRow(page,folder.id);await page.getByRole("button",{name:"删除",exact:true}).click();const dialog=page.getByRole("dialog");await dialog.getByRole("checkbox").check();await dialog.getByRole("button",{name:"确认",exact:true}).click();await expect(dialog.getByRole("alert")).toBeVisible();
  const batches=await documentAdmin().from("document_batches").select("*");const batch=batches.data!.find(b=>b.manifest.some((e:{id:string})=>e.id===folder.id))!;expect(batch.status).toBe("partial_failed");expect((await documentAdmin().from("document_folders").select("id").eq("id",folder.id)).data).toHaveLength(1);expect((await documentAdmin().from("document_files").select("id").eq("id",files[0].id)).data).toHaveLength(0);expect((await documentAdmin().from("document_files").select("id").eq("id",files[1].id)).data).toHaveLength(1);
  sql("drop trigger explorer_test_zero_delete on public.document_files;drop function public.explorer_test_zero_delete();");await dialog.getByRole("button",{name:"取消",exact:true}).click();await page.reload();await page.locator(`[data-document-batch="${batch.id}"]`).getByRole("button",{name:"继续核对",exact:true}).click();await expect(page.locator(`[data-document-batch="${batch.id}"]`)).toHaveAttribute("data-batch-status","succeeded",{timeout:60000});
  expect((await documentAdmin().from("document_folders").select("id").eq("id",folder.id)).data).toHaveLength(0);for(const file of files)expect((await documentAdmin().storage.from("document-library").exists(file.storage_path)).data).toBe(false);await page.reload();await expect(page.locator(`[data-explorer-item="${folder.id}"]`)).toHaveCount(0);
 }finally{sql("drop trigger if exists explorer_test_zero_delete on public.document_files;drop function if exists public.explorer_test_zero_delete();");await clean(prefix);}
});

test("资源管理器：删除清单变化重新确认；跨客户共享确认及撤回权限",async({page,browser})=>{
 test.setTimeout(180000);const prefix=`explorer-share-${Date.now()}-`;await documentLogin(page,"administrator");const other=await page.context().newPage();const clientContext=await browser.newContext();const client=await clientContext.newPage();
 try{
  await page.goto("/admin/documents?scope=folder");const folder=await createFolder(page,`${prefix}folder`);await enterFolder(page,folder.id);await uploadDocumentFiles(page,[`${prefix}first.txt`]);await page.getByRole("button",{name:"上一级",exact:true}).click();await chooseRow(page,folder.id);await page.getByRole("button",{name:"删除",exact:true}).click();const dialog=page.getByRole("dialog");await expect(dialog.getByText(/1 个文件和/)).toBeVisible();
  await other.goto(`/admin/documents?scope=folder&folder=${folder.id}`);await uploadDocumentFiles(other,[`${prefix}later.txt`]);await dialog.getByRole("checkbox").check();await dialog.getByRole("button",{name:"确认",exact:true}).click();await expect(dialog.getByRole("alert")).toBeVisible();expect((await authoritativeFiles([`${prefix}first.txt`,`${prefix}later.txt`]))).toHaveLength(2);
  await dialog.getByRole("button",{name:"重新读取清单并确认",exact:true}).click();await expect(dialog.getByRole("checkbox")).not.toBeChecked();await expect(dialog.getByText(/2 个文件和/)).toBeVisible();await dialog.getByRole("button",{name:"取消",exact:true}).click();
  const clientId=await documentUser("client");const customer=(await documentAdmin().from("wholesale_customers").select("id").eq("registered_user_id",clientId).single()).data!;const archive=(await documentAdmin().from("document_archives").select("id").eq("customer_id",customer.id).single()).data!;const dest=(await documentAdmin().from("document_folders").select("*").eq("archive_id",archive.id).eq("system_key","shared").single()).data!;
  await chooseRow(page,folder.id);await page.getByRole("button",{name:"剪切",exact:true}).click();await page.goto(`/admin/documents?scope=folder&customer=${customer.id}&folder=${dest.id}`);await page.getByRole("button",{name:"粘贴",exact:true}).click();await expect(dialog.getByRole("button",{name:"确认",exact:true})).toBeDisabled();await dialog.getByRole("checkbox").check();await dialog.getByRole("button",{name:"确认",exact:true}).click();await expect(dialog).toHaveCount(0);
  const shared=(await authoritativeFiles([`${prefix}first.txt`]))[0];expect(shared.version).toBeGreaterThan(2);await documentLogin(client,"client");await client.goto(`/client/documents?scope=folder&folder=${folder.id}`);await expect(client.locator(`[data-document-file="${shared.id}"]`)).toBeVisible();await expect(client.getByRole("button",{name:"新建子文件夹",exact:true})).toHaveCount(0);expect((await client.request.get(`/api/document-library/files/${shared.id}/content`)).status()).toBe(200);
  const direct=await documentReader("client");expect((await direct.from("document_batches").select("id")).data).toEqual([]);expect((await direct.from("document_files").update({name:"forged"}).eq("id",shared.id)).error).not.toBeNull();
  const me=await documentUser("administrator");await chooseRow(page,folder.id);await page.getByRole("button",{name:"剪切",exact:true}).click();await page.goto(`/admin/documents?scope=folder&user=${me}`);await page.getByRole("button",{name:"粘贴",exact:true}).click();await dialog.getByRole("button",{name:"确认",exact:true}).click();await expect(dialog).toHaveCount(0);
  // 共享撤回后的局部刷新也必须移除旧树与名称，不能为了稳定布局继续展示失效授权的数据。
  await client.getByRole("button",{name:"刷新",exact:true}).click();await expect(client.locator('[data-document-content]')).toHaveCount(0);await expect(client.getByRole("tree",{name:"资料文件夹",exact:true})).toHaveCount(0);await expect(client.getByRole("alert").filter({hasText:"这份资料暂时无法查看"})).toBeVisible();
  await client.reload();await expect(client.locator(`[data-document-file="${shared.id}"]`)).toHaveCount(0);expect((await client.request.get(`/api/document-library/files/${shared.id}/content`)).status()).toBe(403);const forged=await client.request.post("/api/document-library/batch",{data:{id:randomUUID()}});expect(forged.status()).toBe(403);
 }finally{await other.close();await clientContext.close();await clean(prefix);}
});


test("资源管理器：缺失对象拒绝完整ZIP；同名文件夹不合并",async({page})=>{
 test.setTimeout(120000);const prefix=`explorer-integrity-${Date.now()}-`;await documentLogin(page,"administrator");
 try{
  await page.goto("/admin/documents?scope=folder");const source=await createFolder(page,`${prefix}same`);const dest=await createFolder(page,`${prefix}dest`);await enterFolder(page,dest.id);const conflict=await createFolder(page,source.name);await uploadDocumentFiles(page,[`${prefix}missing.txt`]);const file=(await authoritativeFiles([`${prefix}missing.txt`]))[0];expect((await documentAdmin().storage.from("document-library").remove([file.storage_path])).error).toBeNull();
  let downloads=0;page.on("download",()=>downloads++);await chooseRow(page,file.id);await page.getByRole("button",{name:"下载",exact:true}).click();await page.getByRole("dialog").getByRole("button",{name:"确认",exact:true}).click();await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();expect(downloads).toBe(0);await page.getByRole("dialog").getByRole("button",{name:"取消",exact:true}).click();
  await page.getByRole("button",{name:"上一级",exact:true}).click();await chooseRow(page,source.id);await page.getByRole("button",{name:"剪切",exact:true}).click();await enterFolder(page,dest.id);await page.getByRole("button",{name:"粘贴",exact:true}).click();await page.getByRole("dialog").getByRole("button",{name:"确认",exact:true}).click();await expect(page.getByText(/目标位置已有同名文件夹/)).toBeVisible();const both=await documentAdmin().from("document_folders").select("id,parent_id,version").in("id",[source.id,conflict.id]);expect(both.data).toHaveLength(2);expect(both.data!.find(f=>f.id===source.id)!.parent_id).toBe(source.parent_id);await page.reload();await expect(page.locator(`[data-explorer-item="${conflict.id}"]`)).toBeVisible();
 }finally{await clean(prefix);}
});


test("资源管理器：批次续办前撤回管理权限，原编号与内容地址均不能绕过",async({page})=>{
 test.setTimeout(180000);const prefix=`explorer-revoke-${Date.now()}-`;await documentLogin(page,"administrator");const actor=await documentUser("administrator");const manager=await documentUser("manager");
 try{
  await page.goto("/admin/documents?scope=folder");const names=Array.from({length:11},(_,i)=>`${prefix}${i}.txt`);await uploadDocumentFiles(page,names);const files=await authoritativeFiles(names);for(const file of files)await page.locator(`[data-explorer-item="${file.id}"]`).getByRole("checkbox").check();await page.getByRole("button",{name:"剪切",exact:true}).click();await page.goto(`/admin/documents?scope=folder&user=${manager}`);await page.getByRole("button",{name:"粘贴",exact:true}).click();let id="";
  await page.route("**/api/document-library/batch",async route=>{id=route.request().postDataJSON().id;await route.fetch();await route.abort("connectionreset");});await page.getByRole("dialog").getByRole("button",{name:"确认",exact:true}).click();await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();await page.unroute("**/api/document-library/batch");await page.getByRole("dialog").getByRole("button",{name:"取消",exact:true}).click();const before=(await documentAdmin().from("document_batches").select("results,status").eq("id",id).single()).data!;expect(before.results).toHaveLength(10);
  // 仅调整本地种子账号的岗位，保留登录；当前权限必须在每次续办时重新读取。
  sql(`update public.user_roles_data set role_id=(select id from public.user_roles where role='operator') where user_id='${actor}';`);
  await page.locator(`[data-document-batch="${id}"]`).getByRole("button",{name:"继续核对",exact:true}).click();await expect(page.getByRole("alert").filter({hasText:/确认账号权限/}).first()).toBeVisible();expect((await page.request.get(`/api/document-library/batch?id=${id}`)).status()).toBe(403);const after=(await documentAdmin().from("document_batches").select("results,status").eq("id",id).single()).data!;expect(after).toEqual(before);
  const moved=(await authoritativeFiles(names)).find(f=>f.version===3)!;expect((await page.request.get(`/api/document-library/files/${moved.id}/content`)).status()).toBe(403);
  sql(`update public.user_roles_data set role_id=(select id from public.user_roles where role='administrator') where user_id='${actor}';`);await page.reload();await page.locator(`[data-document-batch="${id}"]`).getByRole("button",{name:"继续核对",exact:true}).click();await expect(page.locator(`[data-document-batch="${id}"]`)).toHaveAttribute("data-batch-status","succeeded",{timeout:60000});await page.reload();await expect(page.locator('[data-document-file]')).toHaveCount(11);
 }finally{sql(`update public.user_roles_data set role_id=(select id from public.user_roles where role='administrator') where user_id='${actor}';`);await clean(prefix);}
});
