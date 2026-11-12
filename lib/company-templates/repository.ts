import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { withRequestTimeout } from "@/lib/request-timeout";

import type {
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

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
