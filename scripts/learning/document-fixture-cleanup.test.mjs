import assert from "node:assert/strict";
import test from "node:test";
import { cleanupDocumentFixtures } from "../../tests/test-support/document-fixture-cleanup.ts";

const prefix = "explorer-1793954000000-";
/** 显式内存存储只验证归属与顺序，不连接原套件的账号、环境或数据库。 */
function fixture(overrides = {}) {
  const rows = {
    document_folders: [
      { id: "root", parent_id: null, name: prefix + "root", system_key: null },
      { id: "child", parent_id: "root", name: "默认子目录", system_key: null },
      { id: "foreign", parent_id: null, name: "其他运行", system_key: null },
    ],
    document_files: [
      {
        id: "file",
        folder_id: "child",
        name: "file.txt",
        original_name: "file.txt",
        storage_path: "own/path",
      },
    ],
    company_template_documents: [
      { id: "doc", folder_id: "child", name: "默认文档" },
    ],
    document_batches: [
      {
        id: "batch",
        actor_id: "operator-id",
        manifest: [
          {
            id: "file",
            kind: "file",
            version: 2,
            record: { name: "file.txt" },
          },
        ],
        request: {},
      },
    ],
    document_operations: [
      { id: "op", payload: { fileId: "file" }, receipt: {} },
    ],
    ...overrides,
  };
  const writes = [];
  const store = {
    async listRows(table) {
      return structuredClone(rows[table]);
    },
    async releaseBatch(batch) {
      writes.push(["release", batch.actor_id]);
    },
    async removeObject(path) {
      writes.push(["object", path]);
    },
    async deleteRows(table, ids) {
      if (!ids.length) return;
      writes.push([table, [...ids]]);
      rows[table] = rows[table].filter((row) => !ids.includes(row.id));
    },
  };
  return { rows, writes, store };
}

test("回收默认后代、模板和操作，先释放真实发起人的批次并保留其他运行", async () => {
  const { store, rows, writes } = fixture();
  const receipts = await cleanupDocumentFixtures(prefix, store);
  assert.deepEqual(writes.slice(0, 2), [
    ["release", "operator-id"],
    ["object", "own/path"],
  ]);
  assert.deepEqual(
    writes
      .filter(([table]) => table === "document_folders")
      .map(([, ids]) => ids),
    [["child"], ["root"]],
  );
  assert.deepEqual(
    rows.document_folders.map((row) => row.id),
    ["foreign"],
  );
  for (const table of Object.keys(rows).filter(
    (table) => table !== "document_folders",
  ))
    assert.equal(rows[table].length, 0);
  assert.deepEqual(receipts, [
    { id: "batch", entries: [{ kind: "file", id: "file", version: 2 }] },
  ]);
});

test("共享前缀在第一次读取前拒绝", async () => {
  const { store, writes } = fixture();
  store.listRows = async () => assert.fail("不得读取");
  await assert.rejects(
    cleanupDocumentFixtures("explorer-", store),
    /requires_run_prefix/,
  );
  assert.equal(writes.length, 0);
});

for (const table of [
  "document_folders",
  "document_files",
  "company_template_documents",
  "document_batches",
  "document_operations",
]) {
  test(`${table} 读取失败在写入前原样传播`, async () => {
    const { store, writes } = fixture();
    const read = store.listRows;
    const failure = new Error("read-denied");
    store.listRows = async (name) => {
      if (name === table) throw failure;
      return read(name);
    };
    await assert.rejects(
      cleanupDocumentFixtures(prefix, store),
      (error) => error === failure,
    );
    assert.equal(writes.length, 0);
  });
}

test("混合批次在任何释放和删除前拒绝", async () => {
  const f = fixture();
  f.rows.document_batches[0].manifest.push({
    id: "foreign-file",
    record: { name: "其他运行" },
  });
  await assert.rejects(
    cleanupDocumentFixtures(prefix, f.store),
    /unowned_entries/,
  );
  assert.equal(f.writes.length, 0);
});

test("被其他运行引用的对象路径不删除", async () => {
  const f = fixture();
  f.rows.document_files.push({
    id: "foreign-file",
    folder_id: "foreign",
    name: "其他文件",
    storage_path: "own/path",
  });
  await assert.rejects(
    cleanupDocumentFixtures(prefix, f.store),
    /unowned_reference/,
  );
  assert.equal(f.writes.length, 0);
});

test("系统目录和目录环均在写入前拒绝", async () => {
  for (const mutate of [
    (rows) => {
      rows.document_folders[1].system_key = "archive";
    },
    (rows) => {
      rows.document_folders[0].parent_id = "child";
    },
  ]) {
    const f = fixture();
    mutate(f.rows);
    await assert.rejects(
      cleanupDocumentFixtures(prefix, f.store),
      /system_folder|graph_has_cycle/,
    );
    assert.equal(f.writes.length, 0);
  }
});

for (const method of ["releaseBatch", "removeObject", "deleteRows"]) {
  test(`${method} 失败不返回成功凭证`, async () => {
    const f = fixture();
    const failure = new Error(method);
    f.store[method] = async () => {
      throw failure;
    };
    await assert.rejects(
      cleanupDocumentFixtures(prefix, f.store),
      (error) => error === failure,
    );
  });
}

test("删除后重新读取，遗留记录不能冒充成功", async () => {
  const f = fixture();
  f.store.deleteRows = async () => {};
  await assert.rejects(
    cleanupDocumentFixtures(prefix, f.store),
    /has_remaining_records/,
  );
});
