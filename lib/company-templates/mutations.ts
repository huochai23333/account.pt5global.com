import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { withRequestTimeout } from "@/lib/request-timeout";

import type { CompanyTemplatePublishReceipt, CompanyTemplateStateReceipt } from "./model";

export async function publishCompanyTemplateVersion(
  supabase: SupabaseClient,
  input: {
    description: string;
    expectedRevision: number | null;
    guideContent: string | null;
    guideFilename: string | null;
    htmlContent: string;
    name: string;
    slug: string;
    sourceFilename: string;
    templateId: string;
    versionId: string;
  },
) {
  // 写入 RPC 在同一事务内创建版本并切换当前指针；expectedRevision 用来拒绝覆盖别人刚发布的版本。
  const { data, error } = await withRequestTimeout(supabase.rpc("publish_company_template_version", {
    _description: input.description,
    _expected_revision: input.expectedRevision,
    _guide_html_content: input.guideContent,
    _guide_source_filename: input.guideFilename,
    _html_content: input.htmlContent,
    _name: input.name,
    _slug: input.slug,
    _source_filename: input.sourceFilename,
    _template_id: input.templateId,
    _version_id: input.versionId,
  }), { timeoutMs: 30_000 });
  if (error) throw error;
  const receipt = firstRow<CompanyTemplatePublishReceipt>(data);
  const expectedHtmlHash = createHash("sha256").update(input.htmlContent, "utf8").digest("hex");
  if (!receipt || receipt.template_id !== input.templateId || receipt.version_id !== input.versionId
    || receipt.html_sha256 !== expectedHtmlHash || receipt.status !== "active"
    || receipt.revision !== (input.expectedRevision ?? 0) + 1) {
    throw new Error("company_template_publish_receipt_invalid");
  }

  // RPC 返回成功还不够：再用独立查询核对当前指针、修订号和内容哈希，防止 0 行更新或错误回执冒充成功。
  const confirmed = await getPublishedVersion(supabase, input.templateId, input.versionId);
  if (!confirmed || confirmed.template.revision !== receipt.revision || confirmed.template.status !== "active"
    || confirmed.template.current_version_id !== input.versionId
    || confirmed.version.html_sha256 !== expectedHtmlHash
    || confirmed.version.guide_sha256 !== receipt.guide_sha256) {
    throw new Error("company_template_publish_not_confirmed");
  }
  return receipt;
}

export async function activateCompanyTemplateVersion(
  supabase: SupabaseClient,
  templateId: string,
  versionId: string,
  expectedRevision: number,
) {
  // 历史版本不可改写；回退只改变模板的 current_version_id，并生成新的模板修订号。
  const { data, error } = await withRequestTimeout(supabase.rpc("activate_company_template_version", {
    _expected_revision: expectedRevision,
    _template_id: templateId,
    _version_id: versionId,
  }), { timeoutMs: 30_000 });
  if (error) throw error;
  const receipt = firstRow<CompanyTemplateStateReceipt>(data);
  const confirmed = receipt ? await getPublishedVersion(supabase, templateId, versionId) : null;
  if (!receipt || receipt.template_id !== templateId || receipt.version_id !== versionId
    || receipt.status !== "active" || receipt.revision !== expectedRevision + 1
    || !confirmed || receipt.revision !== confirmed.template.revision
    || confirmed.template.current_version_id !== versionId || confirmed.template.status !== "active") {
    throw new Error("company_template_activate_not_confirmed");
  }
  return receipt;
}

export async function setCompanyTemplateStatus(
  supabase: SupabaseClient,
  templateId: string,
  active: boolean,
  expectedRevision: number,
) {
  // 启停后重新读取模板主记录，页面显示的状态必须与数据库最终状态一致。
  const { data, error } = await withRequestTimeout(supabase.rpc("set_company_template_status", {
    _active: active,
    _expected_revision: expectedRevision,
    _template_id: templateId,
  }), { timeoutMs: 30_000 });
  if (error) throw error;
  const receipt = firstRow<CompanyTemplateStateReceipt>(data);
  const { data: confirmed, error: readError } = await withRequestTimeout(
    supabase.from("company_templates")
      .select("id,revision,status,current_version_id").eq("id", templateId).maybeSingle(),
  );
  if (readError) throw readError;
  if (!receipt || receipt.template_id !== templateId || receipt.revision !== expectedRevision + 1
    || !confirmed || confirmed.revision !== receipt.revision || confirmed.status !== receipt.status
    || confirmed.current_version_id !== receipt.version_id
    || confirmed.status !== (active ? "active" : "inactive")) {
    throw new Error("company_template_status_not_confirmed");
  }
  return receipt;
}

async function getPublishedVersion(supabase: SupabaseClient, templateId: string, versionId: string) {
  const [templateResult, versionResult] = await Promise.all([
    withRequestTimeout(supabase.from("company_templates")
      .select("id,current_version_id,revision,status").eq("id", templateId).maybeSingle()),
    withRequestTimeout(supabase.from("company_template_versions")
      .select("html_sha256,guide_sha256").eq("template_id", templateId).eq("id", versionId).maybeSingle()),
  ]);
  if (templateResult.error) throw templateResult.error;
  if (versionResult.error) throw versionResult.error;
  return templateResult.data && versionResult.data
    ? { template: templateResult.data, version: versionResult.data }
    : null;
}

function firstRow<T>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] as T | undefined) ?? null;
  return value && typeof value === "object" ? value as T : null;
}
