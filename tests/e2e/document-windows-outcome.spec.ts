import { randomUUID } from "node:crypto";
import { cleanupFixtureResources } from "../test-support/fixture-cleanup-sequence";
import { test, expect } from "@playwright/test";
import { documentAdmin, documentLogin, readLibrary } from "./helpers/document-library";
import { createFolder, clean } from "./helpers/document-explorer";
import { runLocalSupabaseSql } from "./helpers/local-supabase";
// DOCUMENT_TEST_WRONG_NAME=1 时让真实数据库存错名称；独立断言必须失败，正常运行必须通过。
import { requireDisposableFixture } from "../test-support/disposable-fixture";

// 固定账号、全局故障或过期清理只能在实际可重建的专属完整实例执行。
test.beforeAll(() => requireDisposableFixture({
  baseURL: process.env.PLAYWRIGHT_BASE_URL,
  supabaseURL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  mode: process.env.PT5_E2E_FIXTURE_MODE,
}));

test.use({ video: "off" });
test("目录名称的独立权威核对能够识别真实存错结果", async ({ page }) => {
    test.setTimeout(90000);
    const prefix = `windows-outcome-${Date.now()}-`;
    const fault = process.env.DOCUMENT_TEST_WRONG_NAME === "1";
    // 每次运行使用独立 SQL 对象名；未启用故障时不创建或删除任何触发器。
    const fixtureName = `document_test_wrong_${randomUUID().replaceAll("-", "")}`;
    const drop = `drop trigger if exists ${fixtureName} on public.document_folders;drop function if exists document_private.${fixtureName}();`;
    try {
        await documentLogin(page, "administrator");
        await page.goto("/admin/documents?scope=folder");
        const created = await createFolder(page, prefix + "original");
        await page.locator(`[data-explorer-item="${created.id}"]`).click();
        await page.keyboard.press("F2");
        if (fault) {
            // 创建函数与触发器同事务完成；随机名称仅由本地 UUID 构造，不接收页面输入。
            runLocalSupabaseSql(`begin;
              create function document_private.${fixtureName}() returns trigger language plpgsql as $$
              begin
                if new.id='${created.id}' and new.name='${prefix}expected' then
                  new.name:='${prefix}wrong';
                end if;
                return new;
              end$$;
              revoke all on function document_private.${fixtureName}() from public,anon,authenticated;
              create trigger ${fixtureName} before update on public.document_folders
                for each row execute function document_private.${fixtureName}();
              commit;`);
        }
        await page.locator('[data-inline-name]').fill(prefix + "expected");
        await page.locator('[data-inline-name]').press("Enter");
        if (fault) {
            await expect(page.locator('[data-document-result="failed"]')).toBeVisible();
            await expect(page.locator('[data-document-result="succeeded"]')).toHaveCount(0);
        }
        else
            await expect(page.locator('[data-inline-name]')).toHaveCount(0);
        const actual = await documentAdmin().from("document_folders").select("id,name,version,parent_id").eq("id", created.id).single();
        expect(actual.error).toBeNull();
        expect(actual.data!.name).toBe(prefix + "expected");
        expect(actual.data!.version).toBe(created.version + 1);
        expect(actual.data!.parent_id).toBe((await readLibrary(page)).folderId);
        await page.reload();
        await expect(page.locator(`[data-explorer-item="${created.id}"]`)).toContainText(prefix + "expected");
    }
    finally {
        await cleanupFixtureResources(
            async () => { if (fault) runLocalSupabaseSql(drop); },
            () => clean(prefix),
        );
    }
});
