import assert from "node:assert/strict";
import test from "node:test";
import {
  createUserMediaAssetPreviewUrl,
  resetUserMediaPreviewCache,
} from "../lib/user-media-preview-cache.ts";

const asset = {
  bucket_name: "user-media",
  storage_path: "owned-user/image/fixture.png",
};
function deferredClient() {
  const resolve = [];
  const client = {
    storage: {
      from: () => ({
        createSignedUrl: () => new Promise((done) => resolve.push(done)),
      }),
    },
  };
  return { client, resolve };
}

// 手动控制签名响应顺序，不依赖 sleep 或真实身份令牌；调用真实缓存实现复现清理竞态。
test("清理前的迟到签名不能回写缓存、返回旧链接或移除新一轮的请求", async () => {
  resetUserMediaPreviewCache();
  const { client, resolve } = deferredClient();
  const previous = createUserMediaAssetPreviewUrl(client, asset);
  resetUserMediaPreviewCache();
  const current = createUserMediaAssetPreviewUrl(client, asset);
  resolve[0]({
    data: { signedUrl: "https://example.invalid/previous" },
    error: null,
  });
  assert.equal(await previous, null);
  const repeated = createUserMediaAssetPreviewUrl(client, asset);
  assert.equal(resolve.length, 2);
  resolve[1]({
    data: { signedUrl: "https://example.invalid/current" },
    error: null,
  });
  assert.equal(await current, "https://example.invalid/current");
  assert.equal(await repeated, "https://example.invalid/current");
  assert.equal(
    await createUserMediaAssetPreviewUrl(client, asset),
    "https://example.invalid/current",
  );
  assert.equal(resolve.length, 2);
  resetUserMediaPreviewCache();
});

test("签名暂时失败不缓存为空一小时，下一次可以真正重试", async () => {
  resetUserMediaPreviewCache();
  const { client, resolve } = deferredClient();
  const failed = createUserMediaAssetPreviewUrl(client, asset);
  resolve[0]({ data: null, error: new Error("synthetic-network-error") });
  assert.equal(await failed, null);
  const retried = createUserMediaAssetPreviewUrl(client, asset);
  assert.equal(resolve.length, 2);
  resolve[1]({
    data: { signedUrl: "https://example.invalid/recovered" },
    error: null,
  });
  assert.equal(await retried, "https://example.invalid/recovered");
  resetUserMediaPreviewCache();
});
