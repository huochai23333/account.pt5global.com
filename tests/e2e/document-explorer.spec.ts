import {test,expect,type Page} from "@playwright/test";
import {unzipSync} from "fflate";
import {confirmDocumentFolder,expectDocumentSaved,expectDocumentContains} from "./helpers/company-template-documents";
import {documentLogin,documentAdmin,documentUser,uploadDocumentFiles,authoritativeFiles,confirmFileObjects,checkDocumentViewport} from "./helpers/document-library";

test.use({video:"off"});
const browserErrors=new WeakMap<Page,string[]>();
test.beforeEach(async({page})=>{const errors:string[]=[];browserErrors.set(page,errors);page.on("pageerror",error=>errors.push(error.message));});
test.afterEach(async({page})=>{expect(browserErrors.get(page)??[]).toEqual([]);});
import {createFolder,chooseRow,enterFolder,confirmDeletion,clean} from "./helpers/document-explorer";

test.beforeAll(async()=>{await clean("explorer-");});

test("资源管理器：分类入口、直属目录、路径、双击、历史、图标和递归搜索",async({page})=>{
 test.setTimeout(120000);
 const prefix=`explorer-nav-${Date.now()}-`;await documentLogin(page,"administrator");
 try{
  await page.goto("/admin/documents");await expect(page.locator('[data-explorer-kind="location"]')).toHaveCount(3);
  await page.getByRole("listitem",{name:"我的资料",exact:true}).dblclick();await page.getByRole("listitem",{name:"本人资料",exact:true}).dblclick();
  const folder=await createFolder(page,`${prefix}parent`);await expect(page.locator(`[data-explorer-item="${folder.id}"]`)).toBeVisible();await enterFolder(page,folder.id);
  const child=await createFolder(page,`${prefix}child`);await enterFolder(page,child.id);await uploadDocumentFiles(page,[`${prefix}find.txt`]);
  await page.getByRole("button",{name:"上一级",exact:true}).click();await expect(page.locator(`[data-explorer-item="${child.id}"]`)).toBeVisible();
  await page.getByRole("textbox",{name:"搜索资料",exact:true}).fill("find");await page.getByRole("button",{name:"搜索资料",exact:true}).click();await expect(page.locator('[data-document-file]')).toHaveCount(1);
  await page.getByRole("button",{name:"图标视图",exact:true}).click();await expect(page.getByRole("button",{name:"详细列表",exact:true})).toBeVisible();
  await page.reload();await expect(page.locator('[data-document-file]')).toHaveCount(1);await page.getByRole("button",{name:"返回",exact:true}).click();await expect(page.locator(`[data-explorer-item="${child.id}"]`)).toBeVisible();
  for(const width of [1440,1024,390,320]){await checkDocumentViewport(page,width,"explorer");const path=await page.getByRole("navigation",{name:"当前位置",exact:true}).boundingBox();expect(path!.height).toBeLessThan(320);}
 }finally{await clean(prefix);}
});

