import assert from "node:assert/strict";
import test from "node:test";
import { createOperatorReimbursementFixture } from "../../tests/test-support/operator-reimbursement-fixture.ts";

const owner = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  period = "2024-06-25",
  id = "b1000000-0000-4000-8000-000000000001";
function harness(responses = []) {
  const calls = [];
  const fixture = createOperatorReimbursementFixture(
    (sql) => {
      calls.push(sql);
      assert(responses.length, "unexpected SQL");
      const result = responses.shift();
      if (result instanceof Error) throw result;
      return JSON.stringify(typeof result === "function" ? result(fixture, sql) : result);
    },
    owner,
    period,
  );
  return { fixture, calls, responses };
}
const emptyPeriod = { activeOperator: true, periodCount: 0 };
function row(f, changes = {}, version = "100") {
  return {
    record: {
      id,
      operator_user_id: owner,
      content: f.content,
      spent_at: period,
      reimbursement_period_start: period,
      reimbursement_period_end: "2024-07-24",
      amount: 88.66,
      status: "unreimbursed",
      reimbursed_at: null,
      reimbursed_by_user_id: null,
      created_at: "2026-11-11T01:00:00+00:00",
      updated_at: "2026-11-11T01:00:00+00:00",
      ...changes,
    },
    version,
  };
}
const pending = (f) => [row(f)];
const finished = (f) => [
  row(
    f,
    {
      status: "reimbursed",
      reimbursed_at: "2026-11-11T01:01:00+00:00",
      reimbursed_by_user_id: owner,
      updated_at: "2026-11-11T01:01:00+00:00",
    },
    "101",
  ),
];

// 显式SQL替身不加载账号或认证；真实RPC、版本冲突与DELETE零影响另在专属PG执行。
test("非法身份/周期和未prepare清理都不能触发SQL", () => {
  let calls = 0;
  for (const [actor, start] of [
    ["bad", period],
    [owner, "2024-06-24"],
    [owner, "2024-13-25"],
  ])
    assert.throws(
      () =>
        createOperatorReimbursementFixture(
          () => {
            calls++;
            return "";
          },
          actor,
          start,
        ),
      /identity_invalid/,
    );
  const h = harness();
  assert.equal(h.fixture.cleanup().deleted, 0);
  assert.equal(h.calls.length, 0);
  assert.equal(calls, 0);
});
test("金额非法时不尝试查库或自动修正", () => {
  const h = harness();
  for (const amount of ["0.00", "88.666", "88.6", "1';delete"])
    assert.throws(() => h.fixture.prepare(amount), /prepare_invalid/);
  assert.equal(h.calls.length, 0);
});
test("旧周期存在记录时拒绝，不批删旧前缀", () => {
  const h = harness([{ activeOperator: true, periodCount: 1 }]);
  assert.throws(() => h.fixture.prepare("88.66"), /period_not_empty/);
  h.fixture.cleanup();
  assert.equal(h.calls.length, 1);
  assert(!h.calls[0].toLowerCase().includes("delete"));
});
test("缺少活跃运营身份不把空周期当准入", () => {
  const h = harness([{ activeOperator: false, periodCount: 0 }]);
  assert.throws(() => h.fixture.prepare("88.66"), /operator_missing/);
  assert.equal(h.calls.length, 1);
});
test("页面成功后仍需核对真实owner、金额和业务日期", () => {
  for (const changes of [
    { operator_user_id: "33333333-3333-4333-8333-333333333333" },
    { amount: 66.66 },
    { spent_at: "2024-06-26" },
  ]) {
    const h = harness([emptyPeriod, (f) => [row(f, changes)]]);
    h.fixture.prepare("88.66");
    assert.throws(() => h.fixture.saved(), /record_mismatch/);
    assert.equal(h.calls.length, 2);
  }
});
test("假终态或没有新版本时不能证明报销成功", () => {
  const h = harness([emptyPeriod, pending, pending]);
  h.fixture.prepare("88.66");
  h.fixture.saved();
  assert.throws(() => h.fixture.reimbursed(), /terminal_invalid/);
});
test("批量确认前发现另一记录就停止", () => {
  const h = harness([
    emptyPeriod,
    pending,
    (f) => [row(f), row(f, { id: "b1000000-0000-4000-8000-000000000002", content: "another test" })],
  ]);
  h.fixture.prepare("88.66");
  h.fixture.saved();
  assert.throws(() => h.fixture.assertPeriodOwned(), /period_changed/);
  assert(h.calls.every((sql) => !sql.toLowerCase().includes("delete")));
});
test("同值新版本不能用旧凭证继续或清理", () => {
  const h = harness([emptyPeriod, pending, (f) => [row(f, {}, "101")], (f) => [row(f, {}, "101")]]);
  h.fixture.prepare("88.66");
  h.fixture.saved();
  assert.throws(() => h.fixture.unchanged(), /version_changed/);
  assert.throws(() => h.fixture.cleanup(), /cleanup_version_changed/);
  assert.equal(h.calls.length, 4);
});
test("清理回执零行不能变成成功", () => {
  const h = harness([emptyPeriod, pending, pending, { id, deleted: 0 }]);
  h.fixture.prepare("88.66");
  h.fixture.saved();
  assert.throws(() => h.fixture.cleanup(), /receipt_invalid/);
  assert.equal(h.calls.length, 4);
});
test("提交响应丢失时保留未知，不执行伪读回", () => {
  const h = harness([emptyPeriod, pending, pending, new Error("reply lost after commit")]);
  h.fixture.prepare("88.66");
  h.fixture.saved();
  assert.throws(() => h.fixture.cleanup(), /reply lost after commit/);
  assert.equal(h.calls.length, 4);
  assert.equal(h.fixture.evidence().cleanupConfirmed, false);
  const copy = h.fixture.evidence();
  copy.captured.record.amount = 1;
  assert.equal(h.fixture.evidence().captured.record.amount, 88.66);
});
test("未捕获响应时只回收本次UUID的未报销行，随后独立查零", () => {
  const h = harness([emptyPeriod, pending, { id, deleted: 1 }, 0]);
  h.fixture.prepare("88.66");
  const result = h.fixture.cleanup();
  assert.equal(result.deleted, 1);
  assert.equal(h.calls.length, 4);
  assert.match(h.calls[2], /xmin::text=/);
  assert.match(h.calls[2], /get diagnostics changed=row_count/);
  assert(!h.calls.some((sql) => /content like/i.test(sql)));
  h.fixture.cleanup();
  assert.equal(h.calls.length, 4);
});
test("真实终态元数据、新版本与刷新一致后精确回收", () => {
  const h = harness([emptyPeriod, pending, pending, finished, finished, finished, { id, deleted: 1 }, 0]);
  h.fixture.prepare("88.66");
  const saved = h.fixture.saved();
  saved.record.amount = 1;
  h.fixture.assertPeriodOwned();
  const final = h.fixture.reimbursed();
  assert.equal(final.record.id, id);
  assert.equal(final.record.reimbursed_by_user_id, owner);
  assert.equal(final.version, "101");
  final.record.amount = 1;
  const refreshed = h.fixture.unchanged();
  refreshed.record.amount = 1;
  h.fixture.cleanup();
  assert.equal(h.calls.length, 8);
  assert.match(h.fixture.content, /自动测试报销 [a-f0-9-]{36}$/);
  assert.equal(h.fixture.periodEnd, "2024-07-24");
  assert.equal(h.fixture.evidence().cleanupConfirmed, true);
  assert.equal(h.fixture.evidence().captured.version, "101");
});
