import { requireCompanyTemplateApiAccess } from "@/lib/company-templates/access";
import { readCompanyTemplateErrorMessage } from "@/lib/company-templates/display-error";
import {
  activateCompanyTemplateVersion,
  setCompanyTemplateStatus,
} from "@/lib/company-templates/repository";
import { getServerSupabaseClient } from "@/lib/supabase-server";

type ManageBody = {
  action?: unknown;
  active?: unknown;
  expectedRevision?: unknown;
  templateId?: unknown;
  versionId?: unknown;
};

/** 回退与启停共用一个小型管理入口，二者都必须携带页面读到的预期修订号。 */
export async function POST(request: Request) {
  try {
    await requireCompanyTemplateApiAccess({ admin: true });
    const body = await request.json() as ManageBody;
    if (typeof body.templateId !== "string" || !Number.isInteger(body.expectedRevision)) {
      throw new Error("company_template_details_invalid");
    }
    const supabase = await getServerSupabaseClient();
    // action 白名单让未知操作直接失败，避免把任意请求参数传给数据库函数。
    const receipt = body.action === "activate" && typeof body.versionId === "string"
      ? await activateCompanyTemplateVersion(supabase, body.templateId, body.versionId, Number(body.expectedRevision))
      : body.action === "status" && typeof body.active === "boolean"
        ? await setCompanyTemplateStatus(supabase, body.templateId, body.active, Number(body.expectedRevision))
        : null;
    if (!receipt) throw new Error("company_template_details_invalid");
    return Response.json({ ok: true, receipt });
  } catch (cause) {
    const message = readCompanyTemplateErrorMessage(cause);
    const code = message.includes("forbidden") ? "company_template_forbidden"
      : message.includes("conflict") ? "company_template_revision_conflict"
        : message.includes("missing") ? "company_template_missing" : "company_template_manage_failed";
    return Response.json({ ok: false, error: code }, {
      status: code === "company_template_forbidden" ? 403 : code.includes("conflict") ? 409 : 400,
    });
  }
}
