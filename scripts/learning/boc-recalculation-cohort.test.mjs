import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import { createBocRecalculationCohort } from "../../tests/test-support/boc-recalculation-cohort.ts";
import { cleanupFixtureResources } from "../../tests/test-support/fixture-cleanup-sequence.ts";

const keys = [
  "ordinary",
  "orders",
  "settlements",
  "commissions",
  "logs",
  "attachments",
  "allocations",
  "runs",
  "items",
];
const id = "b1000000-0000-4000-8000-000000000001",
  settlement = "b1000000-0000-4000-8000-000000000002";
const actor = "11111111-1111-4111-8111-111111111111",
  run1 = "b1000000-0000-4000-8000-000000000003",
  run2 = "b1000000-0000-4000-8000-000000000004";
const empty = () => Object.fromEntries(keys.map((key) => [key, []]));
const raw = (row) =>
  Object.fromEntries(Object.entries(row).filter(([key]) => key !== "_xmin"));
/** 内存端口用于缺失/未知凭证，正式核算函数/真实DELETE和事务另在专属PG验证。 */
function harness() {
  let graph = empty(),
    calls = 0;
  const modes = {};
  const fixture = createBocRecalculationCohort((sql) => {
    calls++;
    if (sql.startsWith("begin;")) {
      if (modes.zero) throw Error("boc_cohort_cleanup_zero_order");
      const receipt = {
        deletedOrders: 1,
        deletedRuns: graph.runs.length,
        deletedItems: graph.items.length,
      };
      graph = empty();
      if (modes.lost) throw Error("reply lost after commit");
      return JSON.stringify(receipt);
    }
    return JSON.stringify(graph);
  });
  function settled() {
    fixture.prepare();
    graph.orders = [
      {
        id,
        notes: fixture.note,
        customer_id: "c1000000-0000-4000-8000-000000000001",
        customer_payment_currency: "USD",
        customer_payment_amount: 300,
        product_purchase_amount: 10,
        international_shipping_fee: 1,
        small_order_count: 1,
        created_by_user_id: actor,
        _xmin: "100",
      },
    ];
    graph.settlements = [
      { id: settlement, order_id: id, settlement_amount: 100, _xmin: "101" },
    ];
    fixture.settled(id, settlement);
  }
  function preview(runId = run1) {
    graph.runs.push({
      id: runId,
      created_by: actor,
      scope_counts: {
        ordinary: 0,
        wholesale: 1,
        settlements: 1,
        wholesaleCommissions: 0,
      },
      status: "preview",
      _xmin: "102",
    });
    graph.items.push({
      id:
        runId === run1
          ? "b1000000-0000-4000-8000-000000000005"
          : "b1000000-0000-4000-8000-000000000006",
      run_id: runId,
      order_id: id,
      order_kind: "wholesale",
      status: "ready",
      _xmin: "103",
    });
  }
  function applied() {
    const run = graph.runs[0],
      item = graph.items[0];
    Object.assign(run, {
      status: "succeeded",
      executed_at: "2026-11-11T01:00:00Z",
      proof: {
        runId: run.id,
        status: "succeeded",
        affectedRows: 1,
        succeededCount: 1,
        failedCount: 0,
      },
      _xmin: "104",
    });
    Object.assign(item, {
      status: "succeeded",
      affected_rows: 1,
      message: null,
      _xmin: "105",
      after_snapshot: {
        order: raw(graph.orders[0]),
        settlements: graph.settlements.map(raw),
        commissions: [],
        allocations: [],
      },
    });
  }
  return {
    fixture,
    modes,
    settled,
    preview,
    applied,
    get graph() {
      return graph;
    },
    get calls() {
      return calls;
    },
  };
}
test("未准备不读SQL，不把清理空对象退化为全库写入", () => {
  const h = harness();
  assert.throws(() => h.fixture.unchanged(), /not_active/);
  assert.equal(h.fixture.cleanup().deletedOrders, 0);
  assert.equal(h.calls, 0);
});
test("任何一类已有数据都拒绝准备，不清旧记录", () => {
  for (const key of keys) {
    const h = harness();
    h.graph[key].push({ id, _xmin: "100" });
    assert.throws(() => h.fixture.prepare(), /requires_empty_scope/);
    assert.equal(h.calls, 1);
    assert.equal(h.graph[key].length, 1);
  }
});
test("完整结汇→预览→终态→第二预览→清理，副本不改变期望", () => {
  const h = harness();
  h.settled();
  h.preview();
  h.fixture.preview(run1);
  h.applied();
  const captured = h.fixture.applied(run1);
  captured.orders[0].notes = "changed copy";
  h.fixture.evidence().expected.orders[0]._xmin = "999";
  h.fixture.unchanged();
  h.preview(run2);
  h.fixture.preview(run2);
  h.fixture.unchanged();
  assert.deepEqual(h.fixture.cleanup(), {
    deletedOrders: 1,
    deletedRuns: 2,
    deletedItems: 2,
  });
  assert(h.fixture.evidence().cleaned);
});
test("未取得已知业务凭证的创建结果不采为清理新基准", () => {
  const h = harness();
  h.fixture.prepare();
  h.graph.orders.push({ id, _xmin: "100" });
  assert.throws(() => h.fixture.cleanup(), /graph_changed/);
  assert.equal(h.fixture.evidence().cleaned, false);
});
test("额外普通订单、错误备注或额外业务资源使范围核对失败", () => {
  for (const change of [
    (h) => h.graph.ordinary.push({ id, _xmin: "100" }),
    (h) => (h.graph.orders[0].notes = "not ours"),
    (h) => h.graph.attachments.push({ id, order_id: id, _xmin: "100" }),
  ]) {
    const h = harness();
    h.settled();
    h.preview();
    change(h);
    assert.throws(() => h.fixture.preview(run1), /business_scope_changed/);
  }
});
test("预览只能增加本次run/item，不改业务行或其他凭证", () => {
  for (const change of [
    (h) => (h.graph.orders[0]._xmin = "999"),
    (h) => (h.graph.runs[0].created_by = "foreign"),
    (h) => (h.graph.items[0].order_id = "foreign"),
  ]) {
    const h = harness();
    h.settled();
    h.preview();
    change(h);
    assert.throws(
      () => h.fixture.preview(run1),
      /not_owned|scope_changed|foreign_item/,
    );
  }
});
test("缺少影响行数、非整数、部分终态或假快照不能确认为完成", () => {
  for (const change of [
    (h) => delete h.graph.runs[0].proof.affectedRows,
    (h) => (h.graph.runs[0].proof.affectedRows = Number.NaN),
    (h) => (h.graph.runs[0].status = "partial_failed"),
    (h) => (h.graph.items[0].affected_rows = 0),
    (h) => (h.graph.items[0].after_snapshot.order.notes = "fake"),
  ]) {
    const h = harness();
    h.settled();
    h.preview();
    h.fixture.preview(run1);
    h.applied();
    change(h);
    assert.throws(() => h.fixture.applied(run1), /terminal_invalid/);
  }
});
test("HTTP假成功不写库，整图和版本必须完全不变", () => {
  const h = harness();
  h.settled();
  h.preview();
  h.fixture.preview(run1);
  h.fixture.unchanged();
  assert.throws(() => h.fixture.applied(run1), /terminal_invalid/);
  h.graph.items[0]._xmin = "999";
  assert.throws(() => h.fixture.unchanged(), /version_changed/);
});
test("SQL零影响或提交回包丢失均保留未知，禁止重复盲清理", () => {
  for (const mode of ["zero", "lost"]) {
    const h = harness();
    h.settled();
    h.preview();
    h.fixture.preview(run1);
    h.modes[mode] = true;
    assert.throws(() => h.fixture.cleanup(), /zero_order|reply lost/);
    assert.equal(h.fixture.evidence().cleaned, false);
    assert.throws(() => h.fixture.cleanup(), /not_active/);
  }
});

