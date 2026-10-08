import { documentAccess, documentFailure } from "@/lib/company-templates/documents/api";
import { readDocumentHtml, readTemplateDocument } from "@/lib/company-templates/documents/repository";
import { documentBridge } from "@/lib/company-templates/documents/frame-bridge";
import { TEMPLATE_CONTENT_SECURITY_POLICY } from "@/lib/company-templates/content-security";
import { addCompanyTemplateReadySignal } from "@/lib/company-templates/frame-document";
/** 仅加载本人文档绑定的原版；公司停用或更新不会改变这条读取路径。 */
export async function GET(request: Request, context: { params: Promise<{ documentId: string }> }) {
  try {
    const db = await documentAccess(); const { documentId } = await context.params;
    const document = await readTemplateDocument(db, documentId);
    if (!document) throw new Error("document_missing");
    const url = new URL(request.url); const token = url.searchParams.get("loadToken") ?? "";
    if (!/^[a-f0-9-]{36}$/i.test(token)) throw new Error("document_invalid");
    const guide=url.searchParams.get("kind")==="guide";
    const html = await readDocumentHtml(db, document,guide);
    return new Response(guide?addCompanyTemplateReadySignal(html,token):documentBridge(html, token, url.origin), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", "Content-Security-Policy": TEMPLATE_CONTENT_SECURITY_POLICY, "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" } });
  } catch (cause) { return documentFailure(cause); }
}
export function HEAD() { return new Response(null,{status:405,headers:{Allow:"GET"}}); }
