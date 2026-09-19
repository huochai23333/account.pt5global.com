import { getServerSupabaseClient } from "@/lib/supabase-server";
import { requireCompanyTemplateApiAccess } from "@/lib/company-templates/access";
import { readCompanyTemplateErrorMessage } from "@/lib/company-templates/display-error";
import { publishCompanyTemplateVersion } from "@/lib/company-templates/repository";
import { normalizeTemplateSlug, validateHtmlFile } from "@/lib/company-templates/validation";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** 管理员上传入口：先校验账号和两个文件，再调用事务 RPC，任何一步失败都会返回稳定错误码。 */
export async function POST(request: Request) {
  try {
    await requireCompanyTemplateApiAccess({ admin: true });
    const form = await request.formData();
    const html = await validateHtmlFile(form.get("htmlFile"));
    const guide = await validateHtmlFile(form.get("guideFile"), { optional: true });
    if (!html) throw new Error("company_template_file_required");

    const templateId = readUuid(form, "templateId");
    const versionId = readUuid(form, "versionId");
    const expectedRevision = readExpectedRevision(form.get("expectedRevision"));
    const name = String(form.get("name") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();
    if (!name || name.length > 120 || description.length > 500) {
      throw new Error("company_template_details_invalid");
    }

    // 浏览器预先生成模板 ID 和版本 ID；网络中断后用同一组 ID 重试时，数据库会返回原发布回执而不会重复建版。
    const receipt = await publishCompanyTemplateVersion(
      await getServerSupabaseClient(),
      {
        description,
        expectedRevision,
        guideContent: guide?.content ?? null,
        guideFilename: guide?.filename ?? null,
        htmlContent: html.content,
        name,
        slug: normalizeTemplateSlug(String(form.get("slug") ?? "")),
        sourceFilename: html.filename,
        templateId,
        versionId,
      },
    );
    return Response.json({ ok: true, receipt });
  } catch (cause) {
    const code = getErrorCode(cause);
    return Response.json({ ok: false, error: code }, {
      status: code === "company_template_forbidden" ? 403 : code.includes("conflict") ? 409 : 400,
    });
  }
}

function readUuid(form: FormData, key: string) {
  const value = String(form.get(key) ?? "");
  if (!UUID_PATTERN.test(value)) throw new Error("company_template_details_invalid");
  return value;
}

function readExpectedRevision(value: FormDataEntryValue | null) {
  if (value === null || value === "") return null;
  const revision = Number(value);
  if (!Number.isInteger(revision) || revision < 0) throw new Error("company_template_details_invalid");
  return revision;
}

function getErrorCode(cause: unknown) {
  // 只向浏览器返回允许展示的错误码，数据库的详细错误和文件内容都不会泄露到页面。
  const message = readCompanyTemplateErrorMessage(cause);
  const known = [
    "company_template_forbidden", "company_template_revision_conflict", "company_template_file_required",
    "company_template_file_type", "company_template_file_too_large", "company_template_file_encoding",
    "company_template_file_document", "company_template_file_unsafe", "company_template_slug_invalid",
    "company_template_details_invalid", "company_template_publish_receipt_invalid",
    "company_template_publish_not_confirmed",
  ];
  return known.find((code) => message.includes(code)) ?? "company_template_publish_failed";
}
