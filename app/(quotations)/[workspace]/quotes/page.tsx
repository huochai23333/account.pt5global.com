import { QuoteList } from "@/components/dashboard/quotations/quote-list";
import { requireQuoteWorkspace } from "@/lib/quotations/access";
import { listQuotes } from "@/lib/quotations/repository";
import { getServerSupabaseClient } from "@/lib/supabase-server";

export default async function Page({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;
  await requireQuoteWorkspace(workspace);
  return <QuoteList workspace={workspace} initial={await listQuotes(await getServerSupabaseClient())} />;
}
