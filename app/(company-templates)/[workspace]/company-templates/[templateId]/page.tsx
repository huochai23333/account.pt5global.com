import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { CompanyTemplateViewer } from "@/components/dashboard/company-templates/company-template-viewer";
import { requireCompanyTemplateWorkspace } from "@/lib/company-templates/access";
import { listCompanyTemplates } from "@/lib/company-templates/repository";
import { getServerSupabaseClient } from "@/lib/supabase-server";

export default async function CompanyTemplatePage({ params }: {
  params: Promise<{ templateId: string; workspace: string }>;
}) {
  const { templateId, workspace } = await params;
  await requireCompanyTemplateWorkspace(workspace);
  const template = (await listCompanyTemplates(await getServerSupabaseClient()))
    .find((item) => item.id === templateId && item.status === "active");
  if (!template) notFound();
  const t = await getTranslations("CompanyTemplates");
  return <CompanyTemplateViewer guide={false} template={template} text={(key) => t(key)} workspace={workspace} />;
}
