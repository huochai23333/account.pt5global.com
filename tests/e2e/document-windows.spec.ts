import {test,expect,type Page} from "@playwright/test";
import {documentLogin,documentAdmin,documentReader,readLibrary,uploadDocumentFiles,authoritativeFiles,confirmFileObjects,checkDocumentViewport} from "./helpers/document-library";
import {createFolder,enterFolder,chooseRow,clean} from "./helpers/document-explorer";

test.use({video:"off"});
test.setTimeout(120000);
const errors=new WeakMap<Page,string[]>();
test.beforeEach(async({page})=>{const list:string[]=[];errors.set(page,list);page.on("pageerror",e=>list.push(e.message));});
test.afterEach(async({page})=>{expect(errors.get(page)).toEqual([]);});
/** 业务凭证直接读取本地数据库；页面响应只用于记录用户选择的位置。 */
async function folders(parent:string){const r=await documentAdmin().from("document_folders").select("*").eq("parent_id",parent);expect(r.error).toBeNull();return r.data!;}
async function sandbox(page:Page,prefix:string){await documentLogin(page,"administrator");await page.goto("/admin/documents");await page.getByRole("listitem",{name:"我的文档",exact:true}).dblclick();await expect(page).toHaveURL(/scope=archive/);const f=await createFolder(page,prefix+"sandbox");await enterFolder(page,f.id);return f;}

test("首页两个固定入口与账户直达，分类层所有新建入口受限",async({page})=>{
 await documentLogin(page,"administrator");await page.goto("/admin/documents");
 await expect(page.locator('[data-explorer-kind="location"]')).toHaveCount(2);await expect(page.getByRole("listitem",{name:"我的文档",exact:true})).toBeVisible();await expect(page.getByRole("listitem",{name:"公共文档",exact:true})).toBeVisible();
 const before=await documentAdmin().from("document_folders").select("id",{count:"exact",head:true});
 await expect(page.locator("[data-explorer-create]")).toHaveCount(0);await expect(page.locator('input[type="file"]')).toHaveCount(0);
 await page.locator('[data-document-content]').click({button:"right",position:{x:24,y:80}});await expect(page.getByRole("menuitem",{name:"新建文件夹",exact:true})).toHaveCount(0);await page.keyboard.press("Escape");await page.locator('[data-document-content]').click({position:{x:4,y:4}});await page.keyboard.press("Control+Shift+N");await expect(page.locator('[data-inline-name]')).toHaveCount(0);
 expect((await documentAdmin().from("document_folders").select("id",{count:"exact",head:true})).count).toBe(before.count);
 for(const label of ["人员资料","客户资料"]){await page.getByRole("button",{name:label,exact:true}).click();await expect(page.locator("[data-explorer-create]")).toHaveCount(0);const account=page.locator('[data-explorer-kind="archive"]').first();await expect(account).toBeVisible();await account.dblclick();await expect(page).toHaveURL(/scope=archive/);await expect(page.locator("[data-document-content]")).toHaveAttribute("aria-busy","false");const data=await readLibrary(page);expect(data.folderId).toBeTruthy();expect(data.items.every(i=>i.kind!=="folder"||!i.folder.system_key)).toBe(true);await expect(page.locator("[data-explorer-create]")).toBeVisible();await page.getByRole("button",{name:"上一级",exact:true}).click();await expect(page.locator('[data-explorer-kind="archive"]').first()).toBeVisible();}
});

