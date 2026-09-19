import { getCompanyTemplateDocument } from "@/lib/company-templates/repository";
import { requireCompanyTemplateApiAccess } from "@/lib/company-templates/access";
import { getServerSupabaseClient } from "@/lib/supabase-server";

const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "style-src 'unsafe-inline'",
  "script-src 'unsafe-inline'",
  "img-src data: blob: http: https:",
  "font-src data:",
  "connect-src 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'self'",
].join("; ");

/**
 * HTML 正文使用独立响应交给沙箱 iframe。CSP 禁止联网脚本、接口请求、嵌入页面和表单提交，
 * 同时保留模板需要的内联交互、data/blob 图片以及员工主动打开的产品链接。
 */
export async function GET(request: Request, context: { params: Promise<{ templateId: string }> }) {
  try {
    const access = await requireCompanyTemplateApiAccess();
    const { templateId } = await context.params;
    const url = new URL(request.url);
    const guide = url.searchParams.get("kind") === "guide";
    const requestedVersion = url.searchParams.get("version");
    const versionId = access.isAdmin ? requestedVersion : null;
    const document = await getCompanyTemplateDocument(
      await getServerSupabaseClient(),
      templateId,
      { guide, versionId },
    );
    if (!document) return new Response("Template not found", { status: 404 });
    return new Response(document.content, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Security-Policy": CONTENT_SECURITY_POLICY,
        "Content-Type": "text/html; charset=utf-8",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
        "X-Template-SHA256": document.hash,
      },
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "";
    return new Response(message.includes("integrity") ? "Template verification failed" : "Access denied", {
      status: message.includes("integrity") ? 409 : 403,
    });
  }
}
