import {test,expect} from "@playwright/test";
import {execFileSync} from "node:child_process";
import {readFileSync,writeFileSync} from "node:fs";
import {documentLogin,documentUser,documentAdmin,uploadDocumentFiles,authoritativeFiles,cleanupDocuments} from "./helpers/document-library";
import {createFolder,enterFolder} from "./helpers/document-explorer";
import {confirmDocumentFolder,expectDocumentSaved,readPersonalDocument,expectDocumentContains} from "./helpers/company-template-documents";
/** 在真实旧目录准备内容，再执行本地迁移；只清理本次前缀，不重置用户的 Docker 数据。 */
test("人员目录合并保留编号、字节、填写内容和同名目录，本人获得管理权限",async({page})=>{
 test.setTimeout(180000);const prefix=`personal-migration-${Date.now()}-`;const db=documentAdmin();const ids:string[]=[];
 await documentLogin(page,"administrator");const manager=await documentUser("manager");const archive=(await db.from("document_archives").select("id").eq("user_id",manager).single()).data!;
 const roots=(await db.from("document_folders").select("*").eq("archive_id",archive.id).not("system_key","is",null)).data!;const personal=roots.find(folder=>folder.system_key==="personal")!;const internal=roots.find(folder=>folder.system_key==="staff_internal");
 // 合并迁移的前置夹具只能在仍有旧根目录的本地数据库执行。
 test.skip(!internal,"已合并的数据库不再具有迁移前的默认目录；迁移证据来自首次实际执行。");
 try{
  await page.goto(`/admin/documents?scope=folder&user=${manager}&folder=${personal.id}`);await createFolder(page,`${prefix}same`);
  await page.goto(`/admin/documents?scope=folder&user=${manager}&folder=${internal!.id}`);const child=await createFolder(page,`${prefix}same`);await uploadDocumentFiles(page,[`${prefix}root.txt`]);await enterFolder(page,child.id);await uploadDocumentFiles(page,[`${prefix}nested.txt`]);const beforeFiles=await authoritativeFiles([`${prefix}root.txt`,`${prefix}nested.txt`]);
  await page.goto(`/admin/company-templates?folder=${internal!.id}`);await page.getByRole("button",{name:"新建文档",exact:true}).first().click();await confirmDocumentFolder(page,internal!.id);await expectDocumentSaved(page);const id=page.url().split("/").pop()!;ids.push(id);await page.frameLocator("iframe").locator("#client").fill(prefix);await expectDocumentContains(page,id,prefix);const before=await readPersonalDocument(id);
  let detectsWrongFolder=false;try{expect(before.folder_id).toBe(personal.id);}catch{detectsWrongFolder=true;}expect(detectsWrongFolder).toBe(true);
  execFileSync("docker",["exec","-i","supabase_db_pt5-dropshipping","psql","-U","postgres","-d","postgres","-v","ON_ERROR_STOP=1"],{input:readFileSync("../PT5-dropshipping-supabase/supabase/migrations/20261012090000_personal_document_folders.sql"),stdio:["pipe","pipe","pipe"]});
  const after=await readPersonalDocument(id);expect(after.folder_id).toBe(personal.id);expect(after.revision).toBe(before.revision+1);expect(after.state_sha256).toBe(before.state_sha256);expect(after.template_version_id).toBe(before.template_version_id);
  const folders=(await db.from("document_folders").select("*").eq("archive_id",archive.id)).data!;expect(folders.filter(folder=>folder.system_key)).toHaveLength(1);expect(folders.find(folder=>folder.id===child.id)).toMatchObject({parent_id:personal.id,zone:"personal",name:`${prefix}same (2)`});
  const afterFiles=await authoritativeFiles(beforeFiles.map(file=>file.name));for(const original of beforeFiles){const file=afterFiles.find(item=>item.id===original.id)!;expect(file.version).toBe(original.version+1);expect(file.storage_path).toBe(original.storage_path);expect(file.sha256).toBe(original.sha256);const bytes=await db.storage.from("document-library").download(file.storage_path);expect(bytes.error).toBeNull();expect(Buffer.from(await bytes.data!.arrayBuffer())).toEqual(Buffer.from("真实资料\n"));}
  await documentLogin(page,"manager");await page.goto(`/manager/documents/templates/${id}`);await expect(page.frameLocator("iframe").locator("#client")).toHaveValue(prefix);await page.frameLocator("iframe").locator("#client").fill(prefix+"owner");await expectDocumentContains(page,id,prefix+"owner");await page.reload();await expect(page.frameLocator("iframe").locator("#client")).toHaveValue(prefix+"owner");
  writeFileSync("output/personal-folder-migration-evidence.json",JSON.stringify({documentId:id,folderId:personal.id,revision:after.revision,stateHashPreserved:true,templateVersionPreserved:true,fileIds:afterFiles.map(file=>file.id),ownerEdited:true,duplicateFolderId:child.id,redGreenDetected:detectsWrongFolder},null,2));
 }finally{if(ids.length)await db.from("company_template_documents").delete().in("id",ids);await cleanupDocuments(prefix);}
});
