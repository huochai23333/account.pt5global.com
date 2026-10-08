import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleClient } from "@/lib/supabase-admin-server";
import { requireStorageUploadReceipt, removeStorageObjectsVerified } from "@/lib/storage-operation-receipts";
import { DOCUMENT_BUCKET, requireDocumentReceipt, type DocumentReceipt, type DocumentFile } from "./model";
import { inspectDocument } from "./file-policy";

async function finish(operationId: string, actor: string, success: boolean, cleanup = false) {
  const { data, error } = await getSupabaseServiceRoleClient().rpc("document_library_finish", {
    p_operation: operationId, p_actor: actor, p_success: success, p_cleanup: cleanup,
  });
  if (error) throw error;
  return requireDocumentReceipt(data, operationId, success);
}
export async function uploadDocument(supabase: SupabaseClient, actor: string, operationId: string, folderId: string, file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const inspection = inspectDocument(file.name, bytes);
  const { data, error } = await supabase.rpc("document_library_command", {
    p_operation: operationId, p_action: "reserve_upload", p_payload: { folderId, name: file.name, size: file.size, ...inspection },
  });
  if (error) throw error;
  const receipt = requireDocumentReceipt(data, operationId, false);
  if (receipt.status === "succeeded") return requireDocumentReceipt(receipt, operationId);
  if (receipt.status === "failed") throw new Error("conflict");
  const record = receipt.record as DocumentFile;
  const bucket = supabase.storage.from(DOCUMENT_BUCKET);
  try {
    // 同一操作断线重试时只复用原对象，绝不覆盖别人或重新生成文件编号。
    const exists = await bucket.exists(record.storage_path);
    if (exists.error && exists.data !== false) throw exists.error;
    if (!exists.data) {
      const { data: uploadReceipt, error: uploadError } = await supabase.storage.from(DOCUMENT_BUCKET).upload(record.storage_path, bytes, { contentType: inspection.mime, upsert: false });
      if (uploadError) {
        // 同一操作并发重送时，另一请求可能已经写入对象；先独立核对，不能清掉对方正在完成的文件。
        const present = await bucket.exists(record.storage_path);
        if (present.data !== true || present.error) throw uploadError;
      } else requireStorageUploadReceipt(uploadReceipt, record.storage_path, "unconfirmed");
    }
    const actual = await bucket.download(record.storage_path);
    if (actual.error || !actual.data || actual.data.size !== record.size_bytes) throw actual.error ?? new Error("unconfirmed");
    const actualInspection = inspectDocument(file.name, new Uint8Array(await actual.data.arrayBuffer()));
    if (actualInspection.sha256 !== record.sha256) throw new Error("unconfirmed");
    return await finish(operationId, actor, true);
  } catch {
    let cleaned = false;
    try {
      const existence = await bucket.exists(record.storage_path);
      if (existence.data === true && !existence.error) await removeStorageObjectsVerified(supabase, DOCUMENT_BUCKET, [record.storage_path], { confirmationMessage: "unconfirmed", timeoutMessage: "unconfirmed" });
      const missing = await bucket.exists(record.storage_path);
      cleaned = missing.data === false && (!missing.error || [400, 404].includes(Number((missing.error as { status?: number }).status)));
    } catch { /* 清理结果不明时保留原凭证，下一次核对或定时清理继续处理。 */ }
    return await finish(operationId, actor, false, cleaned);
  }
}
export async function completeDocumentDelete(supabase: SupabaseClient, actor: string, receipt: DocumentReceipt) {
  if (receipt.status === "succeeded") return requireDocumentReceipt(receipt, receipt.operationId);
  const file = receipt.record as DocumentFile;
  try {
    const bucket = supabase.storage.from(DOCUMENT_BUCKET);
    const exists = await bucket.exists(file.storage_path);
    if (exists.data === true && !exists.error) await removeStorageObjectsVerified(supabase, DOCUMENT_BUCKET, [file.storage_path], { confirmationMessage: "unconfirmed", timeoutMessage: "unconfirmed" });
    else if (exists.data !== false || (exists.error && ![400, 404].includes(Number((exists.error as { status?: number }).status)))) throw new Error("unconfirmed");
    return await finish(receipt.operationId, actor, true);
  } catch { return await finish(receipt.operationId, actor, false); }
}

/** 原上传中断后重新读取真实字节，再完成原登记；不存在对象时保留待处理状态。 */
export async function reconcileDocument(supabase: SupabaseClient, actor: string, operationId: string) {
  const result = await supabase.from("document_operations").select("receipt").eq("id", operationId).eq("actor_id", actor).maybeSingle();
  if (result.error || !result.data) throw new Error("forbidden");
  const receipt = requireDocumentReceipt(result.data.receipt, operationId, false);
  if (receipt.status === "succeeded") return requireDocumentReceipt(receipt, operationId);
  if (receipt.action === "delete_file") return completeDocumentDelete(supabase, actor, receipt);
  if (receipt.action !== "reserve_upload" || receipt.status === "failed") throw new Error("conflict");
  const file = receipt.record as DocumentFile;
  const content = await supabase.storage.from(DOCUMENT_BUCKET).download(file.storage_path);
  if (content.error || !content.data || content.data.size !== file.size_bytes) throw new Error("unconfirmed");
  const actual = inspectDocument(file.original_name, new Uint8Array(await content.data.arrayBuffer()));
  if (actual.sha256 !== file.sha256) throw new Error("unconfirmed");
  return finish(operationId, actor, true);
}
