import type { SupabaseClient } from "@supabase/supabase-js";

export type FixtureTable =
  | "document_folders"
  | "document_files"
  | "company_template_documents"
  | "document_batches"
  | "document_operations";
export type FixtureRow = { id: string };
export type FixtureBatch = FixtureRow & {
  actor_id: string;
  manifest: {
    id: string;
    kind: string;
    version: number;
    anchor?: string;
    folderId?: string;
    record: Record<string, unknown>;
  }[];
  request: Record<string, unknown>;
};
export interface DocumentFixtureStore {
  listRows<T extends FixtureRow>(
    table: FixtureTable,
    columns: string,
  ): Promise<T[]>;
  releaseBatch(batch: FixtureBatch): Promise<void>;
  removeObject(path: string): Promise<void>;
  deleteRows(table: FixtureTable, ids: string[]): Promise<void>;
}

/** 只接受调用者已经取得的能力；本模块不读取环境或建立认证会话。 */
export function createDocumentFixtureStore(
  admin: SupabaseClient,
  readerForActor: (actorId: string) => Promise<SupabaseClient>,
  readObjectPresence: (
    bucket: ReturnType<SupabaseClient["storage"]["from"]>,
    path: string,
  ) => Promise<boolean>,
): DocumentFixtureStore {
  async function requireZero(
    query: PromiseLike<{ error: unknown; count: number | null }>,
  ) {
    const { error, count } = await query;
    if (error) throw error;
    if (count !== 0) throw new Error("fixture_cleanup_not_confirmed");
  }
  return {
    async listRows<T extends FixtureRow>(table: FixtureTable, columns: string) {
      const rows: T[] = [];
      let cursor = "";
      // UUID 主键分页不受默认一千行截断影响，读取错误不能变成“没有记录”。
      while (true) {
        let query = admin.from(table).select(columns).order("id").limit(200);
        if (cursor) query = query.gt("id", cursor);
        const { data, error } = await query;
        if (error) throw error;
        if (!Array.isArray(data))
          throw new Error("fixture_read_result_missing");
        const page = data as unknown as T[];
        rows.push(...page);
        if (page.length < 200) return rows;
        const next = page.at(-1)?.id;
        if (!next || next <= cursor)
          throw new Error("fixture_read_no_progress");
        cursor = next;
      }
    },
    async releaseBatch(batch) {
      const reader = await readerForActor(batch.actor_id);
      const { error } = await reader.rpc("document_batch_release", {
        p_id: batch.id,
      });
      if (error) throw error;
      const result = await admin
        .from("document_batches")
        .select("request")
        .eq("id", batch.id)
        .single();
      if (result.error) throw result.error;
      if (result.data?.request?.released !== true)
        throw new Error("fixture_batch_release_not_confirmed");
      await requireZero(
        admin
          .from("document_folders")
          .select("id", { count: "exact", head: true })
          .eq("delete_batch_id", batch.id),
      );
    },
    async removeObject(path) {
      if (!path) throw new Error("fixture_storage_path_missing");
      const bucket = admin.storage.from("document-library");
      const removed = await bucket.remove([path]);
      if (removed.error) throw removed.error;
      // 复用完整目录读取：当前 SDK 的 exists 会把部分 HTTP 错误包装成 false，
      // 不能把无效路径或失败响应当成删除凭证。
      if (await readObjectPresence(bucket, path))
        throw new Error("fixture_storage_delete_not_confirmed");
    },
    async deleteRows(table, ids) {
      const unique = [...new Set(ids)];
      // 限制 URL 中的编号数量；每批都核对真实影响集合和独立的零行结果。
      for (let start = 0; start < unique.length; start += 100) {
        const part = unique.slice(start, start + 100);
        const result = await admin
          .from(table)
          .delete()
          .in("id", part)
          .select("id");
        if (result.error) throw result.error;
        const affected = result.data
          ?.map((row: { id: string }) => row.id)
          .sort();
        if (JSON.stringify(affected) !== JSON.stringify([...part].sort()))
          throw new Error("fixture_delete_affected_mismatch");
        await requireZero(
          admin
            .from(table)
            .select("id", { count: "exact", head: true })
            .in("id", part),
        );
      }
    },
  };
}
