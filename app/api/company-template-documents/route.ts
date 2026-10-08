import { documentAccess, documentFailure, readDocumentMutation } from "@/lib/company-templates/documents/api";
import { listTemplateDocuments, mutateTemplateDocument } from "@/lib/company-templates/documents/repository";
/** 接口只调度；权限、输入限制和最终凭证均由同层服务完成。 */
export async function GET(request: Request) {
  try { const db = await documentAccess(); const url = new URL(request.url); const offset = Math.max(0, Math.min(100000, Number(url.searchParams.get("offset")) || 0));
    return Response.json({ ok: true, documents: await listTemplateDocuments(db, (url.searchParams.get("search") ?? "").slice(0,120), Math.floor(offset)) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) { return documentFailure(cause); }
}
export async function POST(request: Request) {
  try { const db = await documentAccess(); const input = await readDocumentMutation(request); return Response.json({ ok: true, ...await mutateTemplateDocument(db, input) }); }
  catch (cause) { return documentFailure(cause); }
}
