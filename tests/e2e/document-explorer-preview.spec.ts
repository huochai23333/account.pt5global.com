import {test,expect} from "@playwright/test";
import {readFileSync} from "node:fs";
import {unzipSync} from "fflate";
import {documentLogin,documentPdf,uploadDocumentFiles,authoritativeFiles,documentAdmin} from "./helpers/document-library";
import {setTestLocale} from "./helpers/auth";
import {clean} from "./helpers/document-explorer";

test.use({video:"off"});
/** 双击真实上传资料；预览读取浏览器中的内容，普通下载逐字节核对实际文件。 */
test("资源管理器：PDF、图片实际预览，普通文件双击下载及英文刷新",async({page})=>{
 test.setTimeout(120000);const prefix=`explorer-preview-${Date.now()}-`;const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));await documentLogin(page,"administrator");
 try{
  await page.goto("/admin/documents?scope=folder");await uploadDocumentFiles(page,[`${prefix}pdf.pdf`],documentPdf(),"application/pdf");const pdf=(await authoritativeFiles([`${prefix}pdf.pdf`]))[0];await page.locator(`[data-document-file="${pdf.id}"]`).dblclick();await expect(page.getByRole("dialog").locator("iframe")).toHaveAttribute("src",`/api/document-library/files/${pdf.id}/content?preview=1`);
  await expect.poll(async()=>{for(const frame of page.frames()){const viewer=frame.locator("pdf-viewer");if(await viewer.count())return viewer.evaluate(e=>Reflect.get(e,"initialLoadComplete_")===true).catch(()=>false);}return false;},{timeout:15000}).toBe(true);await page.screenshot({path:"output/document-explorer-pdf.png",fullPage:true});await page.getByRole("dialog").getByRole("button",{name:"取消",exact:true}).click();
  const image=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aAtIAAAAASUVORK5CYII=","base64");await uploadDocumentFiles(page,[`${prefix}image.png`],image,"image/png");const photo=(await authoritativeFiles([`${prefix}image.png`]))[0];await page.locator(`[data-document-file="${photo.id}"]`).dblclick();await expect.poll(()=>page.frameLocator("iframe").locator("img").evaluate(e=>(e as HTMLImageElement).naturalWidth)).toBe(1);await page.getByRole("dialog").getByRole("button",{name:"取消",exact:true}).click();
  const bytes=Buffer.from("普通下载真实字节");await uploadDocumentFiles(page,[`${prefix}text.txt`],bytes);const file=(await authoritativeFiles([`${prefix}text.txt`]))[0];const downloading=page.waitForEvent("download");await page.locator(`[data-document-file="${file.id}"]`).dblclick();const download=await downloading;expect(readFileSync((await download.path())!)).toEqual(bytes);
  // 特殊文件名仍须真实进入 ZIP；解压回调读取条目名，避免测试字典的原型影响计数。
  const row=page.locator(`[data-document-file="${file.id}"]`);await row.click();await row.press("F2");await page.getByRole("dialog").getByRole("textbox").fill("__proto__");await page.getByRole("dialog").getByRole("button",{name:"确认",exact:true}).click();await expect(page.getByRole("dialog")).toHaveCount(0);
  const renamed=await documentAdmin().from("document_files").select("name,version").eq("id",file.id).single();expect(renamed.data).toEqual({name:"__proto__",version:file.version+1});
  await row.click();await page.getByRole("button",{name:"下载",exact:true}).click();const zipped=page.waitForEvent("download");await page.getByRole("dialog").getByRole("button",{name:"确认",exact:true}).click();const zip=await zipped;const names:string[]=[];const entries=unzipSync(readFileSync((await zip.path())!),{filter:entry=>{names.push(entry.name);return true;}});expect(names).toEqual(["__proto__"]);expect(Buffer.from(entries["__proto__"])).toEqual(bytes);
  await setTestLocale(page,"en");await page.reload();await expect(page.getByRole("heading",{name:"Documents",exact:true})).toBeVisible();await expect(page.locator(`[data-document-file="${file.id}"]`)).toBeVisible();await expect(page.locator("nextjs-portal [data-nextjs-dialog-overlay]")).toHaveCount(0);expect(errors).toEqual([]);
 }finally{await clean(prefix);}
});
