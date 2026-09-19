import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { withRequestTimeout } from "@/lib/request-timeout";

import type {
  CompanyTemplatePublishReceipt,
  CompanyTemplateStateReceipt,
  CompanyTemplateSummary,
  CompanyTemplateVersion,
} from "./model";

type TemplateRow = {
  current_version_id: string | null;
  description: string;
  id: string;
  name: string;
  revision: number;
  slug: string;
  status: "active" | "inactive";
  updated_at: string;
};

const VERSION_FIELDS = "id,template_id,version_number,source_filename,guide_source_filename,html_sha256,guide_sha256,published_by,published_at";

/**
 * RLS 会决定当前账号能看到哪些记录：员工只得到启用模板的当前版本，管理员额外得到停用模板和版本历史。
 * 这里分两次查询是为了让列表响应保持轻量，HTML 正文本身只在打开查看器后读取。
 */
export async function listCompanyTemplates(supabase: SupabaseClient): Promise<CompanyTemplateSummary[]> {
  const { data: templates, error: templateError } = await withRequestTimeout(
    supabase.from("company_templates")
      .select("id,slug,name,description,status,current_version_id,revision,updated_at")
      .order("updated_at", { ascending: false }),
  );
  if (templateError) throw templateError;
  const templateRows = (templates ?? []) as TemplateRow[];
  if (templateRows.length === 0) return [];

  const { data: versions, error: versionError } = await withRequestTimeout(
    supabase.from("company_template_versions").select(VERSION_FIELDS)
      .in("template_id", templateRows.map((item) => item.id))
      .order("version_number", { ascending: false }),
  );
  if (versionError) throw versionError;
  const versionRows = (versions ?? []) as CompanyTemplateVersion[];

  return templateRows.flatMap((template) => {
    const matching = versionRows.filter((version) => version.template_id === template.id);
    const currentVersion = matching.find((version) => version.id === template.current_version_id);
    return currentVersion ? [{ ...template, currentVersion, versions: matching }] : [];
  });
}

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
  const expectedHtmlHash = sha256(input.htmlContent);
  if (!receipt || receipt.template_id !== input.templateId || receipt.version_id !== input.versionId
    || receipt.html_sha256 !== expectedHtmlHash || receipt.status !== "active") {
    throw new Error("company_template_publish_receipt_invalid");
  }

  // RPC 返回成功还不够：再用独立查询核对当前指针、修订号和内容哈希，防止 0 行更新或错误回执冒充成功。
  const confirmed = await getPublishedVersion(supabase, input.templateId, input.versionId);
  if (!confirmed || confirmed.template.revision !== receipt.revision
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
  if (!receipt || !confirmed || receipt.revision !== confirmed.template.revision
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
  const { data: confirmed, error: readError } = await supabase.from("company_templates")
    .select("id,revision,status,current_version_id").eq("id", templateId).maybeSingle();
  if (readError) throw readError;
  if (!receipt || !confirmed || confirmed.revision !== receipt.revision
    || confirmed.status !== (active ? "active" : "inactive")) {
    throw new Error("company_template_status_not_confirmed");
  }
  return receipt;
}

export async function getCompanyTemplateDocument(
  supabase: SupabaseClient,
  templateId: string,
  options: { guide: boolean; versionId?: string | null },
) {
  // 普通员工始终读取当前版本；只有已通过管理员权限检查的调用方才能显式预览历史版本。
  const { data: template, error: templateError } = await supabase.from("company_templates")
    .select("id,status,current_version_id").eq("id", templateId).maybeSingle();
  if (templateError) throw templateError;
  if (!template) return null;
  const versionId = options.versionId ?? template.current_version_id;
  if (!versionId) return null;
  const fields = options.guide ? "id,guide_html_content,guide_sha256" : "id,html_content,html_sha256";
  const { data: version, error: versionError } = await supabase.from("company_template_versions")
    .select(fields).eq("template_id", templateId).eq("id", versionId).maybeSingle();
  if (versionError) throw versionError;
  if (!version) return null;
  const content = options.guide
    ? (version as { guide_html_content: string | null }).guide_html_content
    : (version as { html_content: string }).html_content;
  const hash = options.guide
    ? (version as { guide_sha256: string | null }).guide_sha256
    : (version as { html_sha256: string }).html_sha256;
  // 返回 HTML 前重新计算哈希。数据库内容和发布哈希不一致时返回失败页面，不执行可能被篡改的脚本。
  if (!content || !hash || sha256(content) !== hash) throw new Error("company_template_content_integrity_failed");
  return { content, hash, versionId };
}

async function getPublishedVersion(supabase: SupabaseClient, templateId: string, versionId: string) {
  const [templateResult, versionResult] = await Promise.all([
    supabase.from("company_templates").select("id,current_version_id,revision,status").eq("id", templateId).maybeSingle(),
    supabase.from("company_template_versions").select(VERSION_FIELDS).eq("id", versionId).maybeSingle(),
  ]);
  if (templateResult.error) throw templateResult.error;
  if (versionResult.error) throw versionResult.error;
  return templateResult.data && versionResult.data
    ? { template: templateResult.data, version: versionResult.data as CompanyTemplateVersion }
    : null;
}

function firstRow<T>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] as T | undefined) ?? null;
  return value && typeof value === "object" ? value as T : null;
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
