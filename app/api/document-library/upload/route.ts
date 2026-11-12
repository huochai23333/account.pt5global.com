import { requireDocumentApi } from "@/lib/document-library/access";
import { checkDocumentOrigin, documentError, readDocumentBody } from "@/lib/document-library/http";
import { uploadDocument } from "@/lib/document-library/storage-mutations";

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireDocumentApi();
    checkDocumentOrigin(request);

    // 登录和来源检查通过后才读取有大小上限的请求体。原始类型包含多段表单的边界。
    const bytes = await readDocumentBody(request, 32 * 1024 * 1024);
    const contentType = request.headers.get("content-type") ?? "";
    const form = await new Response(bytes, {
      headers: { "Content-Type": contentType },
    }).formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("invalid");

    const operationId = String(form.get("operationId"));
    const folderId = String(form.get("folderId"));
    const receipt = await uploadDocument(supabase, userId, operationId, folderId, file);
    return Response.json(receipt, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return documentError(error);
  }
}
