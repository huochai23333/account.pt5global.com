import assert from "node:assert/strict";
import { shanghaiDate } from "../../test-support/shanghai-calendar";
import {
  readFeeOrderProof,
  readFeeOrderVersions,
  type FeeOrderProof,
  type FeeRow,
} from "./wholesale-fee-database";
import {
  confirmFeeOrder,
  feeOrderCreatePayload,
  feeOrderSnapshot,
  requireFeeUuid,
  type FeeOrderFixture,
} from "./wholesale-fee-order-fixture";

type Acceptance = (after: FeeOrderProof) => void;

/** 未写入可安全取消；已提交必须完整匹配预声明变更。回读失败保留recover，禁止直接清理陌生版本。 */
export function beginFeeOrderChange(
  state: FeeOrderFixture,
  accept: Acceptance,
) {
  assert(!state.recover, "fee_order_operation_pending");
  confirmFeeOrder(state);
  const before = state.proof!;
  let finished = false,
    written = false;
  const recover = () => {
    if (finished) return;
    assert.equal(state.proof, before, "fee_order_operation_baseline_changed");
    const after = readFeeOrderProof(before.order!.id as string);
    if (!isSame(after, before)) {
      accept(after);
      assert.deepEqual(
        readFeeOrderVersions(after.order!),
        state.parameterProof,
        "fee_order_operation_parameter_changed",
      );
      state.proof = after;
      written = true;
    }
    finished = true;
    state.recover = undefined;
  };
  state.recover = recover;
  return {
    confirm: () => {
      recover();
      assert(written, "fee_order_operation_not_written");
    },
  };
}
function isSame(a: unknown, b: unknown) {
  try {
    assert.deepEqual(a, b);
    return true;
  } catch {
    return false;
  }
}
export function requireChangedFeeOrder(
  before: FeeOrderProof,
  after: FeeOrderProof,
) {
  const row = after.order;
  assert(row, "fee_order_operation_order_missing");
  assert(
    typeof row._xmin === "string" &&
      /^\d+$/.test(row._xmin) &&
      row._xmin !== before.order!._xmin,
    "fee_order_operation_version_missing",
  );
  assert(
    Number.isFinite(Date.parse(String(row.updated_at))) &&
      Date.parse(String(row.updated_at)) >=
        Date.parse(String(before.order!.updated_at)),
    "fee_order_operation_time_missing",
  );
  assert.equal(after.commissions.length, 1);
  assert.equal(before.commissions.length, 1);
  const commission = after.commissions[0];
  assert.equal(commission._xmin, row._xmin);
  assert(
    Number.isFinite(Date.parse(String(commission.calculated_at))),
    "fee_order_operation_commission_time_missing",
  );
  return row;
}
export function expectedFeeCommission(
  before: FeeRow,
  order: FeeRow,
  calculated: FeeRow,
  amount: number,
  paid: number,
  profit: number,
  basis: number,
) {
  return {
    ...before,
    _xmin: order._xmin,
    calculated_at: calculated.calculated_at,
    order_payment_rmb_amount: paid,
    gross_profit_rmb: profit,
    commission_amount_rmb: amount,
    commission_basis_amount_rmb: basis,
    calculation_snapshot: order.commission_calculation_snapshot,
  };
}

