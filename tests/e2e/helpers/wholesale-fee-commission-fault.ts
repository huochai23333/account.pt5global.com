import assert from "node:assert/strict";
import {
  runWholesaleFeeSql,
  readFeeOrderProof,
  buildFeeCommissionAmountSql,
  type FeeOrderProof,
  type FeeRow,
} from "./wholesale-fee-database";
import {
  confirmFeeOrder,
  type FeeOrderFixture,
} from "./wholesale-fee-order-fixture";

/** 唯一允许差异是当前提成金额和本次UPDATE生成的xmin，其他父子行及版本一律保留。 */
function expectAmount(
  before: FeeOrderProof,
  after: FeeOrderProof,
  amount: number,
) {
  assert.equal(before.commissions.length, 1);
  assert.equal(after.commissions.length, 1);
  const row = after.commissions[0];
  assert(
    typeof row._xmin === "string" &&
      /^\d+$/.test(row._xmin) &&
      row._xmin !== before.commissions[0]._xmin,
    "fee_fault_version_missing",
  );
  assert.deepEqual(
    after,
    {
      ...before,
      commissions: [
        {
          ...before.commissions[0],
          commission_amount_rmb: amount,
          _xmin: row._xmin,
        },
      ],
    },
    "fee_fault_graph_changed",
  );
}
function same(a: unknown, b: unknown) {
  try {
    assert.deepEqual(a, b);
    return true;
  } catch {
    return false;
  }
}
function patch(
  before: FeeOrderProof,
  amount: 50 | 51,
  bind: (proof: FeeOrderProof) => void,
) {
  const receipt = JSON.parse(
    runWholesaleFeeSql(buildFeeCommissionAmountSql(before, amount)),
  );
  assert(receipt?.affected === 1, "fee_fault_receipt_invalid");
  expectAmount(before, receipt.proof, amount);
  // SQL已给出完整版本后立即冻结它；独立读回若遇到另一更新，不能再吸收新的xmin。
  bind(receipt.proof);
  const current = readFeeOrderProof(before.order!.id as string);
  assert.deepEqual(current, receipt.proof, "fee_fault_write_readback_changed");
  return current;
}

/** 回执不确定时仍按写入前清单独立辨认自己的单字段改动；绑定过后禁止再吸收其他版本。 */
export async function withFeeCommissionFault<T>(
  state: FeeOrderFixture,
  run: (wrong: FeeRow) => Promise<T> | T,
): Promise<T> {
  assert(!state.recover, "fee_fault_operation_pending");
  confirmFeeOrder(state);
  const before = state.proof!;
  assert(
    state.cohort === "new" &&
      before.order!.status === "settled" &&
      before.order!.product_purchase_amount === 8500 &&
      before.commissions[0].commission_amount_rmb === 50,
    "fee_fault_baseline_invalid",
  );
  let faultProof: FeeOrderProof | undefined,
    finished = false;
  const restore = () => {
    if (finished) return;
    const current = readFeeOrderProof(before.order!.id as string);
    if (!faultProof) {
      if (same(current, before)) {
        state.proof = before;
        state.recover = undefined;
        finished = true;
        return;
      }
      expectAmount(before, current, 51);
      faultProof = current;
    } else
      assert.deepEqual(current, faultProof, "fee_fault_changed_since_confirm");
    let restoreProof: FeeOrderProof | undefined;
    try {
      state.proof = patch(faultProof, 50, (proof) => {
        restoreProof = proof;
      });
      state.recover = undefined;
      finished = true;
    } catch (error) {
      // 恢复可能已提交但回执丢失；独立完整读回后才能标记已恢复，同时保留原错误。
      try {
        const restored = readFeeOrderProof(before.order!.id as string);
        if (restoreProof)
          assert.deepEqual(
            restored,
            restoreProof,
            "fee_fault_restore_changed_since_receipt",
          );
        else expectAmount(faultProof, restored, 50);
        state.proof = restored;
        state.recover = undefined;
        finished = true;
      } catch (verificationError) {
        throw new AggregateError(
          [error, verificationError],
          "fee_fault_restore_unconfirmed",
        );
      }
      throw error;
    }
  };
  // 必须在第一条SQL之前登记；提交后断线也能恢复，恢复失败则cleanup继续保留并核对它。
  state.recover = restore;
  let bodyFailed = false,
    bodyError: unknown,
    value: T | undefined;
  try {
    faultProof = patch(before, 51, (proof) => {
      faultProof = proof;
    });
    state.proof = faultProof;
    value = await run(faultProof.commissions[0]);
  } catch (error) {
    bodyFailed = true;
    bodyError = error;
  }
  let restoreFailed = false,
    restoreError: unknown;
  try {
    restore();
  } catch (error) {
    restoreFailed = true;
    restoreError = error;
  }
  if (bodyFailed && restoreFailed)
    throw new AggregateError(
      [bodyError, restoreError],
      "fee_fault_body_and_restore_failed",
    );
  if (bodyFailed) throw bodyError;
  if (restoreFailed) throw restoreError;
  return value as T;
}
