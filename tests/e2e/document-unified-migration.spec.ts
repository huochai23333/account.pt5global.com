import {test,expect} from "@playwright/test";
import {execFileSync} from "node:child_process";
import {readFileSync,writeFileSync} from "node:fs";
import {documentAdmin,documentLogin,uploadDocumentFiles,authoritativeFiles} from "./helpers/document-library";
import {createFolder,clean} from "./helpers/document-explorer";
import {confirmDocumentFolder,readPersonalDocument,expectDocumentContains,expectDocumentSaved} from "./helpers/company-template-documents";

/** 本用例只在尚未合并的本地 Docker 上执行一次；原始资料由真实页面创建，禁止修改云端夹具。 */
test("合并默认目录保留资料编号、子目录、对象字节和模板内容，旧窗口拒绝覆盖",async({page})=>{
 test.setTimeout(180000);const admin=documentAdmin();const prefix=`unified-${Date.now()}-`;const docIds:string[]=[];
 const archive=await admin.from("document_archives").select("id").eq("customer_id","c1000000-0000-4000-8000-000000000002").single();expect(archive.error).toBeNull();
 const roots=await admin.from("document_folders").select("*").eq("archive_id",archive.data!.id).is("parent_id",null);
 const internal=roots.data!.find(f=>f.system_key==="customer_internal");const shared=roots.data!.find(f=>f.system_key==="shared");
 test.skip(!internal||!shared,"当前本地库已经完成统一迁移；保留首次运行的独立凭证");
 try {
  await documentLogin(page,"administrator");const folderIds:string[]=[];const payload=Buffer.from("合并前后必须逐字节相同\n");
  for(const root of [internal!,shared!]){
   await page.goto(`/admin/documents?customer=c1000000-0000-4000-8000-000000000002&folder=${root.id}`);
   const child=await createFolder(page,prefix+"同名目录");folderIds.push(child.id);
   await uploadDocumentFiles(page,[prefix+"同名.txt"],payload);
   await page.goto(`/admin/documents?customer=c1000000-0000-4000-8000-000000000002&folder=${child.id}`);
   await uploadDocumentFiles(page,[prefix+root.system_key+".txt"],payload);
  }
  await page.goto("/admin/company-templates");await page.getByRole("button",{name:"新建文档",exact:true}).first().click();await confirmDocumentFolder(page,shared!.id);await expectDocumentSaved(page);
  const id=page.url().split("/").pop()!;docIds.push(id);await page.frameLocator("iframe").locator("#client").fill(prefix+"原填写内容");await expectDocumentContains(page,id,prefix+"原填写内容");
  const beforeDoc=await readPersonalDocument(id);const beforeFiles=await authoritativeFiles([prefix+"同名.txt",prefix+"customer_internal.txt",prefix+"shared.txt"]);expect(beforeFiles).toHaveLength(4);
  // 页面保持打开，再执行真正的数据库事务，模拟用户未关闭旧编辑窗口的发布场景。
  const sql=readFileSync("../PT5-dropshipping-supabase/supabase/migrations/20261012090101_unified_document_folder.sql","utf8");
  execFileSync("docker",["exec","-i","supabase_db_pt5-dropshipping","psql","-U","postgres","-d","postgres","-v","ON_ERROR_STOP=1"],{input:sql,encoding:"utf8"});
  const afterDoc=await readPersonalDocument(id);expect(afterDoc.id).toBe(id);expect(afterDoc.folder_id).toBe(internal!.id);expect(afterDoc.state).toEqual(beforeDoc.state);expect(afterDoc.state_sha256).toBe(beforeDoc.state_sha256);expect(afterDoc.template_version_id).toBe(beforeDoc.template_version_id);expect(afterDoc.revision).toBe(beforeDoc.revision+1);
  const afterFiles=await authoritativeFiles(beforeFiles.map(f=>f.name));expect(afterFiles).toHaveLength(4);
  for(const before of beforeFiles){const after=afterFiles.find(f=>f.id===before.id)!;expect(after.storage_path).toBe(before.storage_path);expect(after.version).toBe(before.version+1);expect(after.name).toBe(before.name);expect(after.folder_id).toBe([internal!.id,shared!.id].includes(before.folder_id)?internal!.id:before.folder_id);const object=await admin.storage.from("document-library").download(after.storage_path);expect(object.error).toBeNull();expect(Buffer.from(await object.data!.arrayBuffer())).toEqual(payload);}
  const children=await admin.from("document_folders").select("id,parent_id,name,zone").in("id",folderIds);expect(children.data).toHaveLength(2);expect(children.data!.every(f=>f.parent_id===internal!.id&&f.zone==="personal")).toBe(true);expect(new Set(children.data!.map(f=>f.name)).size).toBe(2);
  const all=await admin.from("document_folders").select("id,archive_id,parent_id,zone,system_key,name");expect(all.data!.every(f=>f.zone==="personal")).toBe(true);expect(all.data!.filter(f=>f.archive_id===archive.data!.id&&f.parent_id===null)).toEqual([expect.objectContaining({id:internal!.id,name:"资料文件夹",system_key:"personal"})]);expect(all.data!.some(f=>f.id===shared!.id)).toBe(false);
  await page.frameLocator("iframe").locator("#client").fill(prefix+"旧窗口错误修改");await expect(page.getByRole("status").filter({hasText:"已有新修改"})).toBeVisible();expect((await readPersonalDocument(id)).state).toEqual(beforeDoc.state);
  await page.reload();await expect(page.frameLocator("iframe").locator("#client")).toHaveValue(prefix+"原填写内容");await expectDocumentSaved(page);
  await page.getByRole("button",{name:"返回所在文件夹",exact:true}).click();await expect(page.locator(`[data-template-document="${id}"]`)).toBeVisible();await page.reload();await expect(page.locator(`[data-template-document="${id}"]`)).toBeVisible();
  writeFileSync("output/unified-migration-proof.json",JSON.stringify({rootId:internal!.id,retiredRootId:shared!.id,customFolderIds:folderIds,fileIds:afterFiles.map(f=>f.id),templateId:id,revision:afterDoc.revision,stateHash:afterDoc.state_sha256,templateVersionId:afterDoc.template_version_id,objectBytesVerified:4,oldWindowRejected:true,reloadVerified:true},null,2));
 }finally{if(docIds.length)await admin.from("company_template_documents").delete().in("id",docIds);await clean(prefix);}
});
