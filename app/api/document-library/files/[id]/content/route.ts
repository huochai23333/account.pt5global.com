import { requireDocumentApi } from "@/lib/document-library/access";
import { documentError } from "@/lib/document-library/http";
import { DOCUMENT_BUCKET, type DocumentFile } from "@/lib/document-library/model";
import { inspectDocument } from "@/lib/document-library/file-policy";

/** 每次读取都使用当前登录身份和 RLS；撤回共享后，旧内容地址也无法再次读取。 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase } = await requireDocumentApi();
    const { id } = await params;
    const result = await supabase.from("document_files").select("*").eq("id", id).eq("status", "ready").maybeSingle<DocumentFile>();
    if (result.error || !result.data) throw new Error("forbidden");
    const file = result.data;
    const content = await supabase.storage.from(DOCUMENT_BUCKET).download(file.storage_path);
    if (content.error || !content.data) throw new Error("unconfirmed");
    const bytes = new Uint8Array(await content.data.arrayBuffer());
    const inspection = inspectDocument(file.original_name, bytes);
    if (inspection.sha256 !== file.sha256 || bytes.length !== file.size_bytes) throw new Error("unconfirmed");
    const preview = new URL(request.url).searchParams.get("preview") === "1" && (inspection.mime.startsWith("image/") || inspection.mime === "application/pdf");
    return new Response(bytes, { headers: {
      "Content-Type": preview ? inspection.mime : "application/octet-stream", "Content-Length": String(bytes.length),
      "Content-Disposition": `${preview ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
      // 原生 PDF 阅读器会被 sandbox 禁止加载。仅已校验的图片/PDF 使用预览策略，仍禁脚本及跨站嵌入。
      "Content-Security-Policy": preview ? "frame-ancestors 'self'; script-src 'none'; base-uri 'none'; form-action 'none'" : "sandbox; default-src 'none'",
    } });
  } catch (error) { return documentError(error); }
}
