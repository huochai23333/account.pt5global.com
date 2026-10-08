import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { authoritativeFiles, cleanupDocuments, documentAdmin, documentLogin, documentReader, documentUser, readLibrary, uploadDocumentFiles } from "./helpers/document-library";

test("24小时未完成上传和删除用真实对象清理，保留失败凭证并保护已完成文件", async ({ page }) => {
  test.setTimeout(90_000); const prefix = `docs-cleanup-${Date.now()}-`; const admin = documentAdmin();
  try {
    await documentLogin(page, "administrator"); await page.goto("/admin/documents");
    await uploadDocumentFiles(page, [`${prefix}保留.txt`, `${prefix}删除.txt`]);
    const ready = await authoritativeFiles([`${prefix}保留.txt`, `${prefix}删除.txt`]);
    const client = await documentReader("administrator"), folder = (await readLibrary(page)).folderId, actor = await documentUser("administrator");
    const uploadOp = randomUUID(), deleteOp = randomUUID(); const bytes = Buffer.from("中断上传");
    // 页面已验证正常上传；这里准备后台处理会遇到的中断阶段，不能把夹具准备计为页面操作通过。
    const reservation = await client.rpc("document_library_command", { p_operation: uploadOp, p_action: "reserve_upload", p_payload: { folderId: folder, name: `${prefix}中断.txt`, size: bytes.length, mime: "text/plain", sha256: createHash("sha256").update(bytes).digest("hex") } });
    expect(reservation.error).toBeNull(); const pending = reservation.data.record;
    expect((await client.storage.from("document-library").upload(pending.storage_path, bytes, { contentType: "text/plain" })).error).toBeNull();
    const deleting = ready.find((file) => file.name.endsWith("删除.txt"))!;
    expect((await client.rpc("document_library_command", { p_operation: deleteOp, p_action: "delete_file", p_payload: { fileId: deleting.id, version: deleting.version } })).error).toBeNull();
    const old = new Date(Date.now() - 25 * 3600_000).toISOString();
    expect((await admin.from("document_files").update({ updated_at: old }).in("id", [pending.id, ...ready.map((file) => file.id)])).error).toBeNull();
    const result = JSON.parse(execFileSync(process.execPath, ["--experimental-strip-types", "scripts/document-cleanup-local.mjs"], { encoding: "utf8" }));
    expect(result.status).toBe("succeeded"); expect(result.completed).toEqual(expect.arrayContaining([pending.id, deleting.id]));
    for (const file of [pending, deleting]) {
      expect((await admin.from("document_files").select("id").eq("id", file.id)).data).toHaveLength(0);
      expect((await admin.storage.from("document-library").exists(file.storage_path)).data).toBe(false);
    }
    const operations = await admin.from("document_operations").select("id,actor_id,receipt").in("id", [uploadOp, deleteOp]);
    const upload = operations.data!.find((item) => item.id === uploadOp)!, deletion = operations.data!.find((item) => item.id === deleteOp)!;
    expect(upload.actor_id).toBe(actor); expect(upload.receipt.status).toBe("failed"); expect(upload.receipt.affectedCount).toBe(0);
    expect(deletion.receipt.status).toBe("succeeded"); expect(deletion.receipt.affectedCount).toBe(1);
    expect(await authoritativeFiles([`${prefix}保留.txt`])).toHaveLength(1);
    await page.reload(); await expect(page.getByText(`${prefix}保留.txt`, { exact: true })).toBeVisible(); await expect(page.locator(`[data-document-file="${deleting.id}"]`)).toHaveCount(0);
  } finally { await cleanupDocuments(prefix); }
});
