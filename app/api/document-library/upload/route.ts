import { requireDocumentApi } from "@/lib/document-library/access";
import { checkDocumentOrigin, documentError, readDocumentBody } from "@/lib/document-library/http";
import { uploadDocument } from "@/lib/document-library/storage-mutations";

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireDocumentApi(); checkDocumentOrigin(request);
    const bytes = await readDocumentBody(request, 32 * 1024 * 1024);
    const form = await new Response(bytes, { headers: { "Content-Type": request.headers.get("content-type") ?? "" } }).formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("invalid");
    const receipt = await uploadDocument(supabase, userId, String(form.get("operationId")), String(form.get("folderId")), file);
    return Response.json(receipt, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return documentError(error); }
}
