import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { authoritativeFiles, chooseDocumentFolder, cleanupDocuments, documentAdmin, documentLogin, readLibrary, uploadDocumentFiles } from "./helpers/document-library";

/** 客户表刻意禁止直接通过服务密钥删除；本地夹具用 Docker SQL 清理自己的随机名称。 */
function clearFixtureCustomers(prefix: string) {
  if (!/^docs-link-\d+-$/.test(prefix)) throw new Error("fixture_scope_required");
  execFileSync("docker", ["exec", "-i", "supabase_db_pt5-dropshipping", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"], { input: `delete from public.wholesale_customers where unique_name like '${prefix}%';`, stdio: ["pipe", "pipe", "pipe"] });
}

test.use({video:"off"});

test("未注册客户资料在页面关联账号后合并，文件保留且阻止删除有资料的客户", async ({ page }) => {
  test.setTimeout(150_000); const prefix = `docs-link-${Date.now()}-`; const admin = documentAdmin();
  let userId: string | undefined, customerId: string | undefined;
  try {
    const created = await admin.auth.admin.createUser({ email: `${prefix}${randomUUID()}@example.test`, email_confirm: true, app_metadata: { role: "client", status: "active" }, user_metadata: { name: `${prefix}注册客户`, business_board: "wholesale" } });
    expect(created.error).toBeNull(); userId = created.data.user!.id;
    // 注册触发器可能已建立批发档案；只清理本测试账号的空档案，保留注册账号资料夹。
    clearFixtureCustomers(prefix);
    await documentLogin(page, "administrator"); await page.goto(`/admin/documents?user=${userId}&scope=folder`); await chooseDocumentFolder(page, "共享资料"); await uploadDocumentFiles(page, [`${prefix}同名.txt`]);
    const registeredArchive = (await readLibrary(page)).archiveId;
    await page.goto("/admin/wholesale/customers"); await page.getByRole("button", { name: "新增客户" }).click();
    let dialog = page.getByRole("dialog", { name: "新增批发客户" }); await dialog.getByLabel("客户唯一标识名称").fill(`${prefix}未注册`); await dialog.getByRole("button", { name: "保存客户", exact: true }).click(); await expect(dialog).toHaveCount(0);
    const customer = await admin.from("wholesale_customers").select("id,registered_user_id").eq("unique_name", `${prefix}未注册`).single(); expect(customer.error).toBeNull(); expect(customer.data!.registered_user_id).toBeNull(); customerId = customer.data!.id;
    await page.getByRole("button", { name: `${prefix}未注册`, exact: true }).click(); dialog = page.getByRole("dialog", { name: `${prefix}未注册` });
    const link = dialog.getByRole("link", { name: "查看资料", exact: true }); await expect(link).toHaveAttribute("href", `/admin/documents?customer=${customerId}`); await link.click();
    await chooseDocumentFolder(page, "共享资料"); await uploadDocumentFiles(page, [`${prefix}同名.txt`]);
    const before = await authoritativeFiles([`${prefix}同名.txt`]); expect(before).toHaveLength(2); const paths = before.map((file) => file.storage_path).sort();
    await page.goto("/admin/wholesale/customers"); await page.getByRole("button", { name: `${prefix}未注册`, exact: true }).click(); dialog = page.getByRole("dialog", { name: `${prefix}未注册` });
    await dialog.getByRole("button", { name: "删除客户", exact: true }).click(); const deletion = page.getByRole("dialog", { name: "删除批发客户" }); await deletion.getByRole("button", { name: "确认删除", exact: true }).click(); await expect(page.getByText("这个客户还有资料文件，请先处理资料，再删除客户档案。", { exact: true })).toBeVisible();
    await deletion.getByRole("button", { name: "先不删除", exact: true }).click();
    await dialog.getByRole("combobox", { name: "选择客户注册账号" }).click(); await page.getByRole("option", { name: new RegExp(`${prefix}注册客户`) }).click(); await dialog.getByRole("button", { name: "合并账号", exact: true }).click(); await expect(dialog.getByText("关联注册账号", { exact: true })).toBeVisible();
    await expect.poll(async () => (await admin.from("wholesale_customers").select("registered_user_id").eq("id", customerId).single()).data?.registered_user_id).toBe(userId);
    const archives = await admin.from("document_archives").select("id,user_id,customer_id").eq("customer_id", customerId); expect(archives.data).toHaveLength(1); expect(archives.data![0].id).toBe(registeredArchive);
    const files = await admin.from("document_files").select("id,name,storage_path,folder_id").like("original_name", `${prefix}%`); expect(files.data).toHaveLength(2); expect(new Set(files.data!.map((file) => file.name)).size).toBe(2); expect(files.data!.every((file) => file.name.endsWith(".txt"))).toBe(true); expect(files.data!.map((file) => file.storage_path).sort()).toEqual(paths);
    await page.goto(`/admin/documents?user=${userId}&scope=folder`); await chooseDocumentFolder(page, "共享资料"); await page.reload(); await expect(page.locator('[data-document-file]')).toHaveCount(2);
    // 默认目录初始化再次触发，仍保持唯一档案和两个默认区域。
    // 角色表也刻意禁用服务密钥直写；只重复本测试账号已有角色，不改动业务授权。
    if (!/^[a-f0-9-]{36}$/.test(userId!)) throw new Error("fixture_scope_required");
    execFileSync("docker", ["exec", "-i", "supabase_db_pt5-dropshipping", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"], { input: `update public.user_roles_data set role_id=role_id where user_id='${userId}';`, stdio: ["pipe", "pipe", "pipe"] });
    expect((await admin.from("document_folders").select("id").eq("archive_id", registeredArchive).not("system_key", "is", null)).data).toHaveLength(2);
  } finally {
    await cleanupDocuments(prefix);
    clearFixtureCustomers(prefix);
    if (userId) expect((await admin.auth.admin.deleteUser(userId)).error).toBeNull();
  }
});
