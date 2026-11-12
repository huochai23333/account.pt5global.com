import assert from "node:assert/strict";
import test from "node:test";
import { createFeeModel } from "../../tests/test-support/wholesale-fee-model.mjs";

function paid(options = {}) {
  const h = createFeeModel(options);
  h.full();
  return h;
}

test("提成故障正常恢复完整原图，仅自己的提成xmin改变", async () => {
  const h = paid(),
    before = JSON.parse(JSON.stringify(h.state.proof));
  const value = await h.modules.fault.withFeeCommissionFault(
    h.state,
    (wrong) => {
      assert.equal(wrong.commission_amount_rmb, 51);
      assert.throws(() => assert.equal(wrong.commission_amount_rmb, 50));
      return "recognized";
    },
  );
  assert.equal(value, "recognized");
  const after = JSON.parse(JSON.stringify(h.state.proof));
  assert.deepEqual(after, {
    ...before,
    commissions: [
      { ...before.commissions[0], _xmin: after.commissions[0]._xmin },
    ],
  });
  assert.notEqual(after.commissions[0]._xmin, before.commissions[0]._xmin);
  assert.equal(h.state.recover, undefined);
  assert.equal(h.model.faultWrites, 2);
  assert.equal(h.modules.orders.cleanupFeeOrder(h.state).deleted, 1);
});
test("提成故障保留抛出0的正文错误，恢复仍执行", async () => {
  const h = paid();
  await assert.rejects(
    h.modules.fault.withFeeCommissionFault(h.state, () => {
      throw 0;
    }),
    (error) => error === 0,
  );
  assert.equal(h.state.proof.commissions[0].commission_amount_rmb, 50);
  assert.equal(h.state.recover, undefined);
  assert.equal(h.model.faultWrites, 2);
});
test("提成故障正文与恢复失败都保留，cleanup再次按原版本恢复", async () => {
  const h = paid({ failRestoreOnce: true });
  await assert.rejects(
    h.modules.fault.withFeeCommissionFault(h.state, () => {
      throw 0;
    }),
    (error) => error.errors[0] === 0 && error.errors.length === 2,
  );
  assert.equal(h.model.proof.commissions[0].commission_amount_rmb, 51);
  assert(h.state.recover);
  assert.equal(h.modules.orders.cleanupFeeOrder(h.state).deleted, 1);
  assert.equal(h.model.faultWrites, 3);
  assert.equal(h.state.recover, undefined);
});
test("提成故障提交前失败和0行不能显示成功，也不盲目执行恢复", async () => {
  for (const options of [{ failFaultBefore: true }, { zeroFault: true }]) {
    const h = paid(options),
      before = JSON.stringify(h.model.proof);
    await assert.rejects(
      h.modules.fault.withFeeCommissionFault(h.state, () =>
        assert.fail("must not reach body"),
      ),
    );
    assert.equal(JSON.stringify(h.model.proof), before);
    assert.equal(h.model.faultWrites, 1);
    assert.equal(h.state.recover, undefined);
  }
});
test("提成故障写入回执丢失/错误时独立识别51并恢复，原错误保留", async () => {
  for (const options of [
    { loseFaultReceipt: true },
    { badFaultReceipt: true },
  ]) {
    const h = paid(options);
    await assert.rejects(
      h.modules.fault.withFeeCommissionFault(h.state, () =>
        assert.fail("must not reach body"),
      ),
    );
    assert.equal(h.state.proof.commissions[0].commission_amount_rmb, 50);
    assert.equal(h.state.recover, undefined);
    assert.equal(h.model.faultWrites, 2);
    assert.equal(h.modules.orders.cleanupFeeOrder(h.state).deleted, 1);
  }
});
test("提成恢复已提交但回执丢失/错误，绑定独立终态且继续报告错误", async () => {
  for (const options of [
    { loseRestoreReceipt: true },
    { badRestoreReceipt: true },
  ]) {
    const h = paid(options);
    await assert.rejects(
      h.modules.fault.withFeeCommissionFault(h.state, (wrong) =>
        assert.equal(wrong.commission_amount_rmb, 51),
      ),
    );
    assert.equal(h.state.proof.commissions[0].commission_amount_rmb, 50);
    assert.equal(h.state.recover, undefined);
    assert.equal(h.model.faultWrites, 2);
    assert.equal(h.modules.orders.cleanupFeeOrder(h.state).deleted, 1);
  }
});
test("提成故障期间其他内容/版本变化保留原样，禁止恢复或回收", async () => {
  for (const change of [
    (proof) => (proof.order.notes = "other-maintenance"),
    (proof) => (proof.commissions[0]._xmin = "999999"),
  ]) {
    const h = paid();
    let altered;
    await assert.rejects(
      h.modules.fault.withFeeCommissionFault(h.state, () => {
        change(h.model.proof);
        altered = JSON.stringify(h.model.proof);
      }),
      /changed_since_confirm/,
    );
    assert.equal(JSON.stringify(h.model.proof), altered);
    assert(h.state.recover);
    assert.throws(
      () => h.modules.orders.cleanupFeeOrder(h.state),
      /changed_since_confirm/,
    );
    assert.equal(h.model.deletions, 0);
    assert.equal(h.model.faultWrites, 1);
  }
});
test("提成故障拒绝未收齐或已有待决操作的订单", async () => {
  const waiting = createFeeModel();
  await assert.rejects(
    waiting.modules.fault.withFeeCommissionFault(waiting.state, () => {}),
    /baseline_invalid/,
  );
  const pending = createFeeModel();
  pending.modules.transitions.beginFeeSettlement(pending.state, 3000);
  await assert.rejects(
    pending.modules.fault.withFeeCommissionFault(pending.state, () => {}),
    /operation_pending/,
  );
  assert.equal(waiting.model.faultWrites, 0);
  assert.equal(pending.model.faultWrites, 0);
});

test("提成写入/恢复已取得回执后发生同值新版本，不得在读回阶段重新绑定", async () => {
  for (const options of [
    { foreignAfterFaultReceipt: true },
    { foreignAfterRestoreReceipt: true },
  ]) {
    const h = paid(options);
    await assert.rejects(
      h.modules.fault.withFeeCommissionFault(h.state, () => {}),
    );
    const preserved = JSON.stringify(h.model.proof);
    assert(h.state.recover);
    assert.throws(() => h.modules.orders.cleanupFeeOrder(h.state));
    assert.equal(JSON.stringify(h.model.proof), preserved);
    assert.equal(h.model.deletions, 0);
  }
});
