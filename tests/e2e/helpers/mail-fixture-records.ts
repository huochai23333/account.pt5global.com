import type { SupabaseClient } from "@supabase/supabase-js";

type FixtureRow = Record<string, unknown>;

function recordKeys(rows: unknown[], key: string) {
  // 动态 select 无法静态推导字段，返回值先按未知数据验证，不能强行当作正确记录。
  const values = rows.map((row) =>
    row && typeof row === "object" && !Array.isArray(row)
      ? (row as FixtureRow)[key]
      : undefined,
  );
  if (
    values.some((value) => typeof value !== "string" || !value) ||
    new Set(values).size !== values.length
  ) {
    throw new Error("邮件夹具缺少唯一凭证，不能继续写入。");
  }
  return (values as string[]).sort();
}

/** 插入先核对返回的目标编号，再独立查询同一组编号；无异常不等于记录真的建立。 */
export async function insertMailFixtureRecords(
  client: SupabaseClient,
  table: string,
  input: FixtureRow | FixtureRow[],
  key = "id",
) {
  const rows = Array.isArray(input) ? input : [input];
  if (rows.length === 0) return;
  const expected = recordKeys(rows, key);
  const inserted = await client.from(table).insert(input).select(key);
  if (inserted.error)
    throw new Error(`邮件夹具写入失败：${table}`, { cause: inserted.error });
  if (
    JSON.stringify(recordKeys(inserted.data ?? [], key)) !==
    JSON.stringify(expected)
  ) {
    throw new Error(`邮件夹具写入凭证不完整：${table}`);
  }
  const proof = await client.from(table).select(key).in(key, expected);
  if (proof.error)
    throw new Error(`邮件夹具核对失败：${table}`, { cause: proof.error });
  if (
    JSON.stringify(recordKeys(proof.data ?? [], key)) !==
    JSON.stringify(expected)
  ) {
    throw new Error(`邮件夹具未能独立查回：${table}`);
  }
}

/** 整表重建只供专属完整实例；允许本来为空，但必须有影响数，并独立确认无残留。 */
export async function clearMailFixtureTable(
  client: SupabaseClient,
  table: string,
  key: string,
) {
  const removed = await client
    .from(table)
    .delete({ count: "exact" })
    .not(key, "is", null);
  if (removed.error)
    throw new Error(`邮件夹具清理失败：${table}`, { cause: removed.error });
  if (
    !Number.isInteger(removed.count) ||
    removed.count === null ||
    removed.count < 0
  ) {
    throw new Error(`邮件夹具清理缺少影响数：${table}`);
  }
  const remaining = await client
    .from(table)
    .select(key, { count: "exact", head: true });
  if (remaining.error)
    throw new Error(`邮件夹具清理核对失败：${table}`, {
      cause: remaining.error,
    });
  if (remaining.count !== 0) throw new Error(`邮件夹具仍有残留：${table}`);
  return removed.count;
}
