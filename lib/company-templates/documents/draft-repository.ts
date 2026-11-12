import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { withRequestTimeout } from "@/lib/request-timeout";
import type { DraftReceipt, TemplateDraft, DraftSummary } from "./draft-model";
import { readTemplateDocument } from "./repository";
const SUMMARY =
  "id,owner_id,template_id,template_version_id,template_name,name,preferred_folder_id,revision,updated_at";
/** 使用当前账号客户端，RLS 在计数、分页及正文前过滤，管理员也不能读取其他人的草稿。 */
export async function listDrafts(db: SupabaseClient, search = "", page = 1) {
  let query = db
    .from("company_template_document_drafts")
    .select(SUMMARY, { count: "exact" })
    .order("updated_at", { ascending: false })
    .order("id")
    .range((page - 1) * 20, page * 20 - 1);
  if (search)
    query = query.ilike("name", `%${search.replace(/[\\%_]/g, "\\$&")}%`);
  const { data, count, error } = await withRequestTimeout(query);
  if (error) throw error;
  return { drafts: (data ?? []) as DraftSummary[], total: count ?? 0, page };
}
export async function readDraft(db: SupabaseClient, id: string) {
  const { data, error } = await withRequestTimeout(
    db
      .from("company_template_document_drafts")
      .select(`${SUMMARY},state,state_sha256`)
      .eq("id", id)
      .maybeSingle(),
  );
  if (error) throw error;
  return data as TemplateDraft | null;
}
/** 转正后原地址通过原凭证显示结果，不能因草稿已移除就猜测创建成功。 */
export async function readPromotedDraft(db: SupabaseClient, id: string) {
  const { data, error } = await withRequestTimeout(
    db
      .from("company_template_draft_operations")
      .select("receipt")
      .eq("draft_id", id)
      .eq("receipt->>action", "promote")
      .limit(1)
      .maybeSingle(),
  );
  if (error) throw error;
  const receipt = data?.receipt as DraftReceipt | undefined;
  if (!receipt) return null;
  if (
    receipt.action !== "promote" ||
    receipt.draft_id !== id ||
    receipt.document_id !== id ||
    receipt.affected_rows !== 1
  ) {
    throw new Error("document_not_confirmed");
  }
  return readTemplateDocument(db, id);
}
