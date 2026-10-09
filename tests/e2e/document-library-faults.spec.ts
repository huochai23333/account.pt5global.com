import {openItemMenu} from "./helpers/document-explorer";
import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { authoritativeFiles, cleanupDocuments, documentAdmin, documentLogin, uploadDocumentFiles } from "./helpers/document-library";
import { runLocalSupabaseSql } from "./helpers/local-supabase";

test.use({video:"off"});

test("真实登记失败与对象清理失败保留凭证，后台重试后可重新上传", async ({ page }) => {
  test.setTimeout(120_000); const prefix = `docs-fault-${Date.now()}-`; const admin = documentAdmin();
  const drop = `drop trigger if exists document_test_registration on public.document_files; drop trigger if exists document_test_removal on storage.objects; drop function if exists document_private.document_test_registration(); drop function if exists document_private.document_test_removal();`;
  try {
    // 故障只针对本次随机前缀，仅注入本地 Docker；真实页面、数据库和 Storage 都参与验证。
    runLocalSupabaseSql(`${drop}
      create function document_private.document_test_registration() returns trigger language plpgsql as $$begin if new.original_name like '${prefix}%' and new.status='ready' then raise exception 'local_registration_fault'; end if; return new; end$$;
      create trigger document_test_registration before update on public.document_files for each row execute function document_private.document_test_registration();
      create function document_private.document_test_removal() returns trigger language plpgsql security definer set search_path='' as $$begin if old.bucket_id='document-library' and exists(select 1 from public.document_files where storage_path=old.name and original_name like '${prefix}%') then raise exception 'local_removal_fault'; end if; return old; end$$;
      revoke all on function document_private.document_test_registration(),document_private.document_test_removal() from public,anon,authenticated;
      create trigger document_test_removal before delete on storage.objects for each row execute function document_private.document_test_removal();`);
    await documentLogin(page, "administrator"); await page.goto("/admin/documents?scope=folder");
    await page.locator('input[type="file"]').setInputFiles({ name: `${prefix}恢复.txt`, mimeType: "text/plain", buffer: Buffer.from("失败后保留原对象") });
    await expect(page.locator('[data-document-upload-result="failed"]')).toBeVisible({ timeout: 45_000 });
    const files = await admin.from("document_files").select("*").eq("original_name", `${prefix}恢复.txt`); expect(files.data).toHaveLength(1); const file = files.data![0];
    expect(file.status).not.toBe("ready"); expect((await admin.storage.from("document-library").exists(file.storage_path)).data).toBe(true);
    const ops = await admin.from("document_operations").select("id,receipt").contains("payload", { name: `${prefix}恢复.txt` }); expect(ops.data).toHaveLength(1); const operationId = ops.data![0].id;
    expect(ops.data![0].receipt.status).toBe("partial_failed"); await page.reload(); await expect(page.locator(`[data-document-file="${file.id}"]`)).toHaveCount(0);
    const age = async () => { expect((await admin.from("document_files").update({ updated_at: new Date(Date.now() - 25 * 3600_000).toISOString() }).eq("id", file.id)).error).toBeNull(); };
    const run = () => JSON.parse(execFileSync(process.execPath, ["--env-file=.env.local", "--experimental-strip-types", "scripts/document-cleanup-local.mjs"], { encoding: "utf8" }));
    await age(); const blocked = run(); expect(blocked.status).toBe("failed"); expect(blocked.failed).toContain(file.id);
    expect((await admin.storage.from("document-library").exists(file.storage_path)).data).toBe(true);
    runLocalSupabaseSql(drop); await age(); expect(run().completed).toContain(file.id);
    expect((await admin.from("document_files").select("id").eq("id", file.id)).data).toHaveLength(0); expect((await admin.storage.from("document-library").exists(file.storage_path)).data).toBe(false);
    expect((await admin.from("document_operations").select("receipt").eq("id", operationId).single()).data!.receipt.status).toBe("failed");
    await page.reload(); await uploadDocumentFiles(page, [`${prefix}恢复.txt`]);
    const retried = await admin.from("document_files").select("id,status").eq("original_name", `${prefix}恢复.txt`).single(); expect(retried.data!.id).not.toBe(file.id); expect(retried.data!.status).toBe("ready");
  } finally { runLocalSupabaseSql(drop); await cleanupDocuments(prefix); }
});

test("对象删除后登记实际影响0行，页面保持部分完成并可继续原删除", async ({ page }) => {
  test.setTimeout(90_000); const prefix = `docs-zero-${Date.now()}-`; const admin = documentAdmin();
  const drop = "drop trigger if exists document_test_zero on public.document_files; drop function if exists document_private.document_test_zero();";
  try {
    await documentLogin(page, "administrator"); await page.goto("/admin/documents?scope=folder"); await uploadDocumentFiles(page, [`${prefix}零行.txt`]); const file = (await authoritativeFiles([`${prefix}零行.txt`]))[0];
    // 本地数据库触发器返回 NULL，模拟真实数据库拒绝删除，HTTP 请求仍可正常返回。
    runLocalSupabaseSql(`${drop} create function document_private.document_test_zero() returns trigger language plpgsql as $$begin if old.original_name like '${prefix}%' then return null; end if; return old; end$$; revoke all on function document_private.document_test_zero() from public,anon,authenticated; create trigger document_test_zero before delete on public.document_files for each row execute function document_private.document_test_zero();`);
    await openItemMenu(page, page.locator(`[data-document-file="${file.id}"]`), "删除"); const dialog = page.getByRole("dialog"); await page.getByRole("dialog").getByRole("checkbox",{name:/我确认永久删除/}).check(); await dialog.getByRole("button", { name: "确认", exact: true }).click(); await expect(dialog.getByRole("alert")).toBeVisible();const batch=(await admin.from("document_batches").select("id,status,manifest")).data!.find(item=>item.manifest.some((entry:{id:string})=>entry.id===file.id))!;expect(batch.status).toBe("partial_failed");
    expect((await admin.storage.from("document-library").exists(file.storage_path)).data).toBe(false); expect((await admin.from("document_files").select("status").eq("id", file.id).single()).data!.status).toBe("deleting");
    const op = await admin.from("document_operations").select("receipt").eq("action", "delete_file").contains("payload", { fileId: file.id }).single(); expect(op.data!.receipt.status).toBe("partial_failed"); expect(op.data!.receipt.affectedCount).toBe(0);
    runLocalSupabaseSql(drop); await dialog.getByRole("button", { name: "取消", exact: true }).click(); await page.reload(); await page.locator(`[data-document-batch="${batch.id}"]`).getByRole("button", { name: "继续核对", exact: true }).click(); await expect(page.locator(`[data-document-batch="${batch.id}"]`)).toHaveAttribute("data-batch-status","succeeded");
    expect((await admin.from("document_files").select("id").eq("id", file.id)).data).toHaveLength(0); await page.reload(); await expect(page.locator(`[data-document-file="${file.id}"]`)).toHaveCount(0);
  } finally { runLocalSupabaseSql(drop); await cleanupDocuments(prefix); }
});
