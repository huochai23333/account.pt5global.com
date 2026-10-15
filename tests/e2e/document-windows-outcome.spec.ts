import {test,expect} from "@playwright/test";
import {documentAdmin,documentLogin,readLibrary} from "./helpers/document-library";
import {createFolder,clean} from "./helpers/document-explorer";
import {runLocalSupabaseSql} from "./helpers/local-supabase";
// DOCUMENT_TEST_WRONG_NAME=1 时让真实数据库存错名称；独立断言必须失败，正常运行必须通过。
test.use({video:"off"});
test("目录名称的独立权威核对能够识别真实存错结果",async({page})=>{
 test.setTimeout(90000);const prefix=`windows-outcome-${Date.now()}-`;const fault=process.env.DOCUMENT_TEST_WRONG_NAME==="1";
 const drop="drop trigger if exists document_test_wrong_name on public.document_folders;drop function if exists document_private.document_test_wrong_name();";
 try{
  await documentLogin(page,"administrator");await page.goto("/admin/documents?scope=folder");const created=await createFolder(page,prefix+"original");await page.locator(`[data-explorer-item="${created.id}"]`).click();await page.keyboard.press("F2");
  if(fault)runLocalSupabaseSql(`${drop} create function document_private.document_test_wrong_name() returns trigger language plpgsql as $$begin if new.id='${created.id}' and new.name='${prefix}expected' then new.name:='${prefix}wrong';end if;return new;end$$;revoke all on function document_private.document_test_wrong_name() from public,anon,authenticated;create trigger document_test_wrong_name before update on public.document_folders for each row execute function document_private.document_test_wrong_name();`);
  await page.locator('[data-inline-name]').fill(prefix+"expected");await page.locator('[data-inline-name]').press("Enter");
  if(fault){await expect(page.locator('[data-document-result="failed"]')).toBeVisible();await expect(page.locator('[data-document-result="succeeded"]')).toHaveCount(0);}else await expect(page.locator('[data-inline-name]')).toHaveCount(0);
  const actual=await documentAdmin().from("document_folders").select("id,name,version,parent_id").eq("id",created.id).single();expect(actual.error).toBeNull();expect(actual.data!.name).toBe(prefix+"expected");expect(actual.data!.version).toBe(created.version+1);expect(actual.data!.parent_id).toBe((await readLibrary(page)).folderId);await page.reload();await expect(page.locator(`[data-explorer-item="${created.id}"]`)).toContainText(prefix+"expected");
 }finally{runLocalSupabaseSql(drop);await clean(prefix);}
});
