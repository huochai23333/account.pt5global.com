import { getTranslations } from "next-intl/server";
import { DocumentLibraryClient } from "@/components/dashboard/document-library/document-library-client";
import { requireDocumentApi } from "@/lib/document-library/access";
import {readExplorer} from "@/lib/document-library/explorer-repository";
import {parseDocumentSelection} from "@/lib/document-library/selection";


export async function generateMetadata() { const t = await getTranslations("Documents"); return { title: t("title") }; }
export default async function DocumentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { userId, supabase } = await requireDocumentApi();
  const params = await searchParams;
  const selection=parseDocumentSelection(new URLSearchParams(Object.entries(params).filter(([,v])=>typeof v==="string") as [string,string][]));
  // 错误只交给资料区恢复，不能把内部数据库异常直接显示给用户。
  const initial = await readExplorer(supabase, selection).catch(() => null);
  return <DocumentLibraryClient initial={initial} selection={selection} userId={userId} />;
}
