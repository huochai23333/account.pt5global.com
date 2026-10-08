import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { CompanyTemplatesClient } from "@/components/dashboard/company-templates/company-templates-client";
import { requireCompanyTemplateWorkspace } from "@/lib/company-templates/access";
import { listCompanyTemplates } from "@/lib/company-templates/repository";
import { getServerSupabaseClient } from "@/lib/supabase-server";
import Link from "next/link";
import { listTemplateDocuments } from "@/lib/company-templates/documents/repository";
import { DocumentList } from "@/components/dashboard/company-templates/documents/document-list";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("CompanyTemplates");
  return { title: t("title") };
}

/** 服务端先核对角色和工作区，再把 RLS 可见的模板摘要交给轻量客户端列表。 */
export default async function CompanyTemplatesPage({ params, searchParams }: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { workspace } = await params;
  const { isAdmin } = await requireCompanyTemplateWorkspace(workspace);
  const personal = (await searchParams).tab === "documents";
  const t = await getTranslations("CompanyTemplates.documents");
  const db = await getServerSupabaseClient();
  // 标签页只读取当前需要的数据，个人列表不把正文和图片带到浏览器。
  const content = personal ? <DocumentList initial={await listTemplateDocuments(db)} workspace={workspace}/>
    : <CompanyTemplatesClient initialTemplates={await listCompanyTemplates(db)} isAdmin={isAdmin} workspace={workspace}/>;
  return <div className="grid min-w-0 gap-5"><nav aria-label={t("tabs")} className="mx-auto flex w-full max-w-[1600px] gap-2">
    <Link aria-current={!personal?"page":undefined} className="rounded-xl border border-input px-4 py-3 text-sm font-semibold aria-[current=page]:bg-surface-inset" href={`/${workspace}/company-templates`}>{t("company")}</Link>
    <Link aria-current={personal?"page":undefined} className="rounded-xl border border-input px-4 py-3 text-sm font-semibold aria-[current=page]:bg-surface-inset" href={`/${workspace}/company-templates?tab=documents`}>{t("title")}</Link>
  </nav>{content}</div>;
}
