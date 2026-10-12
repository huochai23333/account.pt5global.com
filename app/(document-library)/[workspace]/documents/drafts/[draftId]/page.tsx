import {notFound} from "next/navigation";
import Link from "next/link";
import {getTranslations} from "next-intl/server";
import {requireDocumentWorkspace} from "@/lib/document-library/access";
import {getServerSupabaseClient} from "@/lib/supabase-server";
import {readDraft,readPromotedDraft} from "@/lib/company-templates/documents/draft-repository";
import {DraftEditor} from "@/components/dashboard/company-templates/documents/draft-editor";
/** 转正后原草稿地址展示已确认结果和打开链接，不再次创建或恢复草稿。 */
export default async function DraftPage({params}:{params:Promise<{workspace:string;draftId:string}>}){const {workspace,draftId}=await params;await requireDocumentWorkspace(workspace);const db=await getServerSupabaseClient();const draft=await readDraft(db,draftId);if(draft)return <DraftEditor key={`${draft.id}:${draft.revision}`} draft={draft} workspace={workspace}/>;const document=await readPromotedDraft(db,draftId);if(!document)notFound();const t=await getTranslations("CompanyTemplates.documents");return <section className="grid gap-3"><h2>{t("draftPromoted")}</h2><Link className="text-primary" href={`/${workspace}/documents/templates/${document.id}`}>{t("edit")}</Link></section>;}
