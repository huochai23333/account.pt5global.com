import { QuoteEditor } from "@/components/dashboard/quotations/quote-editor";
import { requireQuoteWorkspace } from "@/lib/quotations/access";

export default async function Page({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;
  await requireQuoteWorkspace(workspace);
  return <QuoteEditor workspace={workspace} initial={null} />;
}
