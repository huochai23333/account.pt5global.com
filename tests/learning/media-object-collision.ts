import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { executeLearningSql } from "../../scripts/learning/local-fixture-session.mjs";

/**
 * 先登记本次子对象路径，再执行准备；准备中途失败时，调用方仍能准确回收。
 * 子对象只构造同名目录前缀，不登记媒体业务记录，也不修改共享对象。
 */
export function createMediaObjectCollision(
  user: { id: string; client: SupabaseClient },
  asset: { bucket_name: string; storage_path: string },
) {
  assert.equal(asset.bucket_name, "user-media");
  assert(asset.storage_path.startsWith(`${user.id}/`));
  const childPath = `${asset.storage_path}/learning-collision-${randomUUID()}.png`;
  const bucket = user.client.storage.from(asset.bucket_name);
  const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
  const childRows = () => Number(executeLearningSql(
    `select count(*) from storage.objects where bucket_id='user-media' and name=${quote(childPath)};`,
  ));

  return {
    childPath,
    async prepare(bytes: Buffer) {
      const uploaded = await bucket.upload(childPath, bytes, {
        contentType: "image/png", upsert: false,
      });
      assert.equal(uploaded.error, null);
      assert.equal(uploaded.data?.path, childPath);
      assert.equal(childRows(), 1);
      const prefix = asset.storage_path.slice(0, asset.storage_path.lastIndexOf("/"));
      const name = asset.storage_path.split("/").at(-1)!;
      const listing = await bucket.list(prefix, { search: name, limit: 100 });
      assert.equal(listing.error, null);
      assert(listing.data?.some(entry => entry.name === name && entry.id === null));
      assert(listing.data?.some(entry => entry.name === name && typeof entry.id === "string" && entry.id.length > 0));
      return listing.data.map(entry => ({ name: entry.name, id: entry.id }));
    },
    async cleanup() {
      // 只删除本次随机子对象；主媒体必须从页面删除或由原账号夹具的失败收尾处理。
      const removed = await bucket.remove([childPath]);
      assert.equal(removed.error, null);
      assert.equal(childRows(), 0);
      // 使用独立的目录断言，不复用本次正在修复的生产判断，避免两边犯同一个错误。
      const segments = childPath.split("/");
      const name = segments.pop()!;
      const listing = await bucket.list(segments.join("/"), { limit: 100 });
      assert.equal(listing.error, null);
      assert(Array.isArray(listing.data) && listing.data.length < 100, "回收目录读取不完整");
      assert(listing.data.every(entry => entry.name !== name || entry.id === null));
      return { childPath, childRows: 0, childListed: false };
    },
  };
}
