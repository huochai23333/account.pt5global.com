import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { registerHooks } from "node:module";
import test from "node:test";
import {
  inventoryFixtureKeys,
  readInventoryFixtureSql,
} from "../../tests/test-support/inventory-order-fixture-sql.ts";

// Node 直接运行测试时，只补这一个 TypeScript 同层模块的扩展名。
const fixtureUrl = new URL(
  "../../tests/test-support/inventory-order-fixture.ts",
  import.meta.url,
);
const hook = registerHooks({
  resolve(specifier, context, next) {
    if (
      context.parentURL === fixtureUrl.href &&
      specifier === "./inventory-order-fixture-sql"
    ) {
      return next(specifier + ".ts", context);
    }
    return next(specifier, context);
  },
});
const { InventoryOrderFixture } = await import(fixtureUrl.href);
hook.deregister();

const row = (fields) => ({ id: randomUUID(), _xmin: "1", ...fields });
const countsFor = (graph) =>
  Object.fromEntries(
    inventoryFixtureKeys.map((key) => [key, graph[key].length]),
  );

function createHarness() {
  const baseline = Object.fromEntries(
    inventoryFixtureKeys.map((key) => [key, []]),
  );
  baseline.orders.push(
    row({ order_number: "INV-LOCAL-001", purchase_amount: 350 }),
  );
  baseline.orders.push(
    row({ order_number: "INV-LOCAL-002", purchase_amount: 150 }),
  );
  const state = { graph: structuredClone(baseline), deletes: 0 };
  // 只替换 SQL 端口，内存数据无账号、生产函数和共享记录。
  const fixture = new InventoryOrderFixture((sql) => {
    if (sql === readInventoryFixtureSql) return JSON.stringify(state.graph);
    assert(sql.includes("inventory_fixture_cleanup_incomplete"));
    state.deletes++;
    const owned = Object.fromEntries(
      inventoryFixtureKeys.map((key) => [
        key,
        state.graph[key].filter(
          ({ id }) => !baseline[key].some((original) => original.id === id),
        ),
      ]),
    );
    state.graph = structuredClone(baseline);
    return JSON.stringify(state.returnCounts ?? countsFor(owned));
  });
  const order = row({
    _xmin: "2",
    order_number: "SYNTHETIC-1",
    notes: fixture.note("application"),
    purchase_amount: 350,
    currency: "USD",
    payment_status: "awaiting_payment",
    revision: 1,
  });
  function insert() {
    state.graph.orders.push(order);
    state.graph.audit.push(
      row({ _xmin: "2", order_id: order.id, action: "created" }),
    );
    state.graph.items.push(row({ _xmin: "2", order_id: order.id }));
  }
  return { baseline, state, fixture, order, insert };
}

test("创建必须使用真实响应 ID，同金额种子订单原样保留", () => {
  const { fixture, state, order, baseline, insert } = createHarness();
  fixture.beginWrite();
  insert();
  const captured = fixture.recordCreation("application", order.id, 350);
  assert.equal(captured.orders[0].id, order.id);
  assert.equal(captured.orders[0].revision, 1);
  assert.deepEqual(fixture.cleanup(), {
    audit: 1,
    repayments: 0,
    extensions: 0,
    credits: 0,
    items: 1,
    orders: 1,
    attachments: 0,
    objects: 0,
  });
  assert.deepEqual(state.graph, baseline);
});

test("已有订单或响应缺失时保留未确认写入", () => {
  const { fixture, state, baseline } = createHarness();
  fixture.beginWrite();
  assert.throws(
    () => fixture.recordCreation("application", baseline.orders[0].id, 350),
    /已有订单/,
  );
  assert.throws(
    () => fixture.recordCreation("application", undefined, 350),
    /订单 ID/,
  );
  assert.throws(() => fixture.cleanup(), /未确认/);
  assert.equal(state.deletes, 0);
});

test("备注相同但身份不同的并发订单不能纳入清理", () => {
  const { fixture, state, order, insert } = createHarness();
  fixture.beginWrite();
  insert();
  state.graph.orders.push({ ...order, id: randomUUID(), _xmin: "3" });
  assert.throws(
    () => fixture.recordCreation("application", order.id, 350),
    /之外的数据变更/,
  );
  assert.throws(() => fixture.cleanup(), /未确认/);
  assert.equal(state.deletes, 0);
});

test("同一订单的外来事务和重复动作凭证不能纳入清理", () => {
  const { fixture, state, order, insert } = createHarness();
  fixture.beginWrite();
  insert();
  state.graph.items.push(row({ _xmin: "3", order_id: order.id }));
  assert.throws(
    () => fixture.recordCreation("application", order.id, 350),
    /其他事务/,
  );
  state.graph.items.pop();
  state.graph.audit.push(
    row({ _xmin: "3", order_id: order.id, action: "created" }),
  );
  assert.throws(
    () => fixture.recordCreation("application", order.id, 350),
    /独立动作凭证/,
  );
  assert.equal(state.deletes, 0);
});

test("有关联附件行或 Storage 对象时保留现场", () => {
  for (const [table, fields] of [
    ["attachments", (id) => ({ order_id: id })],
    ["objects", (id) => ({ name: `${id}/synthetic.xlsx` })],
  ]) {
    const { fixture, state, order, insert } = createHarness();
    fixture.beginWrite();
    insert();
    state.graph[table].push(row(fields(order.id)));
    assert.throws(
      () => fixture.recordCreation("application", order.id, 350),
      /关联附件/,
    );
    assert.throws(() => fixture.cleanup(), /未确认/);
    assert.equal(state.deletes, 0);
  }
});

test("下一次动作写前拒绝被改变的行版本", () => {
  const { fixture, state, order, insert } = createHarness();
  fixture.beginWrite();
  insert();
  fixture.recordCreation("application", order.id, 350);
  state.graph.orders[0]._xmin = "3";
  assert.throws(() => fixture.beginWrite(), /写前库存数据/);
  assert.equal(state.deletes, 0);
});

test("零影响回执不能确认为清理成功", () => {
  const { fixture, state, order, insert } = createHarness();
  fixture.beginWrite();
  insert();
  fixture.recordCreation("application", order.id, 350);
  state.returnCounts = Object.fromEntries(
    inventoryFixtureKeys.map((key) => [key, 0]),
  );
  assert.throws(() => fixture.cleanup(), /删除影响行数/);
});
