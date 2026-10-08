import { requireDocumentApi } from "@/lib/document-library/access";
import { checkDocumentOrigin, documentError, readDocumentBody } from "@/lib/document-library/http";
import { readDocumentLibrary } from "@/lib/document-library/repository";
import { completeDocumentDelete } from "@/lib/document-library/storage-mutations";
import { requireDocumentReceipt } from "@/lib/document-library/model";

export async function GET(request: Request) {
  try {
    const { supabase } = await requireDocumentApi();
    const params = new URL(request.url).searchParams;
    return Response.json(await readDocumentLibrary(supabase, { user: params.get("user") ?? undefined, customer: params.get("customer") ?? undefined, folder: params.get("folder") ?? undefined, query: params.get("query") ?? undefined, page: Number(params.get("page")) || 1 }), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return documentError(error); }
}
export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireDocumentApi(); checkDocumentOrigin(request);
    const body = JSON.parse((await readDocumentBody(request, 16_384)).toString("utf8"));
    // 上传准备只由上传接口在字节校验后执行，通用管理入口不接受任意预登记。
    if (body.action === "reserve_upload") throw new Error("invalid");
    const { data, error } = await supabase.rpc("document_library_command", { p_operation: body.operationId, p_action: body.action, p_payload: body.payload });
    if (error) throw error;
    let receipt = requireDocumentReceipt(data, body.operationId, false);
    if (body.action === "delete_file") receipt = await completeDocumentDelete(supabase, userId, receipt);
    return Response.json(receipt, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return documentError(error); }
}
