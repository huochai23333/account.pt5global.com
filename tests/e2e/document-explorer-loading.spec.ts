import {test,expect,type Route} from "@playwright/test";
import {writeFileSync} from "node:fs";
import {documentLogin,uploadDocumentFiles,authoritativeFiles,confirmFileObjects,documentAdmin} from "./helpers/document-library";
import {createFolder,enterFolder,chooseRow,confirmDeletion,clean} from "./helpers/document-explorer";

test.use({video:"off"});
/** 延迟真实查询响应观察中间状态，不用模拟页面代替目录树与浏览器历史。 */
test("局部加载保留目录树展开状态，失败重试及返回后刷新一致",async({page})=>{
 test.setTimeout(120000);const prefix=`explorer-loading-${Date.now()}-`;const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));let release=()=>{};
 await page.setViewportSize({width:1440,height:900});await documentLogin(page,"administrator");
 try{
  await page.goto("/admin/documents?scope=folder");const parent=await createFolder(page,`${prefix}parent`);await enterFolder(page,parent.id);const child=await createFolder(page,`${prefix}child`);await enterFolder(page,child.id);await page.getByRole("button",{name:"上一级",exact:true}).click();
  // 左树现在会保留旧内容，必须等右侧确认目标目录后才测量刷新前的布局。
  await expect(page.locator(`[data-explorer-item="${child.id}"]`)).toBeVisible();await expect(page.locator('[data-document-content]')).toHaveAttribute("aria-busy","false");
  const tree=page.getByRole("tree",{name:"资料文件夹",exact:true});await expect(tree.getByText(child.name,{exact:true})).toBeVisible();
  const treeNode=await tree.elementHandle();const toolbarNode=await page.getByRole("navigation",{name:"当前位置",exact:true}).elementHandle();
  const before=await page.locator('[data-document-content]').boundingBox();const held=new Promise<void>(resolve=>release=resolve);let slow=true;
  await page.route(/\/api\/document-library\?/,async route=>{if(!slow){await route.continue();return;}slow=false;const response=await route.fetch();await held;await route.fulfill({response}).catch(()=>{});});
  await page.getByRole("button",{name:"刷新",exact:true}).click();const content=page.locator('[data-document-content]');await expect(content).toHaveAttribute("aria-busy","true");
  await expect(content.getByRole("status")).toHaveText("正在读取资料");await expect(content.locator("svg")).toHaveCSS("animation-name","spin");await expect(tree.getByText(child.name,{exact:true})).toBeVisible();
  expect(await treeNode!.evaluate(node=>node.isConnected)).toBe(true);expect(await toolbarNode!.evaluate(node=>node.isConnected)).toBe(true);expect((await content.boundingBox())!.height).toBeCloseTo(before!.height,0);
  await page.screenshot({path:"output/document-explorer-local-loading-1440.png",fullPage:true});await tree.getByRole("button",{name:`收起${parent.name}`,exact:true}).click();await expect(tree.getByText(child.name,{exact:true})).toBeHidden();release();await expect(content).toHaveAttribute("aria-busy","false");await expect(tree.getByText(child.name,{exact:true})).toBeHidden();await tree.getByRole("button",{name:`展开${parent.name}`,exact:true}).click();await expect(tree.getByText(child.name,{exact:true})).toBeVisible();await page.unroute(/\/api\/document-library\?/);
  // 加载途中浏览器返回：晚到的旧目录响应不得覆盖已完成的新查询。
  await enterFolder(page,child.id);const heldBack=new Promise<void>(resolve=>release=resolve);let fetched=()=>{};const backFetched=new Promise<void>(resolve=>fetched=resolve);let delayBack=true;
  await page.route(/\/api\/document-library\?/,async route=>{if(!delayBack){await route.continue();return;}delayBack=false;const response=await route.fetch();fetched();await heldBack;await route.fulfill({response}).catch(()=>{});});
  await page.getByRole("button",{name:"刷新",exact:true}).click();await backFetched;await page.goBack();await expect(page.locator(`[data-explorer-item="${child.id}"]`)).toBeVisible();release();await page.unrouteAll({behavior:"wait"});await expect(page).toHaveURL(new RegExp(`folder=${parent.id}`));await expect(page.locator(`[data-explorer-item="${child.id}"]`)).toBeVisible();expect(await treeNode!.evaluate(node=>node.isConnected)).toBe(true);
  // 普通网络错误保留已显示的目录，右侧不冒充新内容，并提供原位置重试。
  const fail=async(route:Route)=>route.fulfill({status:500,json:{error:"unconfirmed"}});await page.route(/\/api\/document-library\?/,fail);await page.getByRole("button",{name:"刷新",exact:true}).click();await expect(content.getByRole("alert")).toBeVisible();await expect(tree.getByText(child.name,{exact:true})).toBeVisible();await expect(content.locator('[data-explorer-item]')).toHaveCount(0);
  await page.unroute(/\/api\/document-library\?/,fail);await content.getByRole("button",{name:"重新加载",exact:true}).click();await expect(page.locator(`[data-explorer-item="${child.id}"]`)).toBeVisible();
  await page.reload();await expect(tree.getByText(child.name,{exact:true})).toBeVisible();await expect(page.locator("nextjs-portal")).not.toContainText("Runtime Error");expect(errors).toEqual([]);
 }finally{release();await page.unrouteAll({behavior:"ignoreErrors"});await clean(prefix);}
});

