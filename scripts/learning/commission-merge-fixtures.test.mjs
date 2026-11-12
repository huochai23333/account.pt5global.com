import assert from "node:assert/strict";
import test from "node:test";
import { createCommissionMergeOrder } from "../../tests/test-support/commission-merge-order.ts";
import { createCommissionMergeReadFault } from "../../tests/test-support/commission-merge-read-fault.ts";

// 显式响应替身验证未知结果/回执边界；真实DDL、触发器和版本冲突在专属PostgreSQL另验。
function harness(factory) {
  const responses = [],
    calls = [];
  const fixture = factory((statement) => {
    calls.push(statement);
    assert(responses.length, "unexpected SQL");
    const response = responses.shift();
    if (response instanceof Error) throw response;
    return JSON.stringify(
      typeof response === "function" ? response(fixture) : response,
    );
  });
  return { fixture, responses, calls };
}
const empty = () => ({
  order: null,
  commissions: [],
  settlements: [],
  logs: [],
  attachments: [],
  allocations: [],
});
function pending(f) {
  return {
    order: {
      id: f.id,
      order_number: f.number,
      notes: `commission-merge-e2e:${f.id}`,
      sales_user_id: "55555555-5555-4555-8555-555555555555",
      customer_id: "c1000000-0000-4000-8000-000000000001",
      customer_payment_currency: "CNY",
      customer_payment_amount: 10000,
      product_purchase_amount: 9000,
      _xmin: "100",
    },
    commissions: [
      {
        id: "c2000000-0000-4000-8000-000000000001",
        order_id: f.id,
        beneficiary_user_id: "55555555-5555-4555-8555-555555555555",
        commission_amount_rmb: 100,
        status: "pending",
        settled_at: null,
        _xmin: "100",
      },
    ],
    settlements: [
      {
        order_id: f.id,
        settlement_amount: 10000,
        settlement_exchange_rate: 1,
        _xmin: "100",
      },
    ],
    logs: [],
    attachments: [],
    allocations: [],
  };
}
function prepared() {
  const h = harness(createCommissionMergeOrder);
  h.responses.push(pending, pending);
  h.fixture.prepare();
  return h;
}
function settled(f) {
  const p = pending(f);
  Object.assign(p.commissions[0], {
    status: "settled",
    settled_at: "2026-11-11T01:00:00Z",
    _xmin: "101",
  });
  return p;
}
const original = "get_wholesale_referral_commission_rows";
const row = (name = original, version = "100") => ({
  oid: "43210",
  proname: name,
  proowner: "10",
  proacl: ["postgres=X/postgres"],
  prosrc: "safe-definition",
  _xmin: version,
  _comment: "existing comment",
});
function installed() {
  const h = harness(createCommissionMergeReadFault);
  h.responses.push(
    row(),
    (f) => row(f.name, "101"),
    (f) => ({ original: null, renamed: row(f.name, "101") }),
  );
  h.fixture.install();
  return h;
}

