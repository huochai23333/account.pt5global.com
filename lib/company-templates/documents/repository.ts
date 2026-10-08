import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { withRequestTimeout } from "@/lib/request-timeout";
import { canonicalState, type DocumentMutation, type DocumentReceipt, type TemplateDocument, type TemplateDocumentSummary } from "./model";

const FIELDS = "id,name,template_name,template_id,template_version_id,revision,state_sha256,updated_at";
/** 始终使用当前用户客户端；RLS 不给管理员他人文档的特权。 */
export async function listTemplateDocuments(db: SupabaseClient, search = "", offset = 0) {
  let query = db.from("company_template_documents").select(FIELDS).order("updated_at", { ascending: false }).order("id").range(offset, offset + 49);
  if (search) query = query.ilike("name", `%${search.replace(/[\\%_]/g, "\\$&")}%`);
  const { data, error } = await withRequestTimeout(query);
  if (error) throw error;
  return (data ?? []) as TemplateDocumentSummary[];
}
export async function readTemplateDocument(db: SupabaseClient, id: string) {
  const { data, error } = await withRequestTimeout(db.from("company_template_documents").select(`${FIELDS},state`).eq("id", id).maybeSingle());
  if (error) throw error;
  return data as TemplateDocument | null;
}
export async function mutateTemplateDocument(db: SupabaseClient, input: DocumentMutation) {
  const { data, error } = await withRequestTimeout(db.rpc("mutate_company_template_document", { _request: input }));
  if (error) throw error;
  const receipt = data as DocumentReceipt | null;
  if (!receipt || receipt.document_id !== input.documentId || receipt.affected_rows !== 1) throw new Error("document_not_confirmed");
  const confirmed = await readTemplateDocument(db, input.documentId);
  if (!receipt.deleted && confirmed && confirmed.revision > receipt.revision) throw new Error("document_conflict");
  // 写入回执必须与独立查询一致，断线后重试也不能把已经删除或再次修改的内容显示为保存成功。
  if (receipt.deleted ? confirmed !== null : !confirmed || confirmed.revision !== receipt.revision || confirmed.state_sha256 !== receipt.state_sha256) throw new Error("document_not_confirmed");
  if (confirmed && input.state && canonicalState(confirmed.state) !== canonicalState(input.state)) throw new Error("document_not_confirmed");
  if (confirmed && input.name && confirmed.name !== input.name.trim()) throw new Error("document_not_confirmed");
  return { document: confirmed, receipt };
}
export async function readDocumentHtml(db: SupabaseClient, document: TemplateDocument, guide=false) {
  const { data, error } = await withRequestTimeout(db.from("company_template_versions").select("html_content,html_sha256,guide_html_content,guide_sha256").eq("id", document.template_version_id).eq("template_id", document.template_id).maybeSingle());
  if (error) throw error;
  const content=guide?data?.guide_html_content:data?.html_content;const hash=guide?data?.guide_sha256:data?.html_sha256;
  if(!content||!hash)throw new Error("document_missing");
  if (createHash("sha256").update(content, "utf8").digest("hex") !== hash) throw new Error("document_integrity");
  return content as string;
}
export async function hasDocumentGuide(db:SupabaseClient,document:TemplateDocument){const {data,error}=await db.from("company_template_versions").select("guide_sha256").eq("id",document.template_version_id).single();if(error)throw error;return Boolean(data.guide_sha256);}
