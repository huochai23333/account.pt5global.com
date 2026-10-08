/** 文件归属来自档案和目录；网址中的编号只是选择条件，不代表访问授权。 */
export type DocumentArchive = { id: string; user_id: string | null; customer_id: string | null; kind: "employee" | "customer"; name: string };
export type DocumentZone = "personal" | "staff_internal" | "customer_internal" | "shared";
export type DocumentFolder = { id: string; archive_id: string; parent_id: string | null; zone: DocumentZone; name: string; system_key: string | null; version: number; can_manage: boolean };
export type DocumentFile = { id: string; folder_id: string; name: string; original_name: string; mime_type: string; size_bytes: number; sha256: string; storage_path: string; uploaded_by: string; status: "pending" | "ready" | "deleting" | "failed"; version: number; created_at: string };
export type DocumentReceipt = { operationId: string; action: string; status: "pending" | "succeeded" | "partial_failed" | "failed"; affectedCount: number; record: DocumentFile | DocumentFolder };
export type DocumentLibrary = { archiveId: string; folderId: string; canManage: boolean; archives: DocumentArchive[]; folders: DocumentFolder[]; files: DocumentFile[]; total: number; operations: DocumentReceipt[] };
export type DocumentSelection = { user?: string; customer?: string; folder?: string; query?: string; page?: number };
export const DOCUMENT_BUCKET = "document-library";

/** 必须核对终态、影响数量和记录编号；普通 HTTP 成功不能代替业务凭证。 */
export function requireDocumentReceipt(value: unknown, operationId: string, terminal = true): DocumentReceipt {
  const receipt = value as DocumentReceipt | null;
  if (!receipt || receipt.operationId !== operationId || !receipt.record?.id || !receipt.record.version
    || (terminal && (receipt.status !== "succeeded" || receipt.affectedCount !== 1))) {
    throw new Error(receipt?.status === "partial_failed" ? "partial" : "unconfirmed");
  }
  return receipt;
}
