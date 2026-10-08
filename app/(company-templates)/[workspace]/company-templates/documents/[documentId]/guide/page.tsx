import Link from "next/link";
import {notFound} from "next/navigation";
import {getTranslations} from "next-intl/server";
import {requireCompanyTemplateWorkspace} from "@/lib/company-templates/access";
import {getServerSupabaseClient} from "@/lib/supabase-server";
import {readTemplateDocument,hasDocumentGuide} from "@/lib/company-templates/documents/repository";
import {CompanyTemplateDesktopFrame} from "@/components/dashboard/company-templates/company-template-desktop-frame";
/** 指南也跟随文档的原版，停用或发布新版后仍能查看原有填写说明。 */
export default async function DocumentGuidePage({params}:{params:Promise<{workspace:string;documentId:string}>}){
  const {workspace,documentId}=await params;await requireCompanyTemplateWorkspace(workspace);const db=await getServerSupabaseClient();const document=await readTemplateDocument(db,documentId);
  if(!document||!(await hasDocumentGuide(db,document)))notFound();const t=await getTranslations("CompanyTemplates");
  return <section className="mx-auto grid w-full max-w-[1600px] gap-4"><Link href={`/${workspace}/company-templates/documents/${documentId}`}>{t("documents.edit")}</Link><h2>{t("viewer.guideTitle")}</h2><CompanyTemplateDesktopFrame src={`/api/company-template-documents/${documentId}/content?kind=guide`} title={t("viewer.guideTitle")} notice={t("viewer.desktopOnly")} loading={t("viewer.loading")} failed={t("viewer.loadFailed")} retry={t("viewer.retry")}/></section>;
}