test("26项上传和整夹删除通知收起，文件区保持高度及真实终态",async({page})=>{
 test.setTimeout(180000);const prefix=`explorer-notices-${Date.now()}-`;const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));const viewports:{width:number;fileHeight:number}[]=[];await page.setViewportSize({width:1440,height:900});await documentLogin(page,"administrator");const names=Array.from({length:26},(_,i)=>`${prefix}${i}.txt`);
 try{
  await page.goto("/admin/documents?scope=folder");const folder=await createFolder(page,`${prefix}folder`);await enterFolder(page,folder.id);const content=page.locator('[data-document-content]');await expect(content).toHaveAttribute("aria-busy","false");const height=(await content.boundingBox())!.height;
  await uploadDocumentFiles(page,names);const files=await authoritativeFiles(names);expect(files).toHaveLength(26);await confirmFileObjects(files);
  const upload=page.locator('[data-document-upload-summary]');await expect(upload).toHaveJSProperty("open",false);expect((await upload.boundingBox())!.height).toBeLessThan(70);expect((await content.boundingBox())!.height).toBeCloseTo(height,0);
  await upload.locator("summary").click();await expect(upload.locator("ul")).toBeVisible();expect((await upload.locator("ul").boundingBox())!.height).toBeLessThanOrEqual(161);await upload.locator("summary").click();
  for(const width of [1440,1024,390,320]){
   await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const fileHeight=(await content.boundingBox())!.height;expect(fileHeight).toBeGreaterThan(width>=1024?350:180);viewports.push({width,fileHeight});
   // 批量按钮出现时，文件区和条目都必须留在原位，保证第二次点击仍然可以打开条目。
   const row=content.locator('[data-document-file]').first();await row.scrollIntoViewIfNeeded();const position=(await row.boundingBox())!.y;const filePosition=(await content.boundingBox())!.y;await row.getByRole("checkbox").check();await expect(row.getByRole("checkbox")).toBeChecked();expect((await row.boundingBox())!.y).toBeCloseTo(position,0);expect((await content.boundingBox())!.y).toBeCloseTo(filePosition,0);await row.getByRole("checkbox").uncheck();
   await page.screenshot({path:`output/document-explorer-notices-${width}.png`,fullPage:true});
  }
  await page.setViewportSize({width:1440,height:900});await page.getByRole("button",{name:"上一级",exact:true}).click();await chooseRow(page,folder.id);await page.getByRole("button",{name:"删除",exact:true}).click();await confirmDeletion(page);
  const batch=page.locator('[data-document-batch][data-batch-status="succeeded"]');await expect(batch).toHaveJSProperty("open",false);expect((await batch.boundingBox())!.height).toBeLessThan(70);
  const id=await batch.getAttribute("data-document-batch");const actual=await documentAdmin().from("document_batches").select("status,results").eq("id",id!).single();expect(actual.error).toBeNull();expect(actual.data!.status).toBe("succeeded");expect(actual.data!.results).toHaveLength(27);
  const remainingFolders=await documentAdmin().from("document_folders").select("id").eq("id",folder.id);expect(remainingFolders.error).toBeNull();expect(remainingFolders.data).toEqual([]);expect(actual.data!.results.every((result:{status:string})=>result.status==="succeeded")).toBe(true);
  // 独立列出对象目录核对删除；缺失对象的 exists 接口会返回 400，不能误当权限或网络错误。
  expect((await authoritativeFiles(names))).toHaveLength(0);for(const file of files){const parts=file.storage_path.split("/");const name=parts.pop()!;const objects=await documentAdmin().storage.from("document-library").list(parts.join("/"),{search:name});expect(objects.error).toBeNull();expect(objects.data!.some(object=>object.name===name)).toBe(false);}
  await batch.locator("summary").click();expect((await batch.getByRole("list",{name:"操作明细"}).boundingBox())!.height).toBeLessThanOrEqual(161);await batch.locator("summary").click();await page.reload();await expect(page.locator(`[data-explorer-item="${folder.id}"]`)).toHaveCount(0);await expect(page.locator(`[data-document-batch="${id}"]`)).toHaveJSProperty("open",false);await expect(page.locator("nextjs-portal [data-nextjs-dialog-overlay]")).toHaveCount(0);expect(errors).toEqual([]);
  // 成功通知收起，真实拒绝的空文件则自动展开失败明细，且不能留下资料记录。
  const invalidName=`${prefix}empty.txt`;await page.locator('input[type="file"]').setInputFiles({name:invalidName,mimeType:"text/plain",buffer:Buffer.alloc(0)});await expect(page.locator('[data-document-upload-summary]')).toHaveJSProperty("open",true);await expect(page.locator('[data-document-upload-result="failed"]')).toBeVisible();expect(await authoritativeFiles([invalidName])).toEqual([]);
  writeFileSync("output/document-explorer-loading-evidence.json",JSON.stringify({checkedAt:new Date().toISOString(),viewports,uploaded:files.map(file=>({id:file.id,version:file.version})),batch:{id,status:actual.data!.status,results:actual.data!.results.length},remainingFolders:0,remainingFiles:0,remainingObjects:0,rejectedUploadPersisted:false,reloadChecked:true,pageErrors:errors},null,2));
 }finally{await clean(prefix);}
});
