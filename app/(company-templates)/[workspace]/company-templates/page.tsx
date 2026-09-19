import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { CompanyTemplatesClient } from "@/components/dashboard/company-templates/company-templates-client";
import { requireCompanyTemplateWorkspace } from "@/lib/company-templates/access";
import { listCompanyTemplates } from "@/lib/company-templates/repository";
import { getServerSupabaseClient } from "@/lib/supabase-server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("CompanyTemplates");
  return { title: t("title") };
}

/** 服务端先核对角色和工作区，再把 RLS 可见的模板摘要交给轻量客户端列表。 */
export default async function CompanyTemplatesPage({ params }: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const { isAdmin } = await requireCompanyTemplateWorkspace(workspace);
  const templates = await listCompanyTemplates(await getServerSupabaseClient());
  return <CompanyTemplatesClient initialTemplates={templates} isAdmin={isAdmin} workspace={workspace} />;
}
