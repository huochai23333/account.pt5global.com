import type { SupabaseClient } from "@supabase/supabase-js";

import type { UserMediaAssetRow } from "./user-self-service-types";

const SIGNED_URL_TTL_SECONDS = 60 * 60;
const SIGNED_URL_CACHE_GRACE_MS = 30_000;
type PreviewAsset = Pick<UserMediaAssetRow, "bucket_name" | "storage_path">;

const previewUrlCache = new Map<
  string,
  { expiresAt: number; url: string | null }
>();
const previewUrlRequestCache = new Map<string, Promise<string | null>>();
let previewGeneration = 0;

export function resetUserMediaPreviewCache() {
  // 清空 Map 不会取消已发出的签名请求；递增代次，拒绝旧会话的迟到结果重新填回缓存。
  previewGeneration += 1;
  previewUrlCache.clear();
  previewUrlRequestCache.clear();
}

export async function createUserMediaAssetPreviewUrl(
  supabase: SupabaseClient,
  asset: PreviewAsset & { previewUrl?: string | null },
) {
  if (asset.previewUrl) {
    cachePreviewUrl(asset, asset.previewUrl);
    return asset.previewUrl;
  }

  const cacheKey = getCacheKey(asset);
  const cachedPreviewUrl = getCachedPreviewUrl(cacheKey);
  if (cachedPreviewUrl !== undefined) return cachedPreviewUrl;

  const pendingRequest = previewUrlRequestCache.get(cacheKey);
  if (pendingRequest) return pendingRequest;
  const generation = previewGeneration;

  // 同一资源并发只签名一次，弹窗和缩略图不会各自请求一个短期链接。
  const request = supabase.storage
    .from(asset.bucket_name)
    .createSignedUrl(asset.storage_path, SIGNED_URL_TTL_SECONDS)
    .then(({ data, error }) => {
      if (generation !== previewGeneration) return null;
      const previewUrl = error ? null : (data?.signedUrl ?? null);
      // 暂时断网不是“这个对象永远没有预览”；不缓存失败，下一次打开可以重新签名。
      if (previewUrl) cachePreviewUrl(asset, previewUrl);
      return previewUrl;
    })
    .catch(() => null)
    .finally(() => {
      // 旧请求结束时，不能删掉 reset 后同一对象的新请求，否则会失去并发合并。
      if (previewUrlRequestCache.get(cacheKey) === request)
        previewUrlRequestCache.delete(cacheKey);
    });
  previewUrlRequestCache.set(cacheKey, request);
  return request;
}

function getCacheKey(asset: PreviewAsset) {
  return `${asset.bucket_name}:${asset.storage_path}`;
}

function getCachedPreviewUrl(cacheKey: string) {
  const cachedEntry = previewUrlCache.get(cacheKey);
  if (!cachedEntry) return undefined;
  if (Date.now() >= cachedEntry.expiresAt - SIGNED_URL_CACHE_GRACE_MS) {
    previewUrlCache.delete(cacheKey);
    return undefined;
  }
  return cachedEntry.url;
}

function cachePreviewUrl(asset: PreviewAsset, previewUrl: string | null) {
  previewUrlCache.set(getCacheKey(asset), {
    expiresAt: Date.now() + SIGNED_URL_TTL_SECONDS * 1000,
    url: previewUrl,
  });
}
