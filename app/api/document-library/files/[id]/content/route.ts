import { requireDocumentApi } from "@/lib/document-library/access";
import { documentError } from "@/lib/document-library/http";
import type { DocumentFile } from "@/lib/document-library/model";
import { readVerifiedDocumentContent } from "@/lib/document-library/verified-file-content";

/** 每次读取都使用当前登录身份和 RLS；撤回共享后，旧内容地址也无法再次读取。 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const wantsPreview = new URL(request.url).searchParams.get("preview") === "1";
  try {
    const { supabase } = await requireDocumentApi();
    const { id } = await params;
    const { data: file, error } = await supabase
      .from("document_files")
      .select("*")
      .eq("id", id)
      .eq("status", "ready")
      .maybeSingle<DocumentFile>();
    if (error || !file) throw new Error("forbidden");

    const { bytes, mime } = await readVerifiedDocumentContent(supabase, file);
    const preview =
      wantsPreview && (mime.startsWith("image/") || mime === "application/pdf");
    return new Response(bytes, {
      headers: {
        "Content-Type": preview ? mime : "application/octet-stream",
        "Content-Length": String(bytes.length),
        "Content-Disposition": `${preview ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        // 原生 PDF 阅读器会被 sandbox 禁止加载。已校验的图片/PDF 仍禁止脚本及跨站嵌入。
        "Content-Security-Policy": preview
          ? "frame-ancestors 'self'; script-src 'none'; base-uri 'none'; form-action 'none'"
          : "sandbox; default-src 'none'",
      },
    });
  } catch (error) {
    const response = documentError(error);
    // 预览窗需要识别本站错误正文。跨站仍不可嵌入，也不加载脚本或外部资源。
    if (wantsPreview) {
      response.headers.set("Content-Security-Policy", "frame-ancestors 'self'; default-src 'none'");
    }
    return response;
  }
}
