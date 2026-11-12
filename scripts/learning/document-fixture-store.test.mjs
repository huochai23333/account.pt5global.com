import assert from "node:assert/strict";
import test from "node:test";
import { createDocumentFixtureStore } from "../../tests/test-support/document-fixture-store.ts";
import { readStorageObjectPresence } from "../../lib/storage-operation-object-presence.ts";

/** 每个响应由场景明确提供，任何多余查询都会失败；不加载原认证入口。 */
function harness(replies, storage = {}) {
  const calls = [];
  const admin = {
    from(table) {
      const query = [["from", table]];
      const builder = {};
      for (const method of [
        "select",
        "delete",
        "in",
        "eq",
        "gt",
        "limit",
        "order",
        "single",
      ]) {
        builder[method] = (...args) => {
          query.push([method, ...args]);
          return builder;
        };
      }
      builder.then = (resolve, reject) => {
        calls.push(query);
        if (!replies.length)
          return Promise.reject(new Error("unexpected_query")).then(
            resolve,
            reject,
          );
        return Promise.resolve(replies.shift()).then(resolve, reject);
      };
      return builder;
    },
    storage: {
      from: (bucket) => {
        assert.equal(bucket, "document-library");
        return storage;
      },
    },
  };
  const actors = [];
  const store = createDocumentFixtureStore(
    admin,
    async (actorId) => {
      actors.push(actorId);
      return {
        rpc: async (name, args) => {
          assert.equal(name, "document_batch_release");
          assert.deepEqual(args, { p_id: "batch" });
          return { error: null };
        },
      };
    },
    readStorageObjectPresence,
  );
  return { store, calls, actors };
}

test("超过默认页数的数据继续按主键读取", async () => {
  const first = Array.from({ length: 200 }, (_, i) => ({
    id: String(i).padStart(4, "0"),
  }));
  const h = harness([{ data: first }, { data: [{ id: "0200" }] }]);
  assert.equal((await h.store.listRows("document_files", "id")).length, 201);
  assert.ok(
    h.calls[1].some(
      (call) => JSON.stringify(call) === JSON.stringify(["gt", "id", "0199"]),
    ),
  );
});

test("读取错误和缺失数据不能当作空列表", async () => {
  for (const reply of [{ error: new Error("denied") }, { data: null }]) {
    await assert.rejects(
      harness([reply]).store.listRows("document_files", "id"),
      /denied|result_missing/,
    );
  }
});

test("分页不前进时中止", async () => {
  const page = Array.from({ length: 200 }, () => ({ id: "a" }));
  await assert.rejects(
    harness([{ data: page }, { data: page }]).store.listRows(
      "document_files",
      "id",
    ),
    /no_progress/,
  );
});

test("批次按发起人释放，独立核对 released 和残留锁", async () => {
  const h = harness([{ data: { request: { released: true } } }, { count: 0 }]);
  await h.store.releaseBatch({ id: "batch", actor_id: "operator-id" });
  assert.deepEqual(h.actors, ["operator-id"]);
  assert.equal(h.calls.length, 2);
});

test("释放没有终态、仍有目录锁或无法核对时均失败", async () => {
  for (const replies of [
    [{ data: { request: {} } }],
    [{ data: { request: { released: true } } }, { count: 1 }],
    [{ data: { request: { released: true } } }, { count: null }],
  ])
    await assert.rejects(
      harness(replies).store.releaseBatch({ id: "batch", actor_id: "actor" }),
      /not_confirmed/,
    );
});

test("删除去重并核对影响集合与独立零行", async () => {
  const h = harness([{ data: [{ id: "b" }, { id: "a" }] }, { count: 0 }]);
  await h.store.deleteRows("document_files", ["a", "b", "a"]);
  assert.equal(h.calls.length, 2);
});

test("零影响、少删和残留记录均失败", async () => {
  for (const replies of [
    [{ data: [] }],
    [{ data: [{ id: "a" }] }],
    [{ data: [{ id: "a" }, { id: "b" }] }, { count: 1 }],
  ])
    await assert.rejects(
      harness(replies).store.deleteRows("document_files", ["a", "b"]),
      /mismatch|not_confirmed/,
    );
});

test("大删除拆成两批，每批独立读回", async () => {
  const ids = Array.from({ length: 101 }, (_, i) => String(i));
  const h = harness([
    { data: ids.slice(0, 100).map((id) => ({ id })) },
    { count: 0 },
    { data: [{ id: "100" }] },
    { count: 0 },
  ]);
  await h.store.deleteRows("document_files", ids);
  assert.equal(h.calls.length, 4);
});

test("Storage 删除后必须独立确认不存在", async () => {
  const paths = [];
  const h = harness([], {
    remove: async (value) => {
      paths.push(value);
      return {};
    },
    list: async (folder, options) => {
      paths.push([folder, options.search]);
      return { data: [] };
    },
  });
  await h.store.removeObject("own/path");
  assert.deepEqual(paths, [["own/path"], ["own", "path"]]);
});

test("Storage 错误、残留或不确定结果均失败", async () => {
  for (const reply of [
    { data: [{ name: "path", id: "object-id" }] },
    { data: null },
    { error: new Error("storage_denied") },
  ]) {
    await assert.rejects(
      harness([], {
        remove: async () => ({}),
        list: async () => reply,
      }).store.removeObject("own/path"),
      /not_confirmed|storage_denied|没有确认读取/,
    );
  }
});
