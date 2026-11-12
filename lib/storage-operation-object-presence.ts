import type { SupabaseClient } from "@supabase/supabase-js";

type StorageDirectory = Pick<ReturnType<SupabaseClient["storage"]["from"]>, "list">;

/** 列表读取成功且完整时，才能区分对象不存在、读取失败和返回了同名目录。 */
export async function readStorageObjectPresence(bucket: StorageDirectory, path: string) {
  const segments = path.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error("附件路径无法核对。");
  }

  const name = segments.pop()!;
  const folder = segments.join("/");
  const limit = 100;
  for (let offset = 0; offset < 10_000; offset += limit) {
    const { data, error } = await bucket.list(folder, {
      search: name,
      limit,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error("附件目录没有确认读取。");
    for (const entry of data) {
      // 同名目录可能排在同名对象前面。只跳过目录占位，继续查真实对象。
      if (entry.name !== name || entry.id === null) continue;
      if (typeof entry.id === "string" && entry.id.length > 0) return true;
      throw new Error("附件身份无法核对。");
    }
    if (data.length < limit) return false;
  }
  // 达到上限意味着还可能有未读结果，不能据此清除数据库登记。
  throw new Error("附件目录暂时无法完整核对。");
}
