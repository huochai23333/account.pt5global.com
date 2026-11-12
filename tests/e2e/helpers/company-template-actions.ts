import { test } from "@playwright/test";
import { getLocalSupabaseAdminClient } from "./local-supabase-admin";

/** 统一导出原测试能力；访问、页面、载荷和凭证有独立维护边界。 */
export {
  fillQuotationRow,
  fillPublishDialog,
  clickStableTemplateButton,
  expectNoPageOverflow,
} from "./company-template-page-actions";
export {
  htmlFile,
  publishMultipart,
  sha256,
  withDocumentProtocol,
} from "./company-template-payloads";
export {
  readTemplateBySlug,
  readVersion,
  countTemplates,
  countVersions,
  deleteTemplate,
} from "./company-template-records";

export function requireLocalAdminClient() {
  const admin = getLocalSupabaseAdminClient();
  test.skip(!admin, "必须连接本地 Docker Supabase 才能核对最终业务凭证。");
  if (!admin) throw new Error("local_supabase_admin_required");
  return admin;
}
