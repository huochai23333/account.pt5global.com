import type { SupabaseClient } from "@supabase/supabase-js";
import { withRequestTimeout } from "@/lib/request-timeout";
import type { QuoteDocument, QuoteRow } from "./model";

export async function listQuotes(supabase: SupabaseClient): Promise<QuoteRow[]> {
  const rows: QuoteRow[] = [];
  const pageSize = 500;
  // 历史报价按页取全，避免固定 100 条上限导致旧报价从列表消失。
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await withRequestTimeout(supabase.from("quotations")
      .select("id,owner_id,status,content,revision,created_at,updated_at,completed_at")
      .order("updated_at", { ascending: false }).order("id", { ascending: false })
      .range(offset, offset + pageSize - 1));
    if (error) throw error;
    rows.push(...(data ?? []) as QuoteRow[]);
    if (!data || data.length < pageSize) return rows;
  }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  return JSON.stringify(value);
}
export async function getQuote(supabase: SupabaseClient, id: string): Promise<QuoteRow | null> {
  const { data, error } = await withRequestTimeout(supabase.from("quotations")
    .select("id,owner_id,status,content,revision,created_at,updated_at,completed_at")
    .eq("id", id).maybeSingle<QuoteRow>());
  if (error) throw error;
  return data;
}
export async function saveQuote(
  supabase: SupabaseClient, id: string, revision: number | null,
  status: "draft" | "completed", content: QuoteDocument,
): Promise<QuoteRow> {
  const { data, error } = await withRequestTimeout(supabase.rpc("save_quotation", {
    _id: id, _expected_revision: revision, _status: status, _content: content,
  }), { timeoutMs: 30_000 });
  if (error) throw error;
  const receipt = data as QuoteRow | null;
  if (receipt?.id !== id || receipt.revision !== (revision ?? 0) + 1 || receipt.status !== status) {
    throw new Error("quotation_save_receipt_invalid");
  }
  // 写入响应之外重新读取权威记录，拦住返回 200 却没有实际更新的情况。
  const confirmed = await getQuote(supabase, receipt.id);
  if (!confirmed || confirmed.revision !== receipt.revision || confirmed.status !== status
    || confirmed.owner_id !== receipt.owner_id || stableJson(confirmed.content) !== stableJson(content))
    throw new Error("quotation_save_not_confirmed");
  return confirmed;
}
export async function deleteQuote(supabase: SupabaseClient, row: QuoteRow) {
  const { data, error } = await withRequestTimeout(supabase.rpc("delete_quotation", {
    _id: row.id, _expected_revision: row.revision,
  }), { timeoutMs: 30_000 });
  if (error) throw error;
  if (data !== row.id || await getQuote(supabase, row.id)) throw new Error("quotation_delete_not_confirmed");
}
