import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as model from "../lib/document-library/model.ts";
import { readStorageObjectPresence } from "../lib/storage-operation-object-presence.ts";

const operationId = "upload-operation";
const actor = "upload-owner";
const filename = "synthetic.txt";
const bytes = Buffer.from("test document");
const sha256 = createHash("sha256").update(bytes).digest("hex");

// 载入生产编排，替换数据库和对象存储边界。测试可以精确安排提交后断线及两个请求的顺序。
function loadDocumentModule(relative, dependencies) {
  const source = ts.transpileModule(readFileSync(new URL(relative, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  runInNewContext(source, {
    exports,
    Uint8Array,
    require(name) {
      if (!Object.hasOwn(dependencies, name)) throw Error(`Unexpected module ${name}`);
      return dependencies[name];
    },
  });
  return exports;
}
const loadStorage = dependencies => loadDocumentModule("../lib/document-library/storage-mutations.ts", dependencies);

function fixture() {
  let receipt = {
    operationId,
    status: "pending",
    affectedCount: 0,
    action: "reserve_upload",
    record: { id: "reserved-file", version: 1, size_bytes: bytes.length, storage_path: "reserved-file.txt", sha256, original_name: filename, status: "pending" },
  };
  let object = new Blob([bytes]);
  const calls = [];
  const boundary = {
    loseFinishResponse: false,
    async download() { return { data: object, error: null }; },
    dropObject() { object = null; },
    get object() { return object; },
    get receipt() { return receipt; },
    calls,
  };
  const supabase = {
    storage: { from: () => ({
      async exists() { return { data: Boolean(object), error: null }; },
      async download() { return boundary.download(); },
    }) },
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        async maybeSingle() { return { data: { receipt }, error: null }; },
      };
    },
  };
  const port = {
    async rpc(name, args) {
      assert.equal(name, "document_library_finish");
      assert.equal(args.p_operation, operationId);
      assert.equal(args.p_actor, actor);
      calls.push([args.p_success, args.p_cleanup]);
      if (receipt.status === "succeeded") return { data: receipt, error: null };
      if (args.p_success) {
        if (!object) return { data: null, error: Error("document_conflict") };
        receipt = { ...receipt, status: "succeeded", affectedCount: 1, record: { ...receipt.record, version: 2, status: "ready" } };
        if (boundary.loseFinishResponse) return { data: null, error: Error("connection lost after commit") };
      } else {
        receipt = { ...receipt, status: args.p_cleanup ? "failed" : "partial_failed" };
      }
      return { data: receipt, error: null };
    },
  };
  const dependencies = {
    "server-only": {},
    "@/lib/supabase-admin-server": { getSupabaseServiceRoleClient: () => port },
    "@/lib/storage-operation-object-presence": { readStorageObjectPresence },
    "@/lib/storage-operation-receipts": {
      requireStorageUploadReceipt() {},
      async removeStorageObjectsVerified() {
        calls.push("remove");
        if (receipt.record.status === "ready") throw Error("storage access denied for ready file");
        object = null;
      },
    },
    "./model": model,
    "./file-policy": { inspectDocument: (_name, content) => ({ mime: "text/plain", sha256: createHash("sha256").update(content).digest("hex") }) },
  };
  const storage = loadStorage(dependencies);
  return {
    boundary,
    complete: (initial = receipt) => storage.completeReservedDocumentUpload(supabase, actor, initial, bytes, filename),
    reconcile: () => storage.reconcileDocument(supabase, actor, operationId),
  };
}

test("完成事务已提交但响应丢失时保留对象，并用原凭证确认成功", async () => {
  const { complete, boundary } = fixture();
  boundary.loseFinishResponse = true;
  const result = await complete();
  assert.equal(result.status, "succeeded");
  assert.equal(result.record.version, 2);
  assert.equal(boundary.calls.includes("remove"), false);
  assert.deepEqual(Buffer.from(await boundary.object.arrayBuffer()), bytes);
});

test("同一上传有一条请求读取失败时，另一条请求仍能确认原对象", async () => {
  const { complete, boundary } = fixture();
  let beginDownload;
  let releaseDownload;
  const started = new Promise((resolve) => { beginDownload = resolve; });
  const gate = new Promise((resolve) => { releaseDownload = resolve; });
  let first = true;
  boundary.download = async () => {
    if (first) {
      first = false;
      beginDownload();
      await gate;
      return { data: boundary.object, error: null };
    }
    return { data: null, error: Error("temporary download outage") };
  };
  const winner = complete();
  await started;
  let failed;
  try { failed = await complete(); }
  finally { releaseDownload(); }
  const completed = await winner;
  assert.equal(failed.status, "partial_failed");
  assert.equal(completed.status, "succeeded");
  assert.equal(completed.record.id, "reserved-file");
  assert.equal(boundary.calls.includes("remove"), false);
});

test("旧成功凭证无法单独证明对象仍在", async () => {
  const { complete, boundary, reconcile } = fixture();
  const result = await complete();
  boundary.dropObject();
  await assert.rejects(complete(result), /unconfirmed/);
  await assert.rejects(reconcile(), /unconfirmed/);
});

// SDK的false/400不是不存在凭证：运行真正的批次核对函数，用完整LIST分别表示不可读、仍存在、已消失。
for (const state of ["unreadable", "present", "missing"]) {
  test(`删除批次最终核对使用独立对象列表：${state}`, async () => {
    const bucket = {
      exists: async () => ({ data: false, error: { name: "StorageApiError", status: 400, message: "invalid request" } }),
      list: async () => state === "unreadable" ? { data: null, error: Error("list unavailable") }
        : { data: state === "present" ? [{ name: "file.txt", id: "object-id" }] : [], error: null },
    };
    const db = {
      from: () => ({ select() { return this; }, in: async () => ({ data: [], error: null }) }),
      storage: { from: () => bucket },
    };
    const { verifyBatch } = loadDocumentModule("../lib/document-library/batch-verification.ts", {
      "server-only": {},
      "@/lib/supabase-admin-server": { getSupabaseServiceRoleClient: () => db },
      "@/lib/storage-operation-object-presence": { readStorageObjectPresence },
      "./model": model,
      "./copy-verification": { verifyCopy() { throw Error("unexpected copy branch"); } },
    });
    const batch = { status: "succeeded", action: "delete", results: [{ status: "succeeded" }],
      manifest: [{ kind: "file", id: "file-id", record: { storage_path: "folder/file.txt" } }] };
    if (state === "missing") await assert.doesNotReject(verifyBatch(batch));
    else await assert.rejects(verifyBatch(batch));
  });
}

test("删除完成前列表读取失败不能请求成功登记", async () => {
  const finishCalls = [];
  const receipt = { operationId: "delete-operation", action: "delete_file", status: "pending", affectedCount: 0,
    record: { id: "file-id", version: 2, status: "deleting", storage_path: "folder/file.txt" } };
  const { completeDocumentDelete } = loadStorage({
    "server-only": {},
    "@/lib/supabase-admin-server": { getSupabaseServiceRoleClient: () => ({ rpc: async (_name, args) => {
      finishCalls.push(args.p_success);
      return { data: { ...receipt, status: args.p_success ? "succeeded" : "partial_failed", affectedCount: args.p_success ? 1 : 0 }, error: null };
    } }) },
    "@/lib/storage-operation-object-presence": { readStorageObjectPresence },
    "@/lib/storage-operation-receipts": { requireStorageUploadReceipt() {}, removeStorageObjectsVerified() { throw Error("unexpected remove"); } },
    "./model": model,
    "./file-policy": {},
  });
  const bucket = { exists: async () => ({ data: false, error: { name: "StorageApiError", status: 400 } }),
    list: async () => ({ data: null, error: Error("cannot read owned object") }) };
  const result = await completeDocumentDelete({ storage: { from: () => bucket } }, "actor", receipt);
  assert.equal(result.status, "partial_failed");
  assert.deepEqual(finishCalls, [false]);
});

for (const state of ["unreadable", "present", "missing"]) {
  test(`旧删除成功回执仍复核对象：${state}`, async () => {
    const { completeDocumentDelete } = loadStorage({
      "server-only": {},
      "@/lib/supabase-admin-server": {},
      "@/lib/storage-operation-object-presence": { readStorageObjectPresence },
      "@/lib/storage-operation-receipts": {},
      "./model": model,
      "./file-policy": {},
    });
    const receipt = { operationId: "deleted", status: "succeeded", affectedCount: 1,
      record: { id: "gone", version: 2, storage_path: "folder/file.txt" } };
    const bucket = { list: async () => state === "unreadable" ? { data: null, error: Error("list unavailable") }
      : { data: state === "present" ? [{ name: "file.txt", id: "still-here" }] : [], error: null } };
    const operation = completeDocumentDelete({ storage: { from: () => bucket } }, "actor", receipt);
    if (state === "missing") await assert.doesNotReject(operation);
    else await assert.rejects(operation);
  });
}

for (const recovered of [false, true]) {
  test(`并发请求已完成删除仍须在读取恢复后确认：${recovered}`, async () => {
    const calls = [];
    let reads = 0;
    const original = { operationId: "same-delete", status: "pending", affectedCount: 0,
      record: { id: "file", version: 2, storage_path: "folder/file.txt" } };
    const { completeDocumentDelete } = loadStorage({
      "server-only": {},
      "@/lib/supabase-admin-server": { getSupabaseServiceRoleClient: () => ({ rpc: async (_name, args) => {
        calls.push(args.p_success);
        // 模拟另一请求已登记终态；当前请求不能因此跳过对象读取。
        return { data: { ...original, status: "succeeded", affectedCount: 1 }, error: null };
      } }) },
      "@/lib/storage-operation-object-presence": { readStorageObjectPresence },
      "@/lib/storage-operation-receipts": {},
      "./model": model,
      "./file-policy": {},
    });
    const bucket = { list: async () => {
      reads += 1;
      return reads === 1 || !recovered ? { data: null, error: Error("temporary list failure") } : { data: [], error: null };
    } };
    const result = completeDocumentDelete({ storage: { from: () => bucket } }, "actor", original);
    if (recovered) assert.equal((await result).status, "succeeded");
    else await assert.rejects(result);
    assert.deepEqual(calls, [false]);
    assert.equal(reads, 2);
  });
}
