/** 文件归属来自档案和目录；网址中的编号只是选择条件，不代表访问授权。 */
export type DocumentArchive = { id: string; user_id: string | null; customer_id: string | null; kind: "employee" | "customer"; name: string };
export type DocumentZone = "personal" | "staff_internal" | "customer_internal" | "shared";
export type DocumentFolder = { id: string; archive_id: string; parent_id: string | null; zone: DocumentZone; name: string; system_key: string | null; created_at: string; version: number; can_manage: boolean; delete_batch_id?: string | null };
export type DocumentFile = { id: string; folder_id: string; name: string; original_name: string; mime_type: string; size_bytes: number; sha256: string; storage_path: string; uploaded_by: string; status: "pending" | "ready" | "deleting" | "failed"; version: number; created_at: string; updated_at?: string };
/** 两类资料的正文保存方式不同；列表用明确的种类分派操作，不能把模板当作上传对象删除。 */
export type DocumentLibraryItem = {kind: "file"; file: DocumentFile} | {kind: "template"; document: import("@/lib/company-templates/documents/model").TemplateDocumentSummary};
export type DocumentReceipt = { operationId: string; action: string; status: "pending" | "succeeded" | "partial_failed" | "failed"; affectedCount: number; record: DocumentFile | DocumentFolder };
export type DocumentLibrary = { archiveId: string; folderId: string; canManage: boolean; archives: DocumentArchive[]; folders: DocumentFolder[]; files: DocumentFile[]; items: DocumentLibraryItem[]; total: number; operations: DocumentReceipt[] };
export type DocumentSelection = { user?: string; customer?: string; folder?: string; query?: string; page?: number; scope?: "home" | "employees" | "customers" | "archive" | "folder"; sort?: "name" | "type" | "date"; direction?: "asc" | "desc" };
/** 虚拟分类与真实资料使用不同种类，分类入口不会被当成可删除的文件夹。 */
export type ExplorerItem = (DocumentLibraryItem & {id: string; name: string; path: string[]; canManage: boolean})
 | {kind: "folder"; id: string; name: string; folder: DocumentFolder; path: string[]; canManage: boolean}
 | {kind: "location" | "archive"; id: string; name: string; selection: DocumentSelection; archive?: DocumentArchive};
export type ExplorerLibrary = Omit<DocumentLibrary,"items" | "folderId"> & {items: ExplorerItem[]; page: number; folderId: string | null; scope: NonNullable<DocumentSelection["scope"]>; batches: DocumentBatchSummary[]};
export type ExplorerTarget = {kind: "file" | "template" | "folder"; id: string; version: number};
export type ManifestEntry = ExplorerTarget & {folderId: string; anchor: string; depth: number; location?: {archiveName: string; folders: Pick<DocumentFolder,"name"|"system_key"|"zone">[]}; path: string[]; record: Record<string, unknown> & {name: string}};
export type DocumentManifest = {entries: ManifestEntry[]; digest: string};
export type BatchResult = {kind: ExplorerTarget["kind"]; id: string; name: string; operationId: string; status: "pending" | "succeeded" | "failed"; receipt?: unknown; error?: string};
export type DocumentBatchSummary = {id: string; action: "move" | "delete"; status: "pending" | "succeeded" | "partial_failed" | "failed"; results: BatchResult[]; total?: number};
export type DocumentBatch = DocumentBatchSummary & {manifest: ManifestEntry[]; snapshot: ManifestEntry[]; request: {action: "move" | "delete"; items: ExplorerTarget[]; destinationId?: string; confirmShare?: boolean; released?: boolean}};
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
