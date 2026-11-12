import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const bucket = "wholesale-order-lists";
export const actor = "11111111-1111-4111-8111-111111111111";
const copy = (value) => JSON.parse(JSON.stringify(value));
const samples = JSON.parse(
  fs.readFileSync(
    "tests/test-support/fixtures/wholesale-fee-proof-samples.json",
    "utf8",
  ),
);
export const fixtureFile =
  "tests/e2e/helpers/wholesale-order-attachment-fixture.ts";
export const capabilityFile =
  "tests/e2e/helpers/wholesale-order-attachment-capability.ts";

/** 只允许已列出的源码和显式端口；绝不递归加载原认证入口或受限账号模块。 */
export function load(file, ports = {}, cache = new Map()) {
  file = path.resolve(file);
  assert(!/(?:accounts|local-supabase-admin)\.ts$/.test(file));
  const allowed = [
    fixtureFile,
    capabilityFile,
    "tests/e2e/helpers/wholesale-fee-database.ts",
    "lib/wholesale-order-list-attachments.ts",
    "lib/storage-operation-receipts.ts",
    "lib/storage-operation-object-presence.ts",
    "lib/storage-operation-receipt-validation.ts",
  ].map((f) => path.resolve(f));
  assert(allowed.includes(file), `未声明模块：${file}`);
  if (cache.has(file)) return cache.get(file);
  const exports = {};
  cache.set(file, exports);
  const require = (name) => {
    if (Object.hasOwn(ports, name)) return ports[name];
    // 数据库JSON跨VM原型不同，比较前桥接到同一JSON域；字段和值仍逐项严格相等。
    if (name === "node:assert/strict")
      return Object.assign((...args) => assert(...args), assert, {
        deepEqual: (a, b, message) =>
          assert.deepEqual(copy(a), copy(b), message),
      });
    if (name === "node:crypto") return { createHash };
    assert(name.startsWith("."), `未声明端口：${name}`);
    return load(path.resolve(path.dirname(file), name + ".ts"), ports, cache);
  };
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
  }).outputText;
  vm.runInNewContext(
    `(function(exports,require){${source}\n})(exports,require)`,
    { exports, require, Buffer, URL, process: ports.process ?? process },
    { timeout: 5000 },
  );
  return exports;
}

/** API与SQL是明确的内存端口；真实附件凭证/删除代码执行，不能据此宣称Storage服务验收通过。 */
export function harness() {
  const graph = copy(samples.states.created);
  graph.attachments = [];
  graph.order.notes = `fees-e2e-${randomUUID()}`;
  const order = {
    actor,
    note: graph.order.notes,
    proof: copy(graph),
    dispatchPending: 0,
  };
  const files = ["a.csv", "b.csv"].map((name) => ({
    name,
    mimeType: "text/csv",
    buffer: Buffer.from(`sku,quantity\n${name},2\n`),
  }));
  const state = {
    graph,
    objects: [],
    bytes: new Map(),
    apiCalls: [],
    keepObject: false,
    zeroDelete: false,
  };
  const storage = {
    download: async (name) => ({
      data: new Blob([state.bytes.get(name)]),
      error: null,
    }),
    exists: async (name) => ({
      data: state.objects.some((row) => row.name === name),
      error: null,
    }),
    list: async (folder, options) => ({
      data: state.objects
        .filter((row) => row.name === `${folder}/${options.search}`)
        .map((row) => ({ id: row.id, name: options.search })),
      error: null,
    }),
    remove: async (names) => {
      state.apiCalls.push(["remove", ...names]);
      if (!state.keepObject)
        state.objects = state.objects.filter(
          (row) => !names.includes(row.name),
        );
      return { data: [], error: null };
    },
  };
  const client = {
    storage: {
      from: (name) => {
        assert.equal(name, bucket);
        return storage;
      },
    },
    from: (table) => {
      assert.equal(table, "wholesale_order_list_attachments");
      let remove = false,
        identity;
      const chain = {
        select: () => chain,
        delete: () => {
          remove = true;
          return chain;
        },
        match: (value) => {
          identity = value;
          return chain;
        },
        maybeSingle: async () => {
          const row = graph.attachments.find((row) =>
            Object.entries(identity).every(
              ([key, value]) => row[key] === value,
            ),
          );
          if (remove) {
            state.apiCalls.push(["delete", identity.id]);
            if (state.zeroDelete) return { data: null, error: null };
            graph.attachments = graph.attachments.filter(
              (item) => item !== row,
            );
          }
          return { data: row ? { id: row.id } : null, error: null };
        },
      };
      return chain;
    },
  };
  const api = load(fixtureFile, {
    "./wholesale-fee-database": {
      readFeeOrderProof: () => copy(graph),
      readWholesaleOrderAttachmentObjects: () => copy(state.objects),
    },
    "./wholesale-fee-order-fixture": {
      requireFeeUuid: (value) =>
        assert.match(value, /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i),
    },
    "./request-timeout": { withRequestTimeout: async (value) => await value },
  });
  const fixture = api.createOrderAttachmentFixture(
    order,
    files,
    async () => client,
  );
  async function upload(index = 0, change = () => {}) {
    const file = files[index],
      objectPath = `${graph.order.id}/${actor}/${randomUUID()}-${file.name}`;
    fixture.beginUpload(objectPath);
    const row = {
      id: randomUUID(),
      name: objectPath,
      owner_id: actor,
      version: randomUUID(),
      metadata: { size: file.buffer.length, mimetype: file.mimeType },
    };
    state.objects.push(row);
    state.bytes.set(objectPath, file.buffer);
    change(row, objectPath);
    await fixture.confirmUpload(file.name, {
      Id: row.id,
      Key: `${bucket}/${objectPath}`,
    });
  }
  function register(mode = "complete") {
    const rows = files.map((file) => ({
      id: randomUUID(),
      order_id: graph.order.id,
      bucket_name: bucket,
      storage_path: state.objects.find((row) => row.name.endsWith(file.name))
        .name,
      original_name: file.name,
      mime_type: file.mimeType,
      file_size_bytes: file.buffer.length,
      uploaded_by_user_id: actor,
      created_at: "2026-11-10T00:00:00+00:00",
    }));
    fixture.register({
      p_order_id: graph.order.id,
      p_attachments: rows.map((row) => ({
        file_size_bytes: row.file_size_bytes,
        mime_type: row.mime_type,
        original_name: row.original_name,
        storage_path: row.storage_path,
      })),
    });
    if (mode === "not-forwarded") {
      fixture.markNotForwarded();
      return rows;
    }
    graph.attachments = rows
      .map((row) => ({ ...row, _xmin: "123" }))
      .sort((a, b) => a.id.localeCompare(b.id));
    fixture.receiveRegistration(mode === "partial" ? rows.slice(0, 1) : rows);
    if (mode === "complete") fixture.confirmRegistered();
    return rows;
  }
  return { state, graph, order, files, fixture, upload, register };
}
