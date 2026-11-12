import assert from "node:assert/strict";
import test from "node:test";
import {
  createFeeModel as harness,
  feeModelActor as actor,
  feeModelFirstRequest as first,
  feeModelSecondRequest as second,
} from "../../tests/test-support/wholesale-fee-model.mjs";

test("费用分次结汇完整接受3000/9300，旧凭证和提成终态一致", () => {
  const h = harness();
  h.partial();
  assert.equal(h.state.proof.order.status, "partial_settled");
  assert.equal(h.state.proof.commissions[0].commission_amount_rmb, 0);
  const op = h.modules.transitions.beginFeeSettlement(h.state, 9300);
  h.register(op, h.body(9300, second));
  h.publish("settled9300");
  op.confirm();
  assert.equal(h.state.proof.order.customer_payment_rmb_amount, 12300);
  assert.equal(h.state.proof.commissions[0].commission_amount_rmb, 50);
  assert.equal(h.state.proof.settlements.length, 2);
  assert.equal(h.state.recover, undefined);
});
test("费用改成本完整接受11000/625/负500/62.5及唯一前后审计", () => {
  const h = harness();
  h.full();
  const op = h.modules.transitions.beginFeeCostEdit(h.state);
  h.register(op, h.costBody());
  h.publish("updated");
  op.confirm();
  assert.equal(h.state.proof.order.gross_profit, -500);
  assert.equal(h.state.proof.commissions[0].commission_amount_rmb, 62.5);
  assert.equal(h.state.proof.logs.length, 1);
});
test("费用结汇登记拒绝错金额/日期/订单以及重试编号变化", () => {
  for (const patch of [
    { p_settlement_amount: 1 },
    { p_settlement_date: "2026-11-09" },
    { p_order_id: actor },
    { extra: true },
  ]) {
    const h = harness(),
      op = h.modules.transitions.beginFeeSettlement(h.state, 3000);
    assert.throws(
      () => h.register(op, { ...h.body(3000, first), ...patch }),
      /payload_changed/,
    );
  }
  const h = harness(),
    op = h.modules.transitions.beginFeeSettlement(h.state, 3000);
  h.register(op, h.body(3000, first));
  assert.throws(() => h.register(op, h.body(3000, second)), /request_changed/);
});
test("费用场景拒绝零/超额结汇和未收齐前的成本修改", () => {
  for (const amount of [0, -1, 12301, NaN]) {
    const h = harness();
    assert.throws(
      () => h.modules.transitions.beginFeeSettlement(h.state, amount),
      /amount_invalid/,
    );
  }
  const h = harness();
  assert.throws(
    () => h.modules.transitions.beginFeeCostEdit(h.state),
    /fixture_changed/,
  );
});
test("费用未实际写入不能确认成功，取消收尾仍保持原图", () => {
  const h = harness(),
    before = h.state.proof,
    op = h.modules.transitions.beginFeeSettlement(h.state, 3000);
  h.register(op, h.body(3000, first));
  assert.throws(() => op.confirm(), /not_written/);
  assert.equal(h.state.proof, before);
  assert.equal(h.state.recover, undefined);
  assert.equal(h.modules.orders.cleanupFeeOrder(h.state).deleted, 1);
});
test("费用结汇回执丢失时cleanup先独立接受预登记终态，再限定回收", () => {
  const h = harness(),
    op = h.modules.transitions.beginFeeSettlement(h.state, 3000);
  h.register(op, h.body(3000, first));
  h.publish("settled3000", first);
  assert(h.state.recover);
  assert.equal(h.modules.orders.cleanupFeeOrder(h.state).deleted, 1);
  assert.equal(h.model.deletions, 1);
  assert.equal(h.state.recover, undefined);
});
test("费用未登记的已写入状态拒绝恢复和删除，保留操作清单", () => {
  const h = harness();
  h.modules.transitions.beginFeeSettlement(h.state, 3000);
  h.publish("settled3000", first);
  assert.throws(
    () => h.modules.orders.cleanupFeeOrder(h.state),
    /unregistered/,
  );
  assert.equal(h.model.deletions, 0);
  assert(h.state.recover);
});
test("费用结汇不能收编错付款、受益人或旧结汇改动", () => {
  for (const change of [
    (p) => (p.order.customer_payment_amount = 1),
    (p) => (p.commissions[0].beneficiary_user_id = actor),
    (p) => (p.settlements[0].settlement_amount = 1),
  ]) {
    const h = harness(),
      op = h.modules.transitions.beginFeeSettlement(h.state, 3000);
    h.register(op, h.body(3000, first));
    h.publish("settled3000", first);
    change(h.model.proof);
    assert.throws(() => op.confirm());
    assert.equal(h.model.deletions, 0);
  }
  const h = harness();
  h.partial();
  const op = h.modules.transitions.beginFeeSettlement(h.state, 9300);
  h.register(op, h.body(9300, second));
  h.publish("settled9300");
  h.model.proof.settlements[0]._xmin = "changed";
  assert.throws(() => op.confirm(), /previous_rows_changed/);
});
test("费用成本改动必须匹配原payload与完整审计，不接受缺日志或其他改动", () => {
  const bad = harness();
  bad.full();
  const op = bad.modules.transitions.beginFeeCostEdit(bad.state);
  assert.throws(
    () => bad.register(op, { ...bad.costBody(), p_notes: "other" }),
    /payload_changed/,
  );
  for (const change of [
    (p) => (p.logs.length = 0),
    (p) => (p.logs[0].actor_user_id = second),
    (p) => (p.order.created_by_user_id = second),
    (p) => (p.commissions[0].status = "settled"),
  ]) {
    const h = harness();
    h.full();
    const action = h.modules.transitions.beginFeeCostEdit(h.state);
    h.register(action, h.costBody());
    h.publish("updated");
    change(h.model.proof);
    assert.throws(() => action.confirm());
    assert.equal(h.model.deletions, 0);
  }
});
test("费用已提交操作的参数版本改变仍保持失败和待恢复记录", () => {
  const h = harness(),
    op = h.modules.transitions.beginFeeSettlement(h.state, 3000);
  h.register(op, h.body(3000, first));
  h.publish("settled3000", first);
  h.model.versions[0]._xmin = "new-version";
  assert.throws(() => op.confirm(), /parameter_changed/);
  assert(h.state.recover);
  assert.equal(h.model.deletions, 0);
});
test("费用已有待决操作时不得覆盖登记清单", () => {
  const h = harness();
  h.modules.transitions.beginFeeSettlement(h.state, 3000);
  const recover = h.state.recover;
  assert.throws(
    () => h.modules.transitions.beginFeeSettlement(h.state, 3000),
    /operation_pending/,
  );
  assert.equal(h.state.recover, recover);
});
