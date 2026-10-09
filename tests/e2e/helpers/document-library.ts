import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { appendFileSync } from "node:fs";
import { getRegressionAccount, type RegressionRole } from "./accounts";
import { getLocalSupabaseAdminClient, readLocalEnvValue } from "./local-supabase-admin";
import type { DocumentFile, ExplorerLibrary } from "@/lib/document-library/model";
import { loginAs } from "./auth";

/** 测试只允许连接本地 Docker，清理只按本次随机前缀和实际记录编号执行。 */
export function documentAdmin() { const admin = getLocalSupabaseAdminClient(); if (!admin) throw new Error("local_supabase_required"); return admin; }
export async function documentLogin(page: Page, role: RegressionRole) {
  // 同一浏览器切换角色必须先清除认证 Cookie，登录页否则会把旧身份送回原工作台。
  await page.context().clearCookies(); await loginAs(page, role);
}
export async function documentUser(role: RegressionRole) {
  const result = await documentAdmin().from("user_profiles").select("user_id").eq("email", getRegressionAccount(role).email).single();
  if (result.error) throw result.error; return result.data.user_id as string;
}
export async function documentReader(role: RegressionRole) {
  const url = readLocalEnvValue("NEXT_PUBLIC_SUPABASE_URL")!;
  if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(url)) throw new Error("local_supabase_required");
  const client = createClient(url, readLocalEnvValue("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ?? readLocalEnvValue("NEXT_PUBLIC_SUPABASE_ANON_KEY")!, { auth: { persistSession: false } });
  const account = getRegressionAccount(role);
  const result = await client.auth.signInWithPassword({ email: account.email, password: account.password });
  if (result.error) throw new Error("local_test_login_failed"); return client;
}
export async function readLibrary(page: Page): Promise<ExplorerLibrary> {
  const response = await page.request.get(`/api/document-library${new URL(page.url()).search}`);
  expect(response.ok()).toBe(true); return response.json();
}
export async function chooseDocumentFolder(page: Page, name: string) {
  // 详情页链接采用客户端导航；等网址和真实页面出现后才读取当前档案，避免误读上一页。
  await expect(page).toHaveURL(/\/documents(?:[/?#]|$)/);
  await expect(page.getByRole("heading",{name:"资料库",exact:true})).toBeVisible();
  // 桌面直接使用目录树；窄屏从路径回到档案，再逐级双击目录。
  const tree=page.getByRole("tree",{name:"资料文件夹"});
  if(await tree.isVisible())await tree.getByRole("button",{name,exact:true}).click();
  else {
    const data=await readLibrary(page);const folder=data.folders.find(item=>item.name===name||item.system_key&&(name==="本人资料"?item.zone==="personal":name==="共享资料"?item.zone==="shared":item.zone.endsWith("internal")));expect(folder).toBeTruthy();
    const archive=data.archives.find(item=>item.id===folder!.archive_id)!;
    await page.getByRole("navigation",{name:"当前位置"}).getByRole("button",{name:archive.name,exact:true}).click();
    const parents=[folder!];let current=folder!;while(current.parent_id){current=data.folders.find(item=>item.id===current.parent_id)!;parents.unshift(current);}
    for(const parent of parents)await page.locator(`[data-explorer-item="${parent.id}"]`).dblclick();
  }
  await expect(page.getByRole("button",{name:"上传资料",exact:true})).toBeEnabled();
  const data=await readLibrary(page);const current=data.folders.find(item=>item.id===data.folderId);expect(current?.name===name||Boolean(current?.system_key)).toBe(true);
}
export async function uploadDocumentFiles(page: Page, names: string[], buffer = Buffer.from("真实资料\n", "utf8"), mime = "text/plain") {
  await page.locator('input[type="file"]').setInputFiles(names.map((name) => ({ name, mimeType: mime, buffer })));
  await expect(page.locator('[data-document-result="succeeded"]')).toBeVisible({ timeout: 30_000 });
}
export async function authoritativeFiles(names: string[]) {
  const result = await documentAdmin().from("document_files").select("*").in("name", names);
  expect(result.error).toBeNull();
  // 只记录测试夹具的安全业务凭证；密钥、认证会话与实际文件正文不进入交付记录。
  appendFileSync("output/document-library-business-receipts.jsonl", JSON.stringify({ checkedAt: new Date().toISOString(), names, files: result.data?.map((file) => ({ id: file.id, version: file.version, folderId: file.folder_id, path: file.storage_path, size: file.size_bytes, status: file.status })) }) + "\n");
  return result.data as DocumentFile[];
}
export async function confirmFileObjects(files: DocumentFile[]) {
  for (const file of files) {
    expect(file.status).toBe("ready"); expect(file.version).toBeGreaterThan(1);
    const object = await documentAdmin().storage.from("document-library").download(file.storage_path);
    expect(object.error).toBeNull(); expect(object.data?.size).toBe(file.size_bytes);
  }
}
export async function cleanupDocuments(prefix: string) {
  const admin = documentAdmin();
  // 批次会保护未完成目录；仅释放本次命名前缀的批次后，才清理自己的文件夹。
  const batches=await admin.from("document_batches").select("id,manifest");
  const owned=(batches.data??[]).filter(batch=>batch.manifest.some((entry:{record:{name:string}})=>entry.record.name.startsWith(prefix)));
  if(owned.length){const reader=await documentReader("administrator");for(const batch of owned)await reader.rpc("document_batch_release",{p_id:batch.id});}
  const files = await admin.from("document_files").select("id,storage_path").like("original_name", `${prefix}%`);
  if (files.error) throw files.error;
  for (const file of files.data ?? []) {
    const removed = await admin.storage.from("document-library").remove([file.storage_path]);
    if (removed.error) throw removed.error;
    const deletion = await admin.from("document_files").delete().eq("id", file.id); if (deletion.error) throw deletion.error;
  }
  // 子目录从叶子开始清理，默认目录和其他人的文件均保留。
  for (let count = 0; count < 20; count++) {
    const folders = await admin.from("document_folders").select("id").like("name", `${prefix}%`).is("system_key", null);
    if (!folders.data?.length) break;
    for (const folder of folders.data) await admin.from("document_folders").delete().eq("id", folder.id);
  }
  const ops = await admin.from("document_operations").select("id,payload,receipt");
  // 删除操作只携带文件编号；即使记录已删除，也须按原凭证中的测试前缀清理，不能影响下一用例。
  const ids = ops.data?.filter((operation) => [operation.payload?.name,operation.receipt?.record?.name,operation.receipt?.record?.original_name].some(name=>typeof name==="string"&&name.startsWith(prefix))).map((operation) => operation.id) ?? [];
  if (ids.length) await admin.from("document_operations").delete().in("id", ids);
  if(owned.length)await admin.from("document_batches").delete().in("id",owned.map(batch=>batch.id));
}
export async function checkDocumentViewport(page: Page, width: number, name: string) {
  await page.setViewportSize({ width, height: 900 });
  await expect(page.getByRole("heading", { name: "资料库", exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  // 开发工具按钮也位于 nextjs-portal；只把真正的错误覆盖层视为失败。
  await expect(page.locator("nextjs-portal [data-nextjs-dialog-overlay]")).toHaveCount(0);
  await page.screenshot({ path: `output/documents-${name}-${width}.png`, fullPage: true });
}
export function documentPdf() {
  const stream = "BT /F1 12 Tf 15 150 Td (Document verification) Tj ET\n";
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>", `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  let content = "%PDF-1.4\n"; const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(content)); content += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const start = Buffer.byteLength(content);
  content += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((offset) => String(offset).padStart(10, "0") + " 00000 n \n").join("")}trailer\n<< /Root 1 0 R /Size 6 >>\nstartxref\n${start}\n%%EOF`;
  return Buffer.from(content);
}
