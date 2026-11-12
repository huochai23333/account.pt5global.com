import type { SupabaseClient } from "@supabase/supabase-js";

const scopes = [
  {
    table: "company_template_draft_operations",
    filter: "draft_id",
    key: "operation_id",
  },
  {
    table: "company_template_document_operations",
    filter: "receipt->>document_id",
    key: "operation_id",
  },
  { table: "company_template_document_drafts", filter: "id", key: "id" },
  { table: "company_template_documents", filter: "id", key: "id" },
] as const;
type Scope = (typeof scopes)[number];

async function countScope(admin: SupabaseClient, scope: Scope, ids: string[]) {
  const result = await admin
    .from(scope.table)
    .select(scope.key, { count: "exact", head: true })
    .in(scope.filter, ids);
  if (result.error) throw result.error;
  if (
    result.count === null ||
    !Number.isSafeInteger(result.count) ||
    result.count < 0
  )
    throw new Error("template_document_fixture_count_missing");
  return result.count;
}

/** 只回收用例保存的草稿/正式文档编号；原客户端由调用者提供，不寻找认证入口。 */
export async function cleanupTemplateDocumentFixtures(
  admin: SupabaseClient,
  values: string[],
) {
  const ids = [...new Set(values)];
  if (
    ids.some(
      (id) =>
        typeof id !== "string" ||
        !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
          id,
        ),
    )
  )
    throw new Error("template_document_fixture_id_invalid");
  // 创建前失败可以没有编号，但不能由空集合退化成全表清理。
  if (!ids.length) return;
  for (let start = 0; start < ids.length; start += 50) {
    const part = ids.slice(start, start + 50);
    // 操作回执本来就不随正文级联删除，先按 draft_id 或 receipt.document_id 明确定位。
    for (const scope of scopes) {
      const before = await countScope(admin, scope, part);
      if (before > 0) {
        const removed = await admin
          .from(scope.table)
          .delete({ count: "exact" })
          .in(scope.filter, part);
        if (removed.error) throw removed.error;
        if (removed.count !== before)
          throw new Error("template_document_fixture_affected_mismatch");
      }
      if (await countScope(admin, scope, part))
        throw new Error("template_document_fixture_remaining");
    }
    // 捕获清理期间异步保存产生的回执；尚未核对为空时必须让原用例失败。
    for (const scope of scopes) {
      if (await countScope(admin, scope, part))
        throw new Error("template_document_fixture_remaining");
    }
  }
}
