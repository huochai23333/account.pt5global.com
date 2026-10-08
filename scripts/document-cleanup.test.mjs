import { test } from "node:test";
import assert from "node:assert/strict";
import { runDocumentCleanup } from "../../PT5-dropshipping-supabase/supabase/functions/_shared/document-cleanup.ts";

// 清理使用生产的同一引擎；故障端口只用于证明不能把传输成功当成最终凭证。
const target = (id, action = "reserve_upload") => ({ id, action, storage_path: id, actor_id: "actor", operation_id: id });
function port(targets, overrides = {}) {
  const objects = new Set(targets.map((item) => item.id));
  return { claim: async () => targets, exists: async (path) => ({ data: objects.has(path), error: null }),
    remove: async (path) => { objects.delete(path); return { error: null }; },
    finish: async (item, success) => ({ status: success ? "succeeded" : "failed", affectedCount: success ? 1 : 0, record: { id: item.id } }), ...overrides };
}
test("清理同时核对对象消失与原操作终态", async () => {
  const result = await runDocumentCleanup(port([target("upload"), target("delete", "delete_file")]));
  assert.deepEqual(result, { status: "succeeded", completed: ["upload", "delete"], failed: [], expectedCount: 2 });
});
test("对象不存在时仍完成原上传的失败凭证", async () => {
  const result = await runDocumentCleanup(port([target("missing")], { exists: async () => ({ data: false, error: null }) }));
  assert.equal(result.completed.length, 1);
});
test("删除接口返回成功而对象仍在，必须失败", async () => {
  const result = await runDocumentCleanup(port([target("retained")], { remove: async () => ({ error: null }) }));
  assert.equal(result.status, "failed");
});
test("权限或网络错误不能当作对象不存在", async () => {
  const result = await runDocumentCleanup(port([target("network")], { exists: async () => ({ data: false, error: { status: 500 } }) }));
  assert.equal(result.status, "failed");
});
test("凭证缺少实际删除行数，不能成功", async () => {
  const result = await runDocumentCleanup(port([target("zero", "delete_file")], { finish: async () => ({ status: "succeeded", affectedCount: 0, record: { id: "zero" } }) }));
  assert.equal(result.status, "failed");
});
test("一个对象清理失败时保留逐项结果并返回部分失败", async () => {
  const current = port([target("good"), target("bad")]);
  const remove = current.remove; current.remove = async (path) => path === "bad" ? { error: new Error("blocked") } : remove(path);
  assert.deepEqual(await runDocumentCleanup(current), { status: "partial_failed", completed: ["good"], failed: ["bad"], expectedCount: 2 });
});
