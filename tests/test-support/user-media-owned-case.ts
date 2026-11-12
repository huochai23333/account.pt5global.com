import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

export type MediaReceipt = Record<string, unknown> & {
  id: string;
  user_id: string;
  original_name: string;
  bucket_name: string;
  storage_path: string;
  _xmin: string;
};
export type MediaObject = Record<string, unknown> & {
  id: string;
  name: string;
  bucket_id: string;
  version: string;
};
export type MediaSnapshot = {
  assets: MediaReceipt[];
  objects: MediaObject[];
  reviews: Record<string, unknown>[];
};
export type MediaScope = {
  userId: string;
  fileName: string;
  assetIds: string[];
  objectIds: string[];
  reviewIds: string[];
  paths: string[];
};
export type MediaCasePorts = {
  read: (scope: MediaScope) => Promise<MediaSnapshot>;
  download: (path: string) => Promise<Uint8Array>;
  present: (path: string) => Promise<boolean>;
  remove: (path: string) => Promise<void>;
  deleteRows: (snapshot: MediaSnapshot) => Promise<string[]>;
};
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const hash = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

/** 上传前登记唯一文件意图；只接受显式能力，不找账号/容器，不允许按旧前缀清空媒体。 */
export function createOwnedUserMediaCase(
  ports: MediaCasePorts,
  userId: string,
  fileName: string,
  bytes: Uint8Array,
) {
  const fileId = /^user-media-receipt-([a-f0-9-]{36})\.png$/i.exec(
    fileName,
  )?.[1];
  if (!uuid.test(userId) || !fileId || !uuid.test(fileId) || bytes.length === 0)
    throw new Error("media_case_identity_invalid");
  const scope: MediaScope = {
    userId,
    fileName,
    assetIds: [],
    objectIds: [],
    reviewIds: [],
    paths: [],
  };
  const expectedSize = bytes.length,
    expectedSha256 = hash(bytes);
  let last: MediaSnapshot | undefined,
    cleanupAttempted = false,
    cleaned = false;
  let stage = "registered";
  async function read() {
    const value = await ports.read(structuredClone(scope));
    if (
      !Array.isArray(value?.assets) ||
      !Array.isArray(value?.objects) ||
      !Array.isArray(value?.reviews)
    )
      throw new Error("media_case_snapshot_invalid");
    // 先记住已经看到的稳定编号/路径；随后改名或关联被改，下一次也必须能发现。
    for (const a of value.assets) {
      if (uuid.test(a.id) && !scope.assetIds.includes(a.id))
        scope.assetIds.push(a.id);
      if (
        typeof a.storage_path === "string" &&
        !scope.paths.includes(a.storage_path)
      )
        scope.paths.push(a.storage_path);
    }
    for (const o of value.objects) {
      if (uuid.test(o.id) && !scope.objectIds.includes(o.id))
        scope.objectIds.push(o.id);
      if (typeof o.name === "string" && !scope.paths.includes(o.name))
        scope.paths.push(o.name);
    }
    for (const review of value.reviews) {
      if (
        typeof review.id === "string" &&
        uuid.test(review.id) &&
        !scope.reviewIds.includes(review.id)
      )
        scope.reviewIds.push(review.id);
    }
    return value;
  }
  async function validate(value: MediaSnapshot, requireAsset: boolean) {
    if (
      value.reviews.length !== value.assets.length ||
      value.reviews.some(
        (r) =>
          r.asset_id !== value.assets[0]?.id ||
          !uuid.test(String(r.id)) ||
          !/^\d+$/.test(String(r._xmin)),
      )
    )
      throw new Error("media_case_review_scope_invalid");
    // 队列存在不是审核终态；先等本地评估结束，避免清理与正在处理的审核并发。
    if (
      value.reviews.some(
        (r) => !["completed", "failed"].includes(String(r.status)),
      )
    )
      throw new Error("media_case_review_not_terminal");
    if (
      value.reviews.some(
        (r) =>
          r.status === "completed" &&
          (!["manual_review", "auto_pass"].includes(String(r.decision)) ||
            !Number.isFinite(Date.parse(String(r.completed_at)))),
      )
    )
      throw new Error("media_case_review_receipt_invalid");
    if (requireAsset && value.reviews.some((r) => r.status === "failed"))
      throw new Error("media_case_review_failed");
    if (
      value.assets.length > 1 ||
      value.objects.length > 1 ||
      (requireAsset && value.assets.length !== 1)
    )
      throw new Error("media_case_scope_count");
    const path = value.objects[0]?.name ?? value.assets[0]?.storage_path;
    const prefix = `${userId}/image/`,
      suffix = `-${fileName}`;
    if (
      path &&
      (!path.startsWith(prefix) ||
        !path.endsWith(suffix) ||
        !uuid.test(path.slice(prefix.length, -suffix.length)))
    )
      throw new Error("media_case_path_mismatch");
    for (const a of value.assets) {
      if (
        !uuid.test(a.id) ||
        a.user_id !== userId ||
        a.original_name !== fileName ||
        a.bucket_name !== "user-media" ||
        a.storage_path !== path ||
        a.kind !== "image" ||
        a.mime_type !== "image/png" ||
        Number(a.file_size_bytes) !== expectedSize ||
        !/^\d+$/.test(a._xmin)
      )
        throw new Error("media_case_asset_mismatch");
    }
    for (const o of value.objects) {
      if (
        !o.metadata ||
        typeof o.metadata !== "object" ||
        Number((o.metadata as Record<string, unknown>).size) !== expectedSize
      )
        throw new Error("media_case_object_size_mismatch");
      if (
        !uuid.test(o.id) ||
        o.bucket_id !== "user-media" ||
        !o.version ||
        o.name !== path
      )
        throw new Error("media_case_object_mismatch");
      if (!(await ports.present(o.name)))
        throw new Error("media_case_object_not_present");
      const content = await ports.download(o.name);
      if (content.length !== expectedSize || hash(content) !== expectedSha256)
        throw new Error("media_case_content_mismatch");
    }
    if (value.assets.length && value.objects.length !== 1)
      throw new Error("media_case_object_missing");
  }
  return {
    fileName,
    async uploaded() {
      const value = await read();
      await validate(value, true);
      // 下载核对不能改变所保护的记录/对象内容版本；否则保留为未确认。
      if (!isDeepStrictEqual(await read(), value))
        throw new Error("media_case_changed_during_verification");
      last = value;
      stage = "uploaded";
      return structuredClone(value.assets[0]);
    },
    async unchanged() {
      if (!last) throw new Error("media_case_upload_not_confirmed");
      const value = await read();
      if (!isDeepStrictEqual(value, last))
        throw new Error("media_case_changed");
      await validate(value, true);
    },
    async missing() {
      const value = await read();
      if (value.assets.length || value.objects.length || value.reviews.length)
        throw new Error("media_case_not_deleted");
      for (const path of scope.paths)
        if (await ports.present(path))
          throw new Error("media_case_storage_not_deleted");
      stage = "deleted";
      last = value;
    },
    async cleanup() {
      if (cleaned) return { assets: 0, objects: 0, alreadyCleaned: true };
      if (cleanupAttempted)
        throw new Error("media_case_cleanup_outcome_unknown");
      const value = await read();
      if (
        last &&
        (value.assets.length || value.objects.length || value.reviews.length) &&
        !isDeepStrictEqual(value, last)
      )
        throw new Error("media_case_cleanup_changed");
      await validate(value, false);
      if (!isDeepStrictEqual(await read(), value))
        throw new Error("media_case_cleanup_changed");
      cleanupAttempted = true;
      // 首次读回前失败也能按独占文件意图发现孤立对象；删除只走Storage API，不写storage表。
      for (const o of value.objects) {
        stage = "storage_remove_attempted";
        await ports.remove(o.name);
        stage = "storage_remove_dispatched";
        if (await ports.present(o.name))
          throw new Error("media_case_storage_remove_unconfirmed");
      }
      const afterObjects = await read();
      if (
        afterObjects.objects.length ||
        !isDeepStrictEqual(afterObjects.assets, value.assets) ||
        !isDeepStrictEqual(afterObjects.reviews, value.reviews)
      )
        throw new Error("media_case_changed_after_storage_remove");
      stage = "objects_removed";
      const deleted = await ports.deleteRows(value);
      if (
        !isDeepStrictEqual(
          [...deleted].sort(),
          value.assets.map((a) => a.id).sort(),
        )
      )
        throw new Error("media_case_row_delete_unconfirmed");
      stage = "rows_removed";
      await this.missing();
      cleaned = true;
      stage = "cleaned";
      return { assets: deleted.length, objects: value.objects.length };
    },
    evidence() {
      return {
        scope: structuredClone(scope),
        expectedSize,
        expectedSha256,
        last: structuredClone(last),
        cleanupAttempted,
        cleaned,
        stage,
      };
    },
  };
}