test("默认名称、Esc和空输入保留目录，回车与失焦行内改名",async({page})=>{
 const prefix=`windows-names-${Date.now()}-`;
 try{const parent=await sandbox(page,prefix);const create=page.locator("[data-explorer-create]");const input=page.locator('[data-inline-name]');
  for(const key of ["Enter","Escape","blur"]){if(key==="Enter"){await page.locator("[data-document-content]").click({button:"right",position:{x:24,y:80}});await page.getByRole("menuitem",{name:"新建文件夹",exact:true}).click();}else await create.click();await expect(input).toBeFocused();expect(await input.evaluate((e:HTMLInputElement)=>e.selectionEnd!-e.selectionStart!)).toBeGreaterThan(0);if(key==="Enter")await input.fill("");if(key==="blur")await page.locator('[data-document-content]').click({position:{x:4,y:4}});else await input.press(key);await expect(input).toHaveCount(0);}
  expect((await folders(parent.id)).map(f=>f.name).sort()).toEqual(["新建文件夹","新建文件夹 (2)","新建文件夹 (3)"].sort());
  const row=page.getByRole("listitem",{name:"新建文件夹",exact:true});await row.click({button:"right"});await page.getByRole("menuitem",{name:"重命名",exact:true}).click();await expect(input).toBeFocused();await input.fill(prefix+"renamed");
  await input.dispatchEvent("compositionstart");await input.press("Enter");await expect(input).toHaveCount(1);await input.dispatchEvent("compositionend");await input.press("Enter");await expect(input).toHaveCount(0);
  const updated=(await folders(parent.id)).find(f=>f.name===prefix+"renamed")!;expect(updated.version).toBe(2);
  await page.locator(`[data-explorer-item="${updated.id}"]`).click();await page.keyboard.press("F2");await input.fill(prefix+"blur");await page.locator('[data-document-content]').click({position:{x:4,y:4}});await expect(input).toHaveCount(0);expect((await folders(parent.id)).find(f=>f.id===updated.id)!.version).toBe(3);
  await page.reload();await expect(page.getByRole("listitem",{name:prefix+"blur",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"上一级",exact:true}).click();await expect(page.locator(`[data-explorer-item="${parent.id}"]`)).toBeVisible();const tree=page.getByRole("tree");await tree.getByRole("button",{name:`展开${parent.name}`,exact:true}).click();await tree.getByRole("button",{name:prefix+"blur",exact:true}).click({button:"right"});await page.getByRole("menuitem",{name:"重命名",exact:true}).click();await expect(input).toBeFocused();expect((await readLibrary(page)).folderId).toBe(parent.id);await input.fill(prefix+"tree");await input.press("Enter");await expect(input).toHaveCount(0);expect((await folders(parent.id)).find(f=>f.id===updated.id)!.version).toBe(4);
 }finally{await clean(prefix);}
});

test("非法名称、目录重名和过期版本不能显示保存成功",async({page})=>{
 const prefix=`windows-errors-${Date.now()}-`;
 try{const parent=await sandbox(page,prefix);const a=await createFolder(page,prefix+"a");await createFolder(page,prefix+"b");await chooseRow(page,a.id);await page.keyboard.press("F2");const input=page.locator('[data-inline-name]');await input.fill("bad/name");await input.press("Enter");await expect(page.locator('[id^="name-error-"]')).toBeVisible();await input.fill(prefix+"b");await input.press("Enter");await expect(input).toBeVisible();await expect(page.locator('[id^="name-error-"]')).toBeVisible();expect((await folders(parent.id)).find(f=>f.id===a.id)!.version).toBe(a.version);await input.press("Escape");
  await chooseRow(page,a.id);await page.keyboard.press("F2");await documentAdmin().from("document_folders").update({version:a.version+1}).eq("id",a.id);await input.fill(prefix+"stale");await input.press("Enter");await expect(input).toBeVisible();await expect(page.locator('[data-document-result="succeeded"]')).toHaveCount(0);expect((await folders(parent.id)).find(f=>f.id===a.id)!.name).toBe(a.name);await input.press("Escape");
 }finally{await clean(prefix);}
});

test("文件右键与F2改名保留对象、内容和扩展名，刷新仍一致",async({page})=>{
 const prefix=`windows-file-${Date.now()}-`;
 try{const parent=await sandbox(page,prefix);await uploadDocumentFiles(page,[prefix+"original.txt"]);const original=(await authoritativeFiles([prefix+"original.txt"]))[0];await chooseRow(page,original.id);await page.keyboard.press("F2");const input=page.locator('[data-inline-name]');await expect(input).toBeFocused();expect(await input.evaluate((e:HTMLInputElement)=>e.value.slice(e.selectionStart!,e.selectionEnd!))).toBe(prefix+"original");await input.fill(prefix+"renamed.txt");await input.press("Enter");await expect(input).toHaveCount(0);
  const actual=(await authoritativeFiles([prefix+"renamed.txt"]))[0];expect(actual.id).toBe(original.id);expect(actual.version).toBe(original.version+1);expect(actual.folder_id).toBe(parent.id);expect(actual.sha256).toBe(original.sha256);expect(actual.storage_path).toBe(original.storage_path);await confirmFileObjects([actual]);await page.reload();await expect(page.locator(`[data-document-file="${actual.id}"]`)).toContainText(actual.name);
 }finally{await clean(prefix);}
});

test("公共文档跨员工共同管理，客户和匿名访问被拒绝",async({page})=>{
 const prefix=`windows-public-${Date.now()}-`;
 try{await documentLogin(page,"administrator");await page.goto("/admin/documents?scope=public");const publicData=await readLibrary(page);const parent=await createFolder(page,prefix+"folder");await enterFolder(page,parent.id);await uploadDocumentFiles(page,[prefix+"file.txt"]);const file=(await authoritativeFiles([prefix+"file.txt"]))[0];
  await documentLogin(page,"salesman");await page.goto(`/salesman/documents?scope=folder&folder=${parent.id}`);await expect(page.locator(`[data-document-file="${file.id}"]`)).toBeVisible();await chooseRow(page,file.id);await page.keyboard.press("F2");await page.locator('[data-inline-name]').fill(prefix+"by-colleague.txt");await page.locator('[data-inline-name]').press("Enter");await expect(page.locator('[data-inline-name]')).toHaveCount(0);const changed=(await authoritativeFiles([prefix+"by-colleague.txt"]))[0];expect(changed.id).toBe(file.id);expect(changed.version).toBe(file.version+1);await confirmFileObjects([changed]);await page.reload();await expect(page.locator(`[data-document-file="${file.id}"]`)).toContainText(changed.name);
  const client=await documentReader("client");expect((await client.rpc("document_explorer_read",{p_selection:{scope:"public"}})).error).not.toBeNull();expect((await client.from("document_folders").select("id").eq("id",publicData.folderId))).toMatchObject({data:[]});expect((await client.storage.from("document-library").download(changed.storage_path)).error).not.toBeNull();
  await page.context().clearCookies();expect((await page.request.get(`/api/document-library/files/${file.id}/content`)).status()).toBe(403);
 }finally{await clean(prefix);}
});

test("新建响应丢失后核对原操作，重复点击不生成第二个目录",async({page})=>{
 const prefix=`windows-disconnect-${Date.now()}-`;
 try{const parent=await sandbox(page,prefix);let operationId="";
  await page.route("**/api/document-library",async route=>{if(route.request().method()!=="POST")return route.continue();operationId=route.request().postDataJSON().operationId;await route.fetch();await route.abort("connectionreset");});
  await page.locator("[data-explorer-create]").click();await expect(page.locator('[data-document-result="failed"]')).toBeVisible();await page.unroute("**/api/document-library");await page.locator("[data-explorer-create]").click();expect(await folders(parent.id)).toHaveLength(1);
  const receipt=await documentAdmin().from("document_operations").select("receipt").eq("id",operationId).single();expect(receipt.data!.receipt).toMatchObject({status:"succeeded",affectedCount:1});await page.getByRole("button",{name:"继续核对",exact:true}).click();await expect(page.locator('[data-document-result="succeeded"]')).toBeVisible();await page.reload();expect(await folders(parent.id)).toHaveLength(1);await expect(page.getByRole("listitem",{name:"新建文件夹",exact:true})).toBeVisible();
  const existing=(await folders(parent.id))[0];await chooseRow(page,existing.id);await page.keyboard.press("F2");
  await page.route("**/api/document-library",async route=>{if(route.request().method()!=="POST")return route.continue();await route.fetch();await route.abort("connectionreset");});
  await page.locator("[data-inline-name]").fill(prefix+"recovered");await page.locator("[data-inline-name]").press("Enter");await expect(page.locator('[data-document-result="failed"]')).toBeVisible();await expect(page.locator("[data-inline-name]")).toBeDisabled();await page.unroute("**/api/document-library");await page.getByRole("button",{name:"继续核对",exact:true}).click();await expect(page.locator("[data-inline-name]")).toHaveCount(0);expect((await folders(parent.id))[0]).toMatchObject({id:existing.id,name:prefix+"recovered",version:existing.version+1});await page.getByRole("button",{name:"我的文档首页",exact:true}).click();await expect(page).toHaveURL(/scope=home/);await page.goto(`/admin/documents?scope=folder&folder=${parent.id}`);await page.reload();await expect(page.getByRole("listitem",{name:prefix+"recovered",exact:true})).toBeVisible();
 }finally{await page.unrouteAll({behavior:"ignoreErrors"}).catch(()=>{});await clean(prefix);}
});

test("跨账户剪切与复制到公共目录，独立核对记录与对象",async({page})=>{
 const prefix=`windows-move-${Date.now()}-`;
 try{await sandbox(page,prefix);await uploadDocumentFiles(page,[prefix+"file.txt"]);const original=(await authoritativeFiles([prefix+"file.txt"]))[0];await chooseRow(page,original.id);await page.getByRole("button",{name:"剪切",exact:true}).click();await page.goto("/admin/documents?scope=public");const dest=await readLibrary(page);const parent=await createFolder(page,prefix+"public");await enterFolder(page,parent.id);await page.getByRole("button",{name:"粘贴",exact:true}).click();await page.getByRole("dialog").getByRole("button",{name:"确认",exact:true}).click();await expect(page.getByRole("dialog")).toHaveCount(0,{timeout:60000});const moved=(await authoritativeFiles([original.name]))[0];expect(moved.id).toBe(original.id);expect(moved.folder_id).toBe(parent.id);expect(moved.version).toBe(original.version+1);expect(moved.storage_path).toBe(original.storage_path);await confirmFileObjects([moved]);
  await chooseRow(page,moved.id);await page.getByRole("button",{name:"复制",exact:true}).click();await page.goto("/admin/documents?scope=public");await page.getByRole("button",{name:"粘贴",exact:true}).click();await page.getByRole("dialog").getByRole("button",{name:"确认",exact:true}).click();await expect(page.getByRole("dialog")).toHaveCount(0,{timeout:60000});const copies=await authoritativeFiles([original.name,original.name.replace(/\.txt$/," (2).txt")]);expect(copies).toHaveLength(2);const copy=copies.find(f=>f.id!==original.id)!;expect(copy.folder_id).toBe(dest.folderId);expect(copy.sha256).toBe(original.sha256);await confirmFileObjects(copies);await page.reload();await expect(page.locator(`[data-document-file="${copy.id}"]`)).toBeVisible();
 }finally{await clean(prefix);}
});

test("列表与图标视图在桌面和窄屏命名时无溢出或错误覆盖层",async({page})=>{
 const prefix=`windows-layout-${Date.now()}-`;
 try{await sandbox(page,prefix);for(const width of [1440,1024,390,320]){await page.setViewportSize({width,height:900});await page.locator("[data-explorer-create]").click();const input=page.locator('[data-inline-name]');await expect(input).toBeFocused();await input.fill(prefix+"长名称".repeat(8));const box=await input.boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(width);await page.screenshot({path:`output/documents-inline-${width}.png`,fullPage:true});await input.press("Escape");await checkDocumentViewport(page,width,"windows");await expect(page.locator('nextjs-portal [data-nextjs-dialog]')).toHaveCount(0);if(width===1024)await page.getByRole("button",{name:"图标视图",exact:true}).click();}
 }finally{await clean(prefix);}
});

test("递归搜索、排序和分页在新账户层级中保持真实数据一致",async({page})=>{
 test.setTimeout(180000);const prefix=`windows-search-${Date.now()}-`;
 try{const root=await sandbox(page,prefix);const parent=await createFolder(page,prefix+"parent");await enterFolder(page,parent.id);const child=await createFolder(page,prefix+"child");await enterFolder(page,child.id);await uploadDocumentFiles(page,[prefix+"needle.txt"]);const nested=(await authoritativeFiles([prefix+"needle.txt"]))[0];
  await page.getByRole("button",{name:"上一级",exact:true}).click();await expect(page.locator(`[data-explorer-item="${child.id}"]`)).toBeVisible();await page.getByRole("button",{name:"上一级",exact:true}).click();await expect(page.locator(`[data-explorer-item="${parent.id}"]`)).toBeVisible();
  const names=Array.from({length:21},(_,i)=>prefix+String(i).padStart(2,"0")+".txt");await uploadDocumentFiles(page,names);expect(await authoritativeFiles(names)).toHaveLength(21);await expect(page.locator('[data-document-file]')).toHaveCount(19);await page.getByRole("button",{name:"下一页",exact:true}).click();await expect(page.locator('[data-document-file]')).toHaveCount(2);await page.reload();expect((await readLibrary(page)).page).toBe(2);
  await page.getByRole("textbox",{name:"搜索资料",exact:true}).fill("needle");await page.getByRole("button",{name:"搜索资料",exact:true}).click();await expect(page.locator(`[data-document-file="${nested.id}"]`)).toBeVisible();const result=await readLibrary(page);expect(result.total).toBe(1);expect(result.folderId).toBe(root.id);await page.reload();await expect(page.locator(`[data-document-file="${nested.id}"]`)).toBeVisible();await confirmFileObjects([nested]);
 }finally{await clean(prefix);}
});
