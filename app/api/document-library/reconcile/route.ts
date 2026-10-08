import { requireDocumentApi } from "@/lib/document-library/access";
import { checkDocumentOrigin, documentError, readDocumentBody } from "@/lib/document-library/http";
import { reconcileDocument } from "@/lib/document-library/storage-mutations";

/** 独立读取数据库保存的原操作凭证，供页面核对写响应中的编号和版本。 */
export async function GET(request: Request) {
  try {
    const { supabase, userId } = await requireDocumentApi();
    const operationId = new URL(request.url).searchParams.get("operationId");
    const result = await supabase.from("document_operations").select("receipt").eq("id", operationId).eq("actor_id", userId).maybeSingle();
    if (result.error || !result.data) throw new Error("unconfirmed");
    return Response.json(result.data.receipt, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return documentError(error); }
}

/** 继续核对只处理原编号，不生成新文件或替用户重新提交。 */
export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireDocumentApi(); checkDocumentOrigin(request);
    const body = JSON.parse((await readDocumentBody(request, 4096)).toString("utf8"));
    return Response.json(await reconcileDocument(supabase, userId, body.operationId), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return documentError(error); }
}
