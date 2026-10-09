/** 文档正文只在编辑页读取；列表摘要不带填写内容或图片。 */
export type TemplateDocumentSummary = {
  id: string; name: string; template_name: string; template_id: string;
  template_version_id: string; folder_id: string; revision: number; state_sha256: string; updated_at: string;
};
export type DocumentLocation = { folder_id: string; archive_id: string; user_id: string | null; customer_id: string | null; zone: string; folder_name: string; folder_system_key: string | null; can_manage: boolean };
export type TemplateDocument = TemplateDocumentSummary & { state: Record<string, unknown>; location: DocumentLocation };
export type DocumentMutation = {
  action: "create" | "save" | "rename" | "copy" | "move" | "delete";
  documentId: string; operationId: string; expectedRevision?: number;
  templateId?: string; sourceId?: string; name?: string; state?: Record<string, unknown>; folderId?: string; confirmShare?: boolean;
};
export type DocumentReceipt = { document_id: string; folder_id: string; revision: number; state_sha256: string; affected_rows: number; deleted: boolean };
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

/** 属性顺序不属于填写数据；规范化后比较，避免数据库 jsonb 重排键造成误报。 */
export function canonicalState(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalState).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonicalState(item)}`).join(",")}}`;
  return JSON.stringify(value);
}