test("资源管理器：整夹跨人员移动保留对象和模板内容，剪切粘贴完成后刷新一致",async({page})=>{
 test.setTimeout(180000);const prefix=`explorer-move-${Date.now()}-`;await documentLogin(page,"administrator");
 try{
  await page.goto("/admin/documents?scope=folder");const folder=await createFolder(page,`${prefix}source`);await enterFolder(page,folder.id);const child=await createFolder(page,`${prefix}child`);await enterFolder(page,child.id);await uploadDocumentFiles(page,[`${prefix}file.txt`]);
  const original=(await authoritativeFiles([`${prefix}file.txt`]))[0];await confirmFileObjects([original]);
  // 模板由真实公司模板入口创建，填写内容由编辑页保存；不会用静态文档代替交互模板。
  await page.goto("/admin/company-templates");const create=page.getByRole("button",{name:"新建文档",exact:true}).first();await create.click();
  const dialog=page.getByRole("dialog");await dialog.getByRole("combobox",{name:/人员或客户|请选择人员或客户/}).click();await page.getByRole("option",{name:/管理员|系统管理员|Admin/}).first().click();
  await dialog.getByRole("combobox",{name:/文件夹/}).click();await page.getByRole("option",{name:new RegExp(prefix+"child")}).click();await dialog.getByRole("button",{name:"确认",exact:true}).click();
  await expect(page).toHaveURL(/documents\/templates\//,{timeout:30000});
  const docId=new URL(page.url()).pathname.split("/").at(-1)!;const before=await documentAdmin().from("company_template_documents").select("*").eq("id",docId).single();expect(before.error).toBeNull();
  // 方便按前缀清理，文档名称仍通过真实页面重命名。
  await page.getByRole("button",{name:"重命名",exact:true}).click();await page.getByRole("dialog").getByRole("textbox").fill(`${prefix}template`);await page.getByRole("dialog").getByRole("button",{name:"确认",exact:true}).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("status").filter({hasText:/^已保存$/})).toBeVisible();
  const snapshot=await documentAdmin().from("company_template_documents").select("*").eq("id",docId).single();
  await page.goto("/admin/documents?scope=folder");await chooseRow(page,folder.id);await page.getByRole("button",{name:"剪切",exact:true}).click();
  const manager=await documentUser("manager");await page.goto(`/admin/documents?scope=folder&user=${manager}`);await page.getByRole("button",{name:"粘贴",exact:true}).click();
  await page.getByRole("dialog").getByRole("button",{name:"确认",exact:true}).click();await expect(page.getByRole("dialog")).toHaveCount(0,{timeout:60000});
  const moved=await documentAdmin().from("document_folders").select("*").eq("id",folder.id).single();const nested=await documentAdmin().from("document_folders").select("*").eq("id",child.id).single();expect(moved.data!.archive_id).toBe(nested.data!.archive_id);expect(moved.data!.version).toBe(folder.version+1);
  const actual=(await authoritativeFiles([`${prefix}file.txt`]))[0];expect(actual.storage_path).toBe(original.storage_path);expect(actual.sha256).toBe(original.sha256);await confirmFileObjects([actual]);
  const doc=await documentAdmin().from("company_template_documents").select("*").eq("id",docId).single();expect(doc.data!.state).toEqual(snapshot.data!.state);expect(doc.data!.template_version_id).toBe(snapshot.data!.template_version_id);expect(doc.data!.revision).toBe(snapshot.data!.revision+1);
  await page.reload();await expect(page.locator(`[data-explorer-item="${folder.id}"]`)).toBeVisible();
 }finally{await clean(prefix);}
});

test("资源管理器：真实ZIP保留目录和同名文件；递归删除核对对象及记录消失",async({page})=>{
 test.setTimeout(180000);const prefix=`explorer-delete-${Date.now()}-`;await documentLogin(page,"administrator");
 try{
  await page.goto("/admin/documents?scope=folder");const folder=await createFolder(page,`${prefix}folder`);await enterFolder(page,folder.id);await uploadDocumentFiles(page,[`${prefix}same.txt`,`${prefix}same.txt`]);const files=await authoritativeFiles([`${prefix}same.txt`]);await confirmFileObjects(files);
  await page.getByRole("button",{name:"上一级",exact:true}).click();await chooseRow(page,folder.id);await page.getByRole("button",{name:"下载",exact:true}).click();
  const downloadPromise=page.waitForEvent("download");await page.getByRole("dialog").getByRole("button",{name:"确认",exact:true}).click();const download=await downloadPromise;const path=await download.path();expect(path).not.toBeNull();
  const {readFileSync}=await import("node:fs");const entries=unzipSync(readFileSync(path!));const names=Object.keys(entries).filter(name=>!name.endsWith("/"));expect(names).toHaveLength(2);expect(names.every(name=>name.startsWith(folder.name+"/"))).toBe(true);for(const name of names)expect(Buffer.from(entries[name]).toString("utf8")).toBe("真实资料\n");
  await page.getByRole("button",{name:"删除",exact:true}).click();await confirmDeletion(page);
  expect((await documentAdmin().from("document_folders").select("id").eq("id",folder.id)).data).toHaveLength(0);expect(await authoritativeFiles([`${prefix}same.txt`])).toHaveLength(0);for(const file of files)expect((await documentAdmin().storage.from("document-library").exists(file.storage_path)).data).toBe(false);
  await page.reload();await expect(page.locator(`[data-explorer-item="${folder.id}"]`)).toHaveCount(0);
 }finally{await clean(prefix);}
});

