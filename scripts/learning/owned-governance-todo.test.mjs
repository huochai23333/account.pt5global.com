import assert from "node:assert/strict";
import test from "node:test";
import { withOwnedGovernanceTodo } from "../../tests/test-support/owned-governance-todo.mjs";

const title = "governance-todo-10000000-0000-4000-8000-000000000001";
const record = { id: "20000000-0000-4000-8000-000000000002", user_id: "30000000-0000-4000-8000-000000000003", title };

/** 内存适配只验证失败收尾与数据归属；不连接浏览器、账号、数据库或原受限辅助。 */
function fixture({ initial = [], create, remove } = {}) {
  let rows = structuredClone(initial);
  const calls = [];
  const setRows = value => { rows = structuredClone(value); };
  const operations = {
    read: async value => { calls.push(["read", value]); return structuredClone(rows); },
    createFromPage: async value => {
      calls.push(["create", value]);
      if (create) return create(setRows);
      setRows([record]);
    },
    remove: async value => {
      calls.push(["remove", structuredClone(value)]);
      if (remove) return remove(setRows);
      const result = rows; setRows([]); return result;
    },
  };
  return { operations, calls, setRows, rows: () => structuredClone(rows) };
}

test("专属待办：页面完成删除后不追加删除其他数据", async () => {
  const f = fixture();
  const result = await withOwnedGovernanceTodo(title, f.operations, async row => {
    assert.deepEqual(row, record); f.setRows([]);
  });
  assert.deepEqual(result, { created: record, removed: [], remaining: 0 });
  assert.equal(f.calls.filter(c => c[0] === "remove").length, 0);
});

test("专属待办：断言失败仍删除本次记录并保留原异常", async () => {
  const f = fixture(), failure = new Error("original assertion");
  await assert.rejects(withOwnedGovernanceTodo(title, f.operations, async () => { throw failure; }), error => error === failure);
  assert.deepEqual(f.rows(), []);
  assert.deepEqual(f.calls.filter(c => c[0] === "remove"), [["remove", record]]);
  assert.deepEqual(f.calls.at(-1), ["read", title]);
});

test("专属待办：页面请求后抛错也找回本次已经写入的记录", async () => {
  const failure = new Error("visible wait timed out");
  const f = fixture({ create: set => { set([record]); throw failure; } });
  await assert.rejects(withOwnedGovernanceTodo(title, f.operations, async () => assert.fail("should not start")), error => error === failure);
  assert.deepEqual(f.rows(), []);
});

test("专属待办：已有同名记录或非随机标题不取得清理权", async () => {
  const f = fixture({ initial: [record] });
  await assert.rejects(withOwnedGovernanceTodo(title, f.operations, async () => {}), /标题已存在/);
  assert.equal(f.calls.length, 1);
  await assert.rejects(withOwnedGovernanceTodo("人工待办", f.operations, async () => {}), /拒绝/);
  assert.deepEqual(f.rows(), [record]);
});

test("专属待办：零影响清理不能被当成成功", async () => {
  const f = fixture({ remove: () => [] });
  await assert.rejects(withOwnedGovernanceTodo(title, f.operations, async () => {}), /清理影响行数/);
  assert.deepEqual(f.rows(), [record]);
});

test("专属待办：返回了编号但独立查询仍有残留时失败", async () => {
  const f = fixture({ remove: () => [record] });
  await assert.rejects(withOwnedGovernanceTodo(title, f.operations, async () => {}), /仍有待办残留/);
});

test("专属待办：多条或所有者改变时不冒险删除", async () => {
  const f = fixture();
  await assert.rejects(withOwnedGovernanceTodo(title, f.operations, async () => f.setRows([record, record])), /多条待办/);
  assert.equal(f.calls.filter(c => c[0] === "remove").length, 0);
  const g = fixture();
  await assert.rejects(withOwnedGovernanceTodo(title, g.operations, async () => g.setRows([{ ...record, user_id: record.id }])), /创建凭证发生变化/);
  assert.equal(g.calls.filter(c => c[0] === "remove").length, 0);
});

test("专属待办：流程与清理同时失败时保存两份原因", async () => {
  const failure = new Error("page failed"), cleanup = new Error("database unavailable");
  const f = fixture({ remove: () => { throw cleanup; } });
  await assert.rejects(withOwnedGovernanceTodo(title, f.operations, async () => { throw failure; }), error => {
    assert(error instanceof AggregateError); assert.deepEqual(error.errors, [failure, cleanup]); return true;
  });
});
