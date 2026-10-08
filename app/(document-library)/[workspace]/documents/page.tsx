import { getTranslations } from "next-intl/server";
import { DocumentLibraryClient } from "@/components/dashboard/document-library/document-library-client";
import { requireDocumentApi } from "@/lib/document-library/access";
import { readDocumentLibrary } from "@/lib/document-library/repository";
import type { DocumentSelection } from "@/lib/document-library/model";

export async function generateMetadata() { const t = await getTranslations("Documents"); return { title: t("title") }; }
export default async function DocumentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { userId, supabase } = await requireDocumentApi();
  const params = await searchParams;
  const selection: DocumentSelection = { user: typeof params.user === "string" ? params.user : undefined, customer: typeof params.customer === "string" ? params.customer : undefined, folder: typeof params.folder === "string" ? params.folder : undefined, query: typeof params.query === "string" ? params.query : undefined, page: Number(params.page) || 1 };
  // 错误只交给资料区恢复，不能把内部数据库异常直接显示给用户。
  const initial = await readDocumentLibrary(supabase, selection).catch(() => null);
  return <DocumentLibraryClient initial={initial} selection={selection} userId={userId} />;
}
