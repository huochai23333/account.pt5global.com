import { notFound } from "next/navigation";
import { QuoteEditor } from "@/components/dashboard/quotations/quote-editor";
import { requireQuoteWorkspace } from "@/lib/quotations/access";
import { getQuote } from "@/lib/quotations/repository";
import { getServerSupabaseClient } from "@/lib/supabase-server";

export default async function Page({ params }: { params: Promise<{ workspace: string; quoteId: string }> }) {
  const { workspace, quoteId } = await params;
  await requireQuoteWorkspace(workspace);
  const quote = await getQuote(await getServerSupabaseClient(), quoteId);
  if (!quote) notFound();
  return <QuoteEditor workspace={workspace} initial={quote} />;
}
