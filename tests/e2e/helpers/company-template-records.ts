import type { SupabaseClient } from "@supabase/supabase-js";

/** 客户端由原套件显式提供；本文件不读取环境或建立新的认证入口。 */
export async function readTemplateBySlug(admin: SupabaseClient, slug: string) {
  const { data, error } = await admin
    .from("company_templates")
    .select("id,current_version_id,revision,status")
    .eq("slug", slug)
    .single();
  if (error) throw error;
  if (!data) throw new Error("company_template_test_record_missing");
  return data as {
    current_version_id: string;
    id: string;
    revision: number;
    status: string;
  };
}

export async function readVersion(admin: SupabaseClient, id: string) {
  const { data, error } = await admin
    .from("company_template_versions")
    .select("id,version_number,html_sha256,guide_sha256")
    .eq("id", id)
    .single();
  if (error) throw error;
  if (!data) throw new Error("company_template_test_version_missing");
  return data as {
    guide_sha256: string | null;
    html_sha256: string;
    id: string;
    version_number: number;
  };
}

async function countRows(
  admin: SupabaseClient,
  table: "company_templates" | "company_template_versions" | "company_template_documents",
  column: string,
  id: string,
) {
  const { count, error } = await admin
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(column, id);
  if (error) throw error;
  // 没拿到计数表示核对不完整，不能用 ?? 0 冒充没有记录。
  if (count === null || !Number.isSafeInteger(count) || count < 0)
    throw new Error("company_template_test_count_missing");
  return count;
}

export function countTemplates(admin: SupabaseClient, templateId: string) {
  return countRows(admin, "company_templates", "id", templateId);
}

export function countVersions(admin: SupabaseClient, templateId: string) {
  return countRows(
    admin,
    "company_template_versions",
    "template_id",
    templateId,
  );
}

function requireOne(data: { id: string }[] | null, templateId: string) {
  if (data?.length !== 1 || data[0].id !== templateId)
    throw new Error("company_template_test_cleanup_affected_mismatch");
}

function requireFixtureId(id: unknown): asserts id is string {
  if (typeof id !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))
    throw new Error("company_template_test_cleanup_id_invalid");
}

/** 文档必须属于本次模板；条件删除避免读取后归属变化时误删别的夹具，最后独立核对确已消失。 */
export async function deleteTemplateDocument(
  admin: SupabaseClient,
  documentId: string,
  templateId: string,
) {
  requireFixtureId(documentId);
  requireFixtureId(templateId);
  const existing = await admin
    .from("company_template_documents")
    .select("id,template_id")
    .eq("id", documentId)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) {
    if (existing.data.id !== documentId || existing.data.template_id !== templateId)
      throw new Error("company_template_test_cleanup_ownership_mismatch");
    const removed = await admin
      .from("company_template_documents")
      .delete()
      .eq("id", documentId)
      .eq("template_id", templateId)
      .select("id");
    if (removed.error) throw removed.error;
    requireOne(removed.data, documentId);
  }
  // 本来不存在时不声称执行过删除，但仍须取得明确的零行；空计数和迟到记录都不能通过。
  const remaining = await countRows(admin, "company_template_documents", "id", documentId);
  if (remaining !== 0) throw new Error("company_template_test_cleanup_failed");
  return { documentId, remainingDocuments: remaining };
}

/** 只回收调用方保存的专属 UUID；先断开当前版本外键，再删除并独立核对主表和版本。 */
export async function deleteTemplate(
  admin: SupabaseClient,
  templateId: string,
) {
  requireFixtureId(templateId);
  const existing = await admin
    .from("company_templates")
    .select("id")
    .eq("id", templateId)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) {
    if (existing.data.id !== templateId)
      throw new Error("company_template_test_cleanup_affected_mismatch");
    const cleared = await admin
      .from("company_templates")
      .update({ current_version_id: null })
      .eq("id", templateId)
      .select("id");
    if (cleared.error) throw cleared.error;
    requireOne(cleared.data, templateId);
    const removed = await admin
      .from("company_templates")
      .delete()
      .eq("id", templateId)
      .select("id");
    if (removed.error) throw removed.error;
    requireOne(removed.data, templateId);
  }
  // 夹具创建失败时可以本来就不存在，但仍须两个集合都确认为零，不宣称完成了一次写入。
  const templates = await countTemplates(admin, templateId);
  const versions = await countVersions(admin, templateId);
  if (templates !== 0 || versions !== 0)
    throw new Error("company_template_test_cleanup_failed");
}

/** 本次模板可能已经发布但编号读回失败，只能用带UUID的精确标记找回，不能按公共名称批量删除。 */
export async function deleteTemplateFixture(
  admin: SupabaseClient,
  fixture: { id?: string; name?: string },
) {
  let id = fixture.id;
  if (!id) {
    const name = fixture.name;
    if (!name || name.length <= 36) throw new Error("company_template_test_cleanup_marker_invalid");
    requireFixtureId(name.slice(-36));
    const found = await admin
      .from("company_templates")
      .select("id,name")
      .eq("name", name)
      .maybeSingle();
    if (found.error) throw found.error;
    if (!found.data) {
      if (await countRows(admin, "company_templates", "name", name) !== 0)
        throw new Error("company_template_test_cleanup_failed");
      return;
    }
    if (found.data.name !== name) throw new Error("company_template_test_cleanup_ownership_mismatch");
    id = found.data.id;
  }
  requireFixtureId(id);
  const documents = await admin
    .from("company_template_documents")
    .select("id")
    .eq("template_id", id);
  if (documents.error) throw documents.error;
  if (!Array.isArray(documents.data)) throw new Error("company_template_test_cleanup_documents_missing");
  // 这里只枚举本次专属模板。每个文档仍复用绑定条件删除，再核对集合，防止截断或迟到记录被漏掉。
  for (const document of documents.data) await deleteTemplateDocument(admin, document.id, id);
  if (await countRows(admin, "company_template_documents", "template_id", id) !== 0)
    throw new Error("company_template_test_cleanup_failed");
  await deleteTemplate(admin, id);
}
