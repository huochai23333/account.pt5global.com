import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const files = new Map();
function load(name) {
  assert(
    [
      "assistant-settlement-case",
      "settlement-repair-sql",
      "settlement-repair-receipts",
    ].includes(name),
  );
  if (files.has(name)) return files.get(name);
  const url = new URL(`../../tests/test-support/${name}.ts`, import.meta.url);
  const script = ts.transpileModule(fs.readFileSync(url, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const exports = {};
  new Function("exports", "require", script)(exports, (dependency) =>
    dependency.startsWith("node:")
      ? require(dependency)
      : load(dependency.slice(2)),
  );
  files.set(name, exports);
  return exports;
}
const { createAssistantSettlementCase } = load("assistant-settlement-case");
const { emptyRepairGraph } = load("settlement-repair-sql");

function prepare() {
  const graph = emptyRepairGraph();
  const quota = { count: 0, fingerprint: "f".repeat(32) };
  const roles = ["administrator", "finance", "salesman"].map((role) => ({
    role,
    id: randomUUID(),
  }));
  let deletes = 0;
  // 只替换 SQL 端口，定向检查不加载账号、不调用实际供应商。
  const fixture = createAssistantSettlementCase((sql) => {
    if (sql.includes("'roles',"))
      return JSON.stringify({ date: "2026-11-11", roles });
    if (sql.includes("private.api_request_quota_events"))
      return JSON.stringify(quota);
    if (sql.includes("settlement_repair_delete_count_releases")) deletes++;
    return JSON.stringify(graph);
  }, "aliases");
  fixture.prepare();
  return { fixture, graph, quota, deletes: () => deletes };
}

test("业务行不变也会识别配额版本漂移", () => {
  const { fixture, quota, deletes } = prepare();
  quota.fingerprint = "e".repeat(32);
  assert.throws(
    () => fixture.unchanged(),
    /assistant_settlement_quota_changed/,
  );
  assert.throws(() => fixture.cleanup(), /assistant_settlement_quota_changed/);
  assert.equal(deletes(), 0);
});

test("已登记但回包未知的客户创建保留原快照", () => {
  const { fixture, deletes } = prepare();
  fixture.begin("create:0");
  assert.throws(
    () => fixture.cleanup(),
    /assistant_settlement_cleanup_unconfirmed/,
  );
  assert.equal(fixture.evidence().intent, "create:0");
  assert.equal(deletes(), 0);
});

test("同名客户的回包不等于属于本次管理员与原别名", () => {
  const { fixture, graph, deletes } = prepare();
  const id = randomUUID();
  fixture.begin("create:0");
  graph.customers.push({
    id,
    _xmin: "12",
    unique_name: fixture.data.customerNames[0],
    created_by_user_id: randomUUID(),
    other_names: [fixture.data.sharedAlias],
  });
  assert.throws(
    () => fixture.created(0, id),
    /assistant_settlement_customer_receipt/,
  );
  assert.deepEqual(fixture.evidence().rows.customers, []);
  assert.equal(deletes(), 0);
});