test("未准备回收不执行SQL；订单与结汇必须同事务并独立读回", () => {
  const h = harness(createCommissionMergeOrder);
  assert.deepEqual(h.fixture.cleanup(), { deleted: 0, notCreated: true });
  assert.equal(h.calls.length, 0);
  h.responses.push(pending, pending);
  h.fixture.prepare();
  assert.match(h.calls[0], /^begin;/);
  assert.match(h.calls[0], /insert into public.wholesale_order_settlements/);
  assert.match(h.calls[0], /commit;$/);
  assert.equal(h.calls.length, 2);
});
test("订单响应丢失不能按编号猜测删除或重试建单", () => {
  const h = harness(createCommissionMergeOrder);
  h.responses.push(new Error("lost response"));
  assert.throws(() => h.fixture.prepare(), /lost response/);
  assert.throws(() => h.fixture.cleanup(), /prepare_outcome_unknown/);
  assert.throws(() => h.fixture.prepare(), /already_attempted/);
  assert.equal(h.calls.length, 1);
});
test("错误受益人、非有限金额、外部附件不能接受为初始凭证", () => {
  for (const alter of [
    (p) => (p.commissions[0].beneficiary_user_id = "foreign"),
    (p) => (p.commissions[0].commission_amount_rmb = "NaN"),
    (p) => p.attachments.push({ id: "foreign" }),
  ]) {
    const h = harness(createCommissionMergeOrder);
    h.responses.push((f) => {
      const p = pending(f);
      alter(p);
      return p;
    });
    assert.throws(() => h.fixture.prepare(), /receipt_invalid/);
    assert.throws(() => h.fixture.cleanup(), /prepare_outcome_unknown/);
  }
});
test("只读与零影响时完整行和同值新版本均不得被接受", () => {
  const h = prepared();
  h.responses.push((f) => {
    const p = pending(f);
    p.commissions[0]._xmin = "101";
    return p;
  });
  assert.throws(() => h.fixture.assertUnchanged(), /commission_order_changed/);
});
test("假终态与结算时顺便改金额均拒绝，不能推进清理快照", () => {
  const h = prepared();
  h.responses.push(pending);
  assert.throws(() => h.fixture.confirmSettlement(), /terminal_invalid/);
  for (const change of [
    (p) => (p.commissions[0].commission_amount_rmb = 101),
    (p) => (p.commissions[0].unknown_field = "foreign"),
    (p) => (p.settlements[0].settlement_amount = 9999),
  ]) {
    h.responses.push((f) => {
      const p = settled(f);
      change(p);
      return p;
    });
    assert.throws(
      () => h.fixture.confirmSettlement(),
      /unexpected_write|receipt_invalid/,
    );
  }
  assert.deepEqual(h.fixture.snapshot(), pending(h.fixture));
});
test("真实结算回执为防修改副本，清理须影响1行且新连接独立查零", () => {
  const h = prepared();
  h.responses.push(settled);
  const receipt = h.fixture.confirmSettlement();
  receipt.status = "foreign";
  const evidence = h.fixture.evidence();
  evidence.expected.order.notes = "foreign";
  const snap = h.fixture.snapshot();
  snap.commissions[0].status = "foreign";
  h.responses.push(settled, { deleted: 1, orderId: h.fixture.id }, empty());
  h.fixture.assertUnchanged();
  assert.equal(h.fixture.cleanup().deleted, 1);
  assert.equal(h.fixture.evidence().cleaned, true);
});
test("清理零影响、提交回包丢失或最终仍有子行均不能算回收成功", () => {
  for (const responses of [
    [{ deleted: 0 }],
    [new Error("lost response")],
    [
      (f) => ({ deleted: 1, orderId: f.id }),
      { ...empty(), logs: [{ id: "held" }] },
    ],
  ]) {
    const h = prepared();
    h.responses.push(...responses);
    assert.throws(
      () => h.fixture.cleanup(),
      /cleanup_receipt_invalid|lost response|cleanup_not_final/,
    );
    assert.throws(() => h.fixture.cleanup(), /cleanup_outcome_unknown/);
    assert.equal(h.fixture.evidence().cleaned, false);
  }
});
test("函数缺失不得改名，未安装恢复不执行SQL", () => {
  const h = harness(createCommissionMergeReadFault);
  h.fixture.restore();
  assert.equal(h.calls.length, 0);
  h.responses.push(null);
  assert.throws(() => h.fixture.install(), /original_missing/);
  assert.equal(h.calls.length, 1);
});
test("未知改名响应不得按名字恢复，且不得再次安装", () => {
  const h = harness(createCommissionMergeReadFault);
  h.responses.push(row(), new Error("lost response"));
  assert.throws(() => h.fixture.install(), /lost response/);
  assert.throws(() => h.fixture.restore(), /install_outcome_unknown/);
  assert.throws(() => h.fixture.install(), /already_attempted/);
  assert.equal(h.calls.length, 2);
});
test("函数的权限、定义或OID意外改变不能算本次故障", () => {
  for (const changes of [
    { proacl: null },
    { prosrc: "foreign" },
    { oid: "43211" },
  ]) {
    const h = harness(createCommissionMergeReadFault);
    h.responses.push(row(), (f) => ({ ...row(f.name, "101"), ...changes }));
    assert.throws(() => h.fixture.install(), /install_receipt_invalid/);
    assert.throws(() => h.fixture.restore(), /install_outcome_unknown/);
  }
});
test("真实目录形状OID字符串可恢复，原注释与权限不变且新连接确认", () => {
  const h = installed();
  const evidence = h.fixture.evidence();
  evidence.installed.prosrc = "foreign";
  h.responses.push(row(original, "102"), {
    original: row(original, "102"),
    renamed: null,
  });
  h.fixture.restore();
  h.fixture.restore();
  assert.equal(h.fixture.evidence().restored, true);
  assert.equal(h.calls.length, 5);
});
test("恢复提交回包丢失或独立目录不一致均保持未确认，不重复改名", () => {
  for (const responses of [
    [new Error("lost response")],
    [row(original, "102"), { original: row(original, "103"), renamed: null }],
  ]) {
    const h = installed();
    h.responses.push(...responses);
    assert.throws(() => h.fixture.restore(), /lost response|restore_not_final/);
    assert.throws(() => h.fixture.restore(), /restore_outcome_unknown/);
    assert.equal(h.fixture.evidence().restored, false);
  }
});
