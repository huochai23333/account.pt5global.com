import type { NextRequest } from "next/server";
import { getRequestPublicOrigin } from "@/lib/public-site-origin";
import { documentAccess, documentFailure } from "@/lib/company-templates/documents/api";
import { readDocumentHtml, readTemplateDocument } from "@/lib/company-templates/documents/repository";
import { documentBridge } from "@/lib/company-templates/documents/frame-bridge";
import { TEMPLATE_CONTENT_SECURITY_POLICY } from "@/lib/company-templates/content-security";
import { addCompanyTemplateReadySignal } from "@/lib/company-templates/frame-document";
/** 仅加载本人文档绑定的原版；公司停用或更新不会改变这条读取路径。 */
export async function GET(request: NextRequest, context: { params: Promise<{ documentId: string }> }) {
  try {
    const db = await documentAccess(); const { documentId } = await context.params;
    const document = await readTemplateDocument(db, documentId);
    if (!document) throw new Error("document_missing");
    const url = new URL(request.url); const token = url.searchParams.get("loadToken") ?? "";
    if (!/^[a-f0-9-]{36}$/i.test(token)) throw new Error("document_invalid");
    const guide=url.searchParams.get("kind")==="guide";
    const html = await readDocumentHtml(db, document,guide);
    // 部署平台会把 request.url 改成内部监听地址；握手必须使用浏览器访问的公开地址。
    // 复用站点地址策略，生产环境忽略不可信转发头，同时保留沙箱来源与随机标识校验。
    const parentOrigin = getRequestPublicOrigin(request);
    return new Response(guide?addCompanyTemplateReadySignal(html,token):documentBridge(html, token, parentOrigin), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", "Content-Security-Policy": TEMPLATE_CONTENT_SECURITY_POLICY, "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" } });
  } catch (cause) { return documentFailure(cause); }
}
export function HEAD() { return new Response(null,{status:405,headers:{Allow:"GET"}}); }
