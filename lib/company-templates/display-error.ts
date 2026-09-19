const DISPLAYABLE_ERROR_CODES = new Set([
  "company_template_forbidden",
  "company_template_revision_conflict",
  "company_template_missing",
  "company_template_file_required",
  "company_template_file_type",
  "company_template_file_too_large",
  "company_template_file_encoding",
  "company_template_file_document",
  "company_template_file_unsafe",
  "company_template_slug_invalid",
  "company_template_details_invalid",
  "company_template_publish_receipt_invalid",
  "company_template_publish_not_confirmed",
  "company_template_publish_failed",
  "company_template_manage_failed",
]);

/** 只把已经准备好日常语言文案的错误码交给翻译层，网络异常等未知内容统一显示失败提示。 */
export function getCompanyTemplateDisplayError(
  cause: unknown,
  fallback: "company_template_manage_failed" | "company_template_publish_failed",
) {
  const message = readCompanyTemplateErrorMessage(cause);
  return DISPLAYABLE_ERROR_CODES.has(message) ? message : fallback;
}

/** Supabase/PostgREST 的错误是普通对象；这里统一读取 message，避免丢失数据库返回的明确失败码。 */
export function readCompanyTemplateErrorMessage(cause: unknown) {
  if (cause instanceof Error) return cause.message;
  if (cause && typeof cause === "object" && "message" in cause
    && typeof (cause as { message?: unknown }).message === "string") {
    return (cause as { message: string }).message;
  }
  return "";
}