// 白名单编译当前收尾，不加载原Auth/管理员提供器。
function finalizer() {
  const source = fs.readFileSync(
      "tests/e2e/helpers/boc-recalculation-lifecycle.ts",
      "utf8",
    ),
    compiled = { exports: {} };
  const code = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
  }).outputText;
  new Function("module", "exports", "require", code)(
    compiled,
    compiled.exports,
    (name) => {
      assert.equal(name, "../../test-support/fixture-cleanup-sequence");
      return { cleanupFixtureResources };
    },
  );
  return compiled.exports.finalizeBocRecalculationCohort;
}
test("正文/清理/附件错误保留，页面关闭后再回收", async () => {
  const calls = [],
    body = Error("body"),
    cleanup = Error("cleanup"),
    attach = Error("attach");
  await assert.rejects(
    finalizer()(
      {
        isClosed: () => false,
        unrouteAll: async () => calls.push("drain"),
        close: async () => calls.push("close"),
      },
      {
        attach: async () => {
          calls.push("attach");
          throw attach;
        },
      },
      {
        cleanup: () => {
          calls.push("cleanup");
          throw cleanup;
        },
        evidence: () => ({}),
      },
      { error: body },
    ),
    (e) =>
      e instanceof AggregateError &&
      e.errors.length === 3 &&
      e.errors[0] === body &&
      e.errors[1] === cleanup &&
      e.errors[2] === attach,
  );
  assert.deepEqual(calls, ["drain", "close", "cleanup", "attach"]);
});
test("页面关闭失败禁止写入但仍保存附件", async () => {
  let attached = false,
    deleted = false;
  const close = Error("close");
  await assert.rejects(
    finalizer()(
      {
        isClosed: () => false,
        unrouteAll: async () => {},
        close: async () => {
          throw close;
        },
      },
      {
        attach: async () => {
          attached = true;
        },
      },
      {
        cleanup: () => {
          deleted = true;
        },
        evidence: () => ({}),
      },
    ),
    (e) =>
      e instanceof AggregateError &&
      e.errors[0] === close &&
      e.errors[1].message === "boc_cohort_page_not_closed",
  );
  assert(attached);
  assert.equal(deleted, false);
});
