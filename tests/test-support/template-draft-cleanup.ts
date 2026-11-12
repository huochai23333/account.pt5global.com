import { randomUUID } from "node:crypto";

type ExecuteSql = (statement: string) => string;
type Row = { record: { owner_id: string }; version: string };
type Snapshot = Record<string, Row[]>;
const quote = (value: string) => "'" + value.replaceAll("'", "''") + "'";
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

/** 仅回收页面已登记的本次编号；先停页面写入，再传入创建时捕获的真实owner。 */
export function cleanupTemplateDraftRecords(ids: string[], ownerId: string, execute: ExecuteSql) {
  if (!uuid.test(ownerId) || ids.some((id) => !uuid.test(id)))
    throw new Error("draft_cleanup_identity_invalid");
  const unique = [...new Set(ids)];
  if (!unique.length) return { deleted: {}, alreadyAbsent: true };
  const idList = unique.map(quote).join(",");
  const targets = [
    ["company_template_draft_operations", `draft_id in (${idList})`],
    ["company_template_document_operations", `receipt->>'document_id' in (${idList})`],
    ["company_template_document_drafts", `id in (${idList})`],
    ["company_template_documents", `id in (${idList})`],
  ];
  const fingerprint =
    "jsonb_build_object(" +
    targets
      .map(
        ([table, where]) =>
          `${quote(table)},(select coalesce(jsonb_agg(jsonb_build_object('record',to_jsonb(r),'version',r.xmin::text) order by to_jsonb(r)::text),'[]') from public.${table} r where ${where})`,
      )
      .join(",") +
    ")";
  const before: Snapshot = JSON.parse(execute(`select ${fingerprint};`));
  for (const [table] of targets) {
    if (!Array.isArray(before[table])) throw new Error("draft_cleanup_snapshot_invalid");
    if (before[table].some((row) => row.record?.owner_id !== ownerId || typeof row.version !== "string"))
      throw new Error("draft_cleanup_ownership_changed");
  }
  const expectedCounts = Object.fromEntries(targets.map(([table]) => [table, before[table].length]));
  const token = randomUUID().replaceAll("-", "");
  // 快照作为普通SQL字面量存入临时表，不能把文档正文直接拼进DO的美元引号中。
  const commands = targets
    .map(
      ([table, where]) => `
    delete from public.${table} where ${where} and owner_id='${ownerId}'::uuid;
    get diagnostics changed=row_count;
    if changed<>${expectedCounts[table]} then raise exception 'draft_cleanup_affected_mismatch'; end if;`,
    )
    .join("\n");
  const result = execute(`begin;
    lock table ${targets.map(([table]) => "public." + table).join(",")} in share row exclusive mode;
    create temp table draft_expected_${token} on commit drop as select ${quote(JSON.stringify(before))}::jsonb value;
    do $$ declare changed integer; begin
      if ${fingerprint} is distinct from (select value from pg_temp.draft_expected_${token}) then
        raise exception 'draft_cleanup_version_changed';
      end if;
      ${commands}
    end $$;
    select ${quote(JSON.stringify(expectedCounts))}::jsonb;
    commit;`);
  const deleted = JSON.parse(result);
  if (
    JSON.stringify(deleted, Object.keys(deleted).sort()) !==
    JSON.stringify(expectedCounts, Object.keys(expectedCounts).sort())
  )
    throw new Error("draft_cleanup_receipt_invalid");
  const after: Snapshot = JSON.parse(execute(`select ${fingerprint};`));
  if (targets.some(([table]) => !Array.isArray(after[table]) || after[table].length !== 0))
    throw new Error("draft_cleanup_not_final");
  return { deleted, alreadyAbsent: Object.values(expectedCounts).every((count) => count === 0) };
}