test("资源管理器：搜索中同名目录下载各自保留目录和字节",async({page})=>{
 test.setTimeout(120000);const prefix="explorer-zip-roots-"+Date.now()+"-";const name=prefix+"same";await documentLogin(page,"administrator");
 try{
  await page.goto("/admin/documents?scope=folder");const roots=[];
  for(const label of ["a","b"]){
   const parent=await createFolder(page,prefix+"parent-"+label);await enterFolder(page,parent.id);const root=await createFolder(page,name);roots.push(root);await enterFolder(page,root.id);await uploadDocumentFiles(page,[prefix+"entry.txt"],Buffer.from(label));
   await page.getByRole("button",{name:"上一级",exact:true}).click();await page.getByRole("button",{name:"上一级",exact:true}).click();
  }
  await page.getByRole("textbox",{name:"搜索资料",exact:true}).fill(name);await page.getByRole("button",{name:"搜索资料",exact:true}).click();await expect(page.locator('[data-explorer-kind="folder"]')).toHaveCount(2);
  for(const root of roots)await page.locator('[data-explorer-item="'+root.id+'"]').getByRole("checkbox").check();
  await page.getByRole("button",{name:"下载",exact:true}).click();const downloading=page.waitForEvent("download");await page.getByRole("dialog").getByRole("button",{name:"确认",exact:true}).click();const download=await downloading;const path=await download.path();expect(path).not.toBeNull();
  const {readFileSync}=await import("node:fs");const entries=unzipSync(readFileSync(path!));expect(Object.keys(entries).filter(n=>n.endsWith("/")).sort()).toEqual([name+" (2)/",name+"/"].sort());
  const files=Object.entries(entries).filter(([n])=>!n.endsWith("/"));expect(files).toHaveLength(2);expect(files.map(([,bytes])=>Buffer.from(bytes).toString()).sort()).toEqual(["a","b"]);
 }finally{await clean(prefix);}
});

test("资源管理器：右键重命名、键盘与输入框、多选逐项移动",async({page})=>{
 test.setTimeout(120000);const prefix=`explorer-select-${Date.now()}-`;await documentLogin(page,"administrator");
 try{
  await page.goto("/admin/documents?scope=folder");const folder=await createFolder(page,`${prefix}dest`);await uploadDocumentFiles(page,[`${prefix}a.txt`,`${prefix}b.txt`]);const files=await authoritativeFiles([`${prefix}a.txt`,`${prefix}b.txt`]);
  const row=page.locator(`[data-explorer-item="${files[0].id}"]`);await row.click({button:"right"});await page.getByRole("menuitem",{name:"重命名",exact:true}).click();await page.getByRole("dialog").getByRole("textbox").fill(`${prefix}renamed.txt`);await page.getByRole("dialog").getByRole("button",{name:"确认",exact:true}).click();await expect(page.getByRole("dialog")).toHaveCount(0);
  expect((await authoritativeFiles([`${prefix}renamed.txt`]))[0].version).toBe(files[0].version+1);
  const search=page.getByRole("textbox",{name:"搜索资料",exact:true});await search.fill("keep text");await search.press("Control+A");await expect(search).toHaveValue("keep text");await search.fill("");
  await page.locator(`[data-explorer-item="${files[0].id}"]`).click();await page.locator(`[data-explorer-item="${files[1].id}"]`).click({modifiers:["Control"]});await page.locator(`[data-explorer-item="${files[1].id}"]`).press("Control+x");
  await enterFolder(page,folder.id);await page.locator("section").filter({has:page.getByRole("heading",{name:"资料库",exact:true})}).press("Control+v");
  await page.getByRole("dialog").getByRole("button",{name:"确认",exact:true}).click();await expect(page.getByRole("dialog")).toHaveCount(0,{timeout:60000});
  const actual=await documentAdmin().from("document_files").select("*").in("id",files.map(f=>f.id));expect(actual.data!.every(f=>f.folder_id===folder.id)).toBe(true);await page.reload();await expect(page.locator('[data-document-file]')).toHaveCount(2);
 }finally{await clean(prefix);}
});


