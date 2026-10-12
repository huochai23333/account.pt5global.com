import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { CompanyTemplatesClient } from "@/components/dashboard/company-templates/company-templates-client";
import { requireCompanyTemplateWorkspace } from "@/lib/company-templates/access";
import {listDrafts} from "@/lib/company-templates/documents/draft-repository";
import { listCompanyTemplates } from "@/lib/company-templates/repository";
import { getServerSupabaseClient } from "@/lib/supabase-server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("CompanyTemplates");
  return { title: t("title") };
}

/** 服务端先核对角色和工作区，再把 RLS 可见的模板摘要交给轻量客户端列表。 */
export default async function CompanyTemplatesPage({ params,searchParams }: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{folder?:string}>;
}) {
  const { workspace } = await params;
  const { isAdmin } = await requireCompanyTemplateWorkspace(workspace);
  const db = await getServerSupabaseClient();
  // 网址只传递预选位置；目录弹窗和写入接口会再次核对，不能据此授予保存权限。
  const folder=(await searchParams).folder;const initialFolderId=typeof folder==="string"&&/^[a-f0-9-]{36}$/i.test(folder)?folder:undefined;
  // 模板和自己的云端草稿并行读取；正式文档在我的文档中管理。
  const [templates,drafts]=await Promise.all([listCompanyTemplates(db),listDrafts(db)]);
  return <CompanyTemplatesClient initialTemplates={templates} initialDrafts={drafts} isAdmin={isAdmin} workspace={workspace} initialFolderId={initialFolderId}/>;
}
