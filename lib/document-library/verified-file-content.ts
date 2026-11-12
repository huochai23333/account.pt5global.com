import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { inspectDocument } from "./file-policy";
import { DOCUMENT_BUCKET, type DocumentFile } from "./model";

type ContentRecord = Pick<DocumentFile, "storage_path" | "original_name" | "size_bytes" | "sha256">;

/** 单文件和打包下载共用这道检查。存储访问沿用当前用户，文件登记与实际对象必须一致。 */
export async function readVerifiedDocumentContent(db: SupabaseClient, file: ContentRecord) {
  const { data, error } = await db.storage.from(DOCUMENT_BUCKET).download(file.storage_path);
  if (error || !data) throw new Error("unconfirmed");

  const bytes = new Uint8Array(await data.arrayBuffer());
  const inspection = inspectDocument(file.original_name, bytes);
  if (bytes.length !== file.size_bytes || inspection.sha256 !== file.sha256) {
    throw new Error("unconfirmed");
  }
  return { bytes, mime: inspection.mime };
}
