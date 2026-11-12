import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { authoritativeFiles, chooseDocumentFolder, cleanupDocuments, documentAdmin, documentLogin, readLibrary, uploadDocumentFiles } from "./helpers/document-library";
import { requireDocumentFixtureDatabase, runDocumentFixtureSql } from "./helpers/document-write-lock";
import { cleanupFixtureResources } from "../test-support/fixture-cleanup-sequence";
/** 客户表禁止服务密钥直接删除；只在专属库按本次完整前缀比较影响编号，再独立核对零行。 */
function clearFixtureCustomers(prefix: string) {
    if (!/^docs-link-\d{13}-$/.test(prefix))
        throw new Error("fixture_scope_required");
    const expected = JSON.parse(runDocumentFixtureSql(`select coalesce(json_agg(id order by id),'[]') from public.wholesale_customers where unique_name like '${prefix}%';`));
    const removed = JSON.parse(runDocumentFixtureSql(`with removed as(delete from public.wholesale_customers where unique_name like '${prefix}%' returning id) select coalesce(json_agg(id order by id),'[]') from removed;`));
    expect(removed).toEqual(expected);
    expect(runDocumentFixtureSql(`select count(*) from public.wholesale_customers where unique_name like '${prefix}%';`).trim()).toBe("0");
}
test.use({ video: "off" });
test("未注册客户资料在页面关联账号后合并，文件保留且阻止删除有资料的客户", async ({ page }) => {
    test.setTimeout(150000);
    requireDocumentFixtureDatabase();
    const prefix = `docs-link-${Date.now()}-`;
    const admin = documentAdmin();
    let userId: string | undefined, customerId: string | undefined;
    try {
        const created = await admin.auth.admin.createUser({ email: `${prefix}${randomUUID()}@example.test`, email_confirm: true, app_metadata: { role: "client", status: "active" }, user_metadata: { name: `${prefix}注册客户`, business_board: "wholesale" } });
        expect(created.error).toBeNull();
        userId = created.data.user!.id;
        // 注册触发器可能已建立批发档案；只清理本测试账号的空档案，保留注册账号资料夹。
        clearFixtureCustomers(prefix);
        await documentLogin(page, "administrator");
        await page.goto(`/admin/documents?user=${userId}&scope=folder`);
        const registeredRoot = (await readLibrary(page)).folderId!;
        await chooseDocumentFolder(page, registeredRoot);
        await uploadDocumentFiles(page, [`${prefix}同名.txt`]);
        const registeredArchive = (await readLibrary(page)).archiveId;
        await page.goto("/admin/wholesale/customers");
        await page.getByRole("button", { name: "新增客户" }).click();
        let dialog = page.getByRole("dialog", { name: "新增批发客户" });
        await dialog.getByLabel("客户唯一标识名称").fill(`${prefix}未注册`);
        await dialog.getByRole("button", { name: "保存客户", exact: true }).click();
        await expect(dialog).toHaveCount(0);
        const customer = await admin.from("wholesale_customers").select("id,registered_user_id").eq("unique_name", `${prefix}未注册`).single();
        expect(customer.error).toBeNull();
        expect(customer.data!.registered_user_id).toBeNull();
        customerId = customer.data!.id;
        await page.getByRole("button", { name: `${prefix}未注册`, exact: true }).click();
        dialog = page.getByRole("dialog", { name: `${prefix}未注册` });
        const link = dialog.getByRole("link", { name: "查看资料", exact: true });
        await expect(link).toHaveAttribute("href", `/admin/documents?customer=${customerId}`);
        await link.click();
        const unregisteredRoot = (await readLibrary(page)).folderId!;
        await chooseDocumentFolder(page, unregisteredRoot);
        await uploadDocumentFiles(page, [`${prefix}同名.txt`]);
        const before = await authoritativeFiles([`${prefix}同名.txt`]);
        expect(before).toHaveLength(2);
        const paths = before.map((file) => file.storage_path).sort();
        await page.goto("/admin/wholesale/customers");
        await page.getByRole("button", { name: `${prefix}未注册`, exact: true }).click();
        dialog = page.getByRole("dialog", { name: `${prefix}未注册` });
        await dialog.getByRole("button", { name: "删除客户", exact: true }).click();
        const deletion = page.getByRole("dialog", { name: "删除批发客户" });
        await deletion.getByRole("button", { name: "确认删除", exact: true }).click();
        await expect(page.getByText("这个客户还有资料文件，请先处理资料，再删除客户档案。", { exact: true })).toBeVisible();
        await deletion.getByRole("button", { name: "先不删除", exact: true }).click();
        await dialog.getByRole("combobox", { name: "选择客户注册账号" }).click();
        await page.getByRole("option", { name: new RegExp(`${prefix}注册客户`) }).click();
        await dialog.getByRole("button", { name: "合并账号", exact: true }).click();
        await expect(dialog.getByText("关联注册账号", { exact: true })).toBeVisible();
        await expect.poll(async () => (await admin.from("wholesale_customers").select("registered_user_id").eq("id", customerId).single()).data?.registered_user_id).toBe(userId);
        const archives = await admin.from("document_archives").select("id,user_id,customer_id").eq("customer_id", customerId);
        expect(archives.data).toHaveLength(1);
        expect(archives.data![0].id).toBe(registeredArchive);
        const files = await admin.from("document_files").select("id,name,storage_path,folder_id").like("original_name", `${prefix}%`);
        expect(files.data).toHaveLength(2);
        expect(new Set(files.data!.map((file) => file.name)).size).toBe(2);
        expect(files.data!.every((file) => file.name.endsWith(".txt"))).toBe(true);
        expect(files.data!.map((file) => file.storage_path).sort()).toEqual(paths);
        await page.goto(`/admin/documents?user=${userId}&scope=folder`);
        await chooseDocumentFolder(page, registeredRoot);
        await page.reload();
        await expect(page.locator('[data-document-file]')).toHaveCount(2);
        // 当前统一迁移后只保留一个personal根；再次初始化不能恢复旧的共享/内部默认区域。
        // 角色表也刻意禁用服务密钥直写；只重复本测试账号已有角色，不改动业务授权。
        if (!/^[a-f0-9-]{36}$/.test(userId!))
            throw new Error("fixture_scope_required");
        runDocumentFixtureSql(`update public.user_roles_data set role_id=role_id where user_id='${userId}';`);
        const defaultFolders = await admin.from("document_folders").select("id,name,system_key").eq("archive_id", registeredArchive).not("system_key", "is", null);
        expect(defaultFolders.error).toBeNull();
        expect(defaultFolders.data).toEqual([expect.objectContaining({ name: "资料文件夹", system_key: "personal" })]);
    }
    finally {
        await cleanupFixtureResources(
            () => cleanupDocuments(prefix),
            async () => { clearFixtureCustomers(prefix); },
            async () => {
                if (!userId) return;
                expect((await admin.auth.admin.deleteUser(userId)).error).toBeNull();
                expect(runDocumentFixtureSql(`select count(*) from auth.users where id='${userId}'::uuid;`).trim()).toBe("0");
            },
        );
    }
});
