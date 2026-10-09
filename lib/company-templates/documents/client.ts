import { MAX_DOCUMENT_BYTES, type DocumentMutation, type DocumentReceipt, type TemplateDocument } from "./model";
/** 所有管理操作复用最终回执校验；网络重试时调用方必须保留原 operationId。 */
export async function writeDocument(input: DocumentMutation) {
  if (input.state && new TextEncoder().encode(JSON.stringify(input.state)).byteLength > MAX_DOCUMENT_BYTES) throw new Error("document_too_large");
  const response = await fetch("/api/company-template-documents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), signal: AbortSignal.timeout(30000) });
  const result = await response.json() as { ok?: boolean; error?: string; receipt?: DocumentReceipt; document?: TemplateDocument };
  if (!response.ok || result.ok !== true || !result.receipt || result.receipt.affected_rows !== 1 || result.receipt.document_id !== input.documentId || !result.receipt.folder_id || (!result.receipt.deleted && (!result.document || result.document.folder_id !== result.receipt.folder_id || result.document.revision !== result.receipt.revision || result.document.state_sha256 !== result.receipt.state_sha256)) || (input.folderId && result.receipt.folder_id !== input.folderId)) throw new Error(result.error ?? "document_not_confirmed");
  return result as { receipt: DocumentReceipt; document: TemplateDocument | null };
}
export function documentErrorKey(cause: unknown) {
  const value = cause instanceof Error ? cause.message : "";
  return ["document_conflict","document_missing","document_forbidden","document_too_large","document_invalid","document_not_confirmed","document_share_confirmation"].includes(value) ? value : "document_failed";
}