/** CNY费用场景的明确凭证：一条原请求结汇、旧记录不动、状态/实收/毛利/提成全部一致。 */
export function beginFeeSettlement(state: FeeOrderFixture, amount: number) {
  confirmFeeOrder(state);
  const before = state.proof!,
    order = before.order!;
  assert(
    order.product_purchase_amount === 8500 &&
      order.service_fee === 500 &&
      order.customer_payment_currency === "CNY" &&
      order.customer_payment_amount === 12300,
    "fee_settlement_fixture_changed",
  );
  const total =
    before.settlements.reduce(
      (sum, row) => sum + Number(row.settlement_amount),
      0,
    ) + amount;
  assert(
    Number.isFinite(amount) && amount > 0 && total <= 12300,
    "fee_settlement_amount_invalid",
  );
  const full = total === 12300,
    profit = full ? 2000 : 0,
    basis = full ? (state.cohort === "new" ? 500 : 2000) : 0;
  const commission = full ? (state.cohort === "new" ? 50 : 240) : 0;
  const date = shanghaiDate();
  let request: string | undefined;
  const action = beginFeeOrderChange(state, (after) => {
    assert(request, "fee_settlement_request_unregistered");
    const actual = requireChangedFeeOrder(before, after);
    const expectedOrder: FeeRow = {
      ...order,
      _xmin: actual._xmin,
      updated_at: actual.updated_at,
      settled_at: actual.updated_at,
      status: full ? "settled" : "partial_settled",
      settlement_exchange_rate: 1,
      customer_payment_rmb_amount: total,
      gross_profit: full ? 2000 : order.gross_profit,
      gross_margin: full ? 0.162602 : order.gross_margin,
      commission_basis_amount_rmb: basis,
      commission_calculation_snapshot: feeOrderSnapshot(order, profit, basis),
    };
    const owned = after.settlements.filter(
      (row) => row.settlement_request_id === request,
    );
    assert.equal(owned.length, 1, "fee_settlement_final_row_missing");
    const row = owned[0];
    requireFeeUuid(row.id);
    assert.deepEqual(
      row,
      {
        id: row.id,
        order_id: order.id,
        settlement_amount: amount,
        settlement_exchange_rate: 1,
        settlement_rmb_amount: amount,
        settled_on: date,
        settled_at: actual.updated_at,
        created_at: actual.updated_at,
        created_by_user_id: state.actor,
        source_settlement_release_id: null,
        exchange_rate_id: null,
        buying_exchange_rate: 1,
        exchange_rate_quoted_at: null,
        settlement_request_id: request,
        _xmin: actual._xmin,
      },
      "fee_settlement_receipt_changed",
    );
    assert.deepEqual(
      after.settlements.filter((item) => item.id !== row.id),
      before.settlements,
      "fee_settlement_previous_rows_changed",
    );
    assert.deepEqual(
      after,
      {
        ...before,
        order: expectedOrder,
        settlements: after.settlements,
        commissions: [
          expectedFeeCommission(
            before.commissions[0],
            expectedOrder,
            after.commissions[0],
            commission,
            total,
            profit,
            basis,
          ),
        ],
      },
      "fee_settlement_final_graph_changed",
    );
  });
  return {
    ...action,
    register: (value: unknown) => {
      const input = value as Record<string, unknown>;
      requireFeeUuid(input?.p_settlement_request_id);
      assert.deepEqual(
        input,
        {
          p_order_id: order.id,
          p_settlement_amount: amount,
          p_settlement_date: date,
          p_settlement_request_id: input.p_settlement_request_id,
        },
        "fee_settlement_payload_changed",
      );
      if (request)
        assert.equal(
          request,
          input.p_settlement_request_id,
          "fee_settlement_request_changed",
        );
      assert(
        !before.settlements.some(
          (row) => row.settlement_request_id === input.p_settlement_request_id,
        ),
        "fee_settlement_request_preexisting",
      );
      request = input.p_settlement_request_id as string;
    },
  };
}

function auditOrder(row: FeeRow) {
  const excluded = [
    "_xmin",
    "creation_request_id",
    "salesman_commission_parameter_version_id",
    "referral_amount_parameter_version_id",
    "packing_fee",
  ];
  return Object.fromEntries(
    Object.entries(row).filter(([key]) => !excluded.includes(key)),
  );
}
/** 原场景只将已收齐新客户的采购额改到11000；其他字段、结汇和旧日志必须完全保持。 */
export function beginFeeCostEdit(state: FeeOrderFixture) {
  confirmFeeOrder(state);
  const before = state.proof!,
    order = before.order!;
  assert(
    state.cohort === "new" &&
      order.status === "settled" &&
      order.product_purchase_amount === 8500 &&
      before.commissions[0].commission_amount_rmb === 50,
    "fee_cost_fixture_changed",
  );
  let registered = false;
  const action = beginFeeOrderChange(state, (after) => {
    assert(registered, "fee_cost_request_unregistered");
    const actual = requireChangedFeeOrder(before, after);
    const expectedOrder: FeeRow = {
      ...order,
      _xmin: actual._xmin,
      updated_at: actual.updated_at,
      product_purchase_amount: 11000,
      service_fee: 625,
      cn_tax_fee: 375,
      payment_processing_fee: 135,
      gross_profit: -500,
      gross_margin: -0.04065,
      commission_basis_amount_rmb: 625,
    };
    expectedOrder.commission_calculation_snapshot = feeOrderSnapshot(
      expectedOrder,
      -500,
      625,
    );
    const added = after.logs.filter(
      (row) => !before.logs.some((old) => old.id === row.id),
    );
    assert.equal(added.length, 1, "fee_cost_log_missing");
    const log = added[0];
    requireFeeUuid(log.id);
    assert.deepEqual(
      log,
      {
        id: log.id,
        order_id: order.id,
        actor_user_id: state.actor,
        action: "direct_update",
        previous_data: auditOrder(order),
        next_data: auditOrder(expectedOrder),
        note: null,
        created_at: actual.updated_at,
        _xmin: actual._xmin,
      },
      "fee_cost_log_changed",
    );
    assert.deepEqual(
      after.logs.filter((row) => row.id !== log.id),
      before.logs,
      "fee_cost_previous_logs_changed",
    );
    assert.deepEqual(
      after,
      {
        ...before,
        order: expectedOrder,
        logs: after.logs,
        commissions: [
          expectedFeeCommission(
            before.commissions[0],
            expectedOrder,
            after.commissions[0],
            62.5,
            12300,
            -500,
            625,
          ),
        ],
      },
      "fee_cost_final_graph_changed",
    );
  });
  return {
    ...action,
    register: (value: unknown) => {
      const expected: Record<string, unknown> = {
        ...feeOrderCreatePayload(state, "unused"),
        p_order_id: order.id,
        p_product_purchase_amount: 11000,
      };
      delete expected.p_creation_request_id;
      assert.deepEqual(value, expected, "fee_cost_payload_changed");
      registered = true;
    },
  };
}
