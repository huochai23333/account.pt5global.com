import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleClient } from "@/lib/supabase-admin-server";
import { readStorageObjectPresence } from "@/lib/storage-operation-object-presence";
import {
  requireStorageUploadReceipt,
  removeStorageObjectsVerified,
} from "@/lib/storage-operation-receipts";
import {
  DOCUMENT_BUCKET,
  requireDocumentReceipt,
  type DocumentReceipt,
  type DocumentFile,
} from "./model";
import { inspectDocument } from "./file-policy";

async function finish(operationId: string, actor: string, success: boolean) {
  const { data, error } = await getSupabaseServiceRoleClient().rpc("document_library_finish", {
    p_operation: operationId,
    p_actor: actor,
    p_success: success,
    p_cleanup: false,
  });
  if (error) throw error;
  return requireDocumentReceipt(data, operationId, success);
}

async function verifyUploadedObject(
  supabase: SupabaseClient,
  record: DocumentFile,
  inspectionName: string,
) {
  const result = await supabase.storage.from(DOCUMENT_BUCKET).download(record.storage_path);
  if (result.error || !result.data || result.data.size !== record.size_bytes)
    throw new Error("unconfirmed");
  const bytes = new Uint8Array(await result.data.arrayBuffer());
  if (inspectDocument(inspectionName, bytes).sha256 !== record.sha256)
    throw new Error("unconfirmed");
}

export async function uploadDocument(
  supabase: SupabaseClient,
  actor: string,
  operationId: string,
  folderId: string,
  file: File,
) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const inspection = inspectDocument(file.name, bytes);
  const { data, error } = await supabase.rpc("document_library_command", {
    p_operation: operationId,
    p_action: "reserve_upload",
    p_payload: { folderId, name: file.name, size: file.size, ...inspection },
  });
  if (error) throw error;
  const receipt = requireDocumentReceipt(data, operationId, false);
  return completeReservedDocumentUpload(supabase, actor, receipt, bytes, file.name);
}
/** 原上传与复制共用实际对象核对；已有上传编号在断线重送时保持不变。 */
export async function completeReservedDocumentUpload(
  supabase: SupabaseClient,
  actor: string,
  receipt: DocumentReceipt,
  bytes: Uint8Array,
  inspectionName: string,
) {
  const operationId = receipt.operationId;
  const inspection = inspectDocument(inspectionName, bytes);
  const record = receipt.record as DocumentFile;
  if (receipt.status === "succeeded") {
    // 旧回执证明当时写入，重试时还需确认当前对象的实际内容。
    await verifyUploadedObject(supabase, record, inspectionName);
    return requireDocumentReceipt(receipt, operationId);
  }
  if (receipt.status === "failed") throw new Error("conflict");
  const bucket = supabase.storage.from(DOCUMENT_BUCKET);
  try {
    // 同一操作断线重试时只复用原对象，绝不覆盖别人或重新生成文件编号。
    const exists = await bucket.exists(record.storage_path);
    if (exists.error && exists.data !== false) throw exists.error;
    if (!exists.data) {
      const { data: uploadReceipt, error: uploadError } = await supabase.storage
        .from(DOCUMENT_BUCKET)
        .upload(record.storage_path, bytes, { contentType: inspection.mime, upsert: false });
      if (uploadError) {
        // 同一操作并发重送时，另一请求可能已经写入对象；先独立核对，不能清掉对方正在完成的文件。
        const present = await bucket.exists(record.storage_path);
        if (present.data !== true || present.error) throw uploadError;
      } else requireStorageUploadReceipt(uploadReceipt, record.storage_path, "unconfirmed");
    }
    await verifyUploadedObject(supabase, record, inspectionName);
    return await finish(operationId, actor, true);
  } catch {
    // 请求失联可能发生在提交后，另一条重试也可能正在使用同一对象。
    // 保留对象和登记，由原操作继续核对，或由后台按过期条件领取清理。
    const latest = await finish(operationId, actor, false);
    if (latest.status !== "succeeded") return latest;
    await verifyUploadedObject(supabase, latest.record as DocumentFile, inspectionName);
    return requireDocumentReceipt(latest, operationId);
  }
}
export async function completeDocumentDelete(
  supabase: SupabaseClient,
  actor: string,
  receipt: DocumentReceipt,
) {
  const file = receipt.record as DocumentFile;
  const bucket = supabase.storage.from(DOCUMENT_BUCKET);
  if (receipt.status === "succeeded") {
    // 重试只读取原路径；旧成功凭证不能遮住仍存在的对象或当前读取失败。
    if (await readStorageObjectPresence(bucket, file.storage_path)) throw new Error("unconfirmed");
    return requireDocumentReceipt(receipt, receipt.operationId);
  }
  try {
    if (await readStorageObjectPresence(bucket, file.storage_path))
      await removeStorageObjectsVerified(supabase, DOCUMENT_BUCKET, [file.storage_path], {
        confirmationMessage: "unconfirmed",
        timeoutMessage: "unconfirmed",
      });
    // 删除响应之后再次核对；目录读取失败时保留原登记，不能把不确定性写成成功。
    if (await readStorageObjectPresence(bucket, file.storage_path)) throw new Error("unconfirmed");
    return await finish(receipt.operationId, actor, true);
  } catch {
    const latest = await finish(receipt.operationId, actor, false);
    if (latest.status === "succeeded") {
      // 另一请求可能已完成原操作；仍需重新证明其对象已消失。
      if (await readStorageObjectPresence(bucket, file.storage_path)) throw new Error("unconfirmed");
      return requireDocumentReceipt(latest, receipt.operationId);
    }
    return latest;
  }
}

/** 原上传中断后重新读取真实字节，再完成原登记；不存在对象时保留待处理状态。 */
export async function reconcileDocument(
  supabase: SupabaseClient,
  actor: string,
  operationId: string,
) {
  const result = await supabase
    .from("document_operations")
    .select("receipt")
    .eq("id", operationId)
    .eq("actor_id", actor)
    .maybeSingle();
  if (result.error || !result.data) throw new Error("forbidden");
  const receipt = requireDocumentReceipt(result.data.receipt, operationId, false);
  if (receipt.action === "delete_file") return completeDocumentDelete(supabase, actor, receipt);
  if (receipt.action !== "reserve_upload" && receipt.status === "succeeded")
    return requireDocumentReceipt(receipt, operationId);
  if (receipt.action !== "reserve_upload" || receipt.status === "failed")
    throw new Error("conflict");
  const file = receipt.record as DocumentFile;
  await verifyUploadedObject(supabase, file, file.original_name);
  if (receipt.status === "succeeded") return requireDocumentReceipt(receipt, operationId);
  return finish(operationId, actor, true);
}