test("资源管理器：模板继续编辑、从列表另存一份、直接移动和删除",async({page})=>{
 test.setTimeout(150000);const prefix=`explorer-template-${Date.now()}-`;await documentLogin(page,"administrator");
 try{
  await page.goto("/admin/documents?scope=folder");const folder=await createFolder(page,`${prefix}folder`);await page.goto("/admin/company-templates");await page.getByRole("button",{name:"新建文档",exact:true}).first().click();
  await confirmDocumentFolder(page,folder.id);await expect(page).toHaveURL(/documents\/templates\//);await expectDocumentSaved(page);const id=page.url().split("/").pop()!;
  await page.frameLocator("iframe").locator("#client").fill(`${prefix}填写内容`);await expectDocumentContains(page,id,`${prefix}填写内容`);await page.getByRole("button",{name:"重命名",exact:true}).click();await page.getByRole("dialog").getByRole("textbox").fill(`${prefix}original`);await page.getByRole("dialog").getByRole("button",{name:"确认",exact:true}).click();await expect(page.getByRole("dialog")).toHaveCount(0);
  const before=(await documentAdmin().from("company_template_documents").select("*").eq("id",id).single()).data!;await page.getByRole("button",{name:"返回所在文件夹",exact:true}).click();await page.locator(`[data-template-document="${id}"]`).click({button:"right"});await page.getByRole("menuitem",{name:"另存一份",exact:true}).click();const dialog=page.getByRole("dialog");await dialog.getByRole("textbox",{name:"名称",exact:true}).fill(`${prefix}copy`);
  const destinations=await(await page.request.get("/api/company-template-documents/destinations")).json();const archive=destinations.archives.find((a:{user_id:string})=>a.user_id===before.owner_id);const personal=destinations.folders.find((f:{archive_id:string;system_key:string})=>f.archive_id===archive.id&&f.system_key==="personal");await dialog.getByRole("combobox",{name:"人员或客户",exact:true}).click();await page.getByRole("option",{name:archive.name,exact:true}).click();await dialog.getByRole("combobox",{name:"目标文件夹",exact:true}).click();await page.getByRole("option",{name:"本人资料",exact:true}).click();await dialog.getByRole("button",{name:"确认",exact:true}).click();await expect(dialog).toHaveCount(0);
  const copy=(await documentAdmin().from("company_template_documents").select("*").eq("name",`${prefix}copy`).single()).data!;expect(copy.id).not.toBe(id);expect(copy.state).toEqual(before.state);expect(copy.template_version_id).toBe(before.template_version_id);expect(copy.folder_id).toBe(personal.id);
  await page.locator(`[data-template-document="${id}"]`).click();await page.getByRole("button",{name:"剪切",exact:true}).click();await page.getByRole("button",{name:"上一级",exact:true}).click();await page.getByRole("button",{name:"粘贴",exact:true}).click();await dialog.getByRole("button",{name:"确认",exact:true}).click();await expect(dialog).toHaveCount(0);const moved=(await documentAdmin().from("company_template_documents").select("*").eq("id",id).single()).data!;expect(moved.folder_id).toBe(personal.id);expect(moved.state_sha256).toBe(before.state_sha256);expect(moved.revision).toBe(before.revision+1);
  await page.locator(`[data-template-document="${copy.id}"]`).dblclick();await expect(page.frameLocator("iframe").locator("#client")).toHaveValue(`${prefix}填写内容`);await page.getByRole("button",{name:"返回所在文件夹",exact:true}).click();await page.locator(`[data-template-document="${copy.id}"]`).click();await page.locator(`[data-template-document="${copy.id}"]`).press("Delete");await confirmDeletion(page);expect((await documentAdmin().from("company_template_documents").select("id").eq("id",copy.id)).data).toHaveLength(0);await page.reload();await expect(page.locator(`[data-template-document="${id}"]`)).toBeVisible();await expect(page.locator(`[data-template-document="${copy.id}"]`)).toHaveCount(0);
 }finally{await clean(prefix);}
});


test("资源管理器：长名称及长路径，当前页全选、排序和分页清空选择",async({page})=>{
 test.setTimeout(180000);const prefix=`explorer-page-${Date.now()}-`;await documentLogin(page,"administrator");
 try{
  await page.goto("/admin/documents?scope=folder");for(let depth=0;depth<3;depth++){const folder=await createFolder(page,`${prefix}${depth}${"长名称资料目录".repeat(18)}`);await enterFolder(page,folder.id);}
  await createFolder(page,`${prefix}child`);await uploadDocumentFiles(page,Array.from({length:22},(_,i)=>`${prefix}${String(i).padStart(2,"0")}.txt`));await expect(page.locator('[data-explorer-item]')).toHaveCount(20);await page.getByRole("checkbox",{name:"选择当前页全部",exact:true}).check();await expect(page.getByText("已选 20 项",{exact:true})).toBeVisible();await page.getByRole("button",{name:"下一页",exact:true}).click();await expect(page.locator('[data-explorer-item]')).toHaveCount(3);await expect(page.getByText("已选 0 项",{exact:true})).toBeVisible();
  await page.getByRole("combobox",{name:"排序方式",exact:true}).click();await page.getByRole("option",{name:"按类型",exact:true}).click();await expect(page).toHaveURL(/sort=type/);await expect(page.locator('[data-explorer-item]')).toHaveCount(20);await expect(page.locator('[data-explorer-item]').first()).toHaveAttribute("data-explorer-kind","folder");
  await page.setViewportSize({width:320,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const nav=await page.getByRole("navigation",{name:"当前位置",exact:true}).boundingBox();expect(nav!.height).toBeLessThan(100);await page.screenshot({path:"output/document-explorer-long-path-320.png",fullPage:true});await page.reload();await expect(page).toHaveURL(/sort=type/);await expect(page.locator('[data-explorer-item]')).toHaveCount(20);
 }finally{await clean(prefix);}
});
