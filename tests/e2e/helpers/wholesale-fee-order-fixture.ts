import assert from "node:assert/strict";
import { shanghaiDate } from "../../test-support/shanghai-calendar";
import {
  runWholesaleFeeSql,
  readFeeOrderProof,
  readFeeOrderVersions,
  findFeeOrders,
  buildFeeOrderCleanupSql,
  type FeeOrderProof,
  type FeeRow,
} from "./wholesale-fee-database";

export type FeeSavedOrder = FeeRow & { id: string; order_number: string };
export type FeeOrderFixture = {
  note: string;
  actor: string;
  customer: string;
  cohort: "new" | "existing";
  sample: "fees" | "creation-dedup" | "split-settlement";
  month: string;
  request?: string;
  payload?: Record<string, unknown>;
  proof?: FeeOrderProof;
  parameterProof?: FeeRow[];
  deleted?: boolean;
  // 页面写入中断后先核对预登记操作的终态，再决定原订单图能否回收。
  recover?: () => void;
  dispatchPending: number;
};
export function requireFeeUuid(value: unknown) {
  assert(
    typeof value === "string" &&
      /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
        value,
      ),
    "fee_order_uuid_invalid",
  );
}
export function createFeeOrderFixture(
  prefix: string,
  kind: string,
  customer: string,
  actor: string,
  cohort: "new" | "existing",
  sample: FeeOrderFixture["sample"] = "fees",
): FeeOrderFixture {
  assert(
    /^fees-e2e-[a-f0-9-]{36}$/i.test(prefix) && /^[a-z-]+$/.test(kind),
    "fee_order_scope_invalid",
  );
  requireFeeUuid(prefix.slice("fees-e2e-".length));
  requireFeeUuid(customer);
  requireFeeUuid(actor);
  assert(["new", "existing"].includes(cohort));
  assert(
    ["fees", "creation-dedup", "split-settlement"].includes(sample),
    "fee_order_sample_invalid",
  );
  return {
    note: `${prefix}-${kind}`,
    customer,
    actor,
    cohort,
    sample,
    month: shanghaiDate().slice(0, 7) + "-01",
    dispatchPending: 0,
  };
}

/** 此对象只用于核对页面原请求及专属只读场景的数据准备，不覆盖或替换前端请求。 */
export function feeOrderCreatePayload(state: FeeOrderFixture, request: string) {
  // 三组历史场景分别保留原输入，不能为复用夹具而改掉业务测试的金额。
  const sample = {
    fees: {
      p_small_order_count: 100,
      p_product_purchase_amount: 8500,
      p_international_shipping_fee: 1200,
      p_other_fee: 200,
      p_referral_commission_fee: 100,
      p_courier_company: null,
      p_customer_payment_currency: "CNY",
      p_customer_payment_amount: 12300,
      p_payment_platform: null,
    },
    "creation-dedup": {
      p_small_order_count: 1,
      p_product_purchase_amount: 100,
      p_international_shipping_fee: 20,
      p_other_fee: 3,
      p_referral_commission_fee: 2,
      p_courier_company: "DHL",
      p_customer_payment_currency: "USD",
      p_customer_payment_amount: 200,
      p_payment_platform: "Wise",
    },
    "split-settlement": {
      p_small_order_count: 1,
      p_product_purchase_amount: 10,
      p_international_shipping_fee: 1,
      p_other_fee: 0,
      p_referral_commission_fee: 0,
      p_courier_company: "DHL",
      p_customer_payment_currency: "USD",
      p_customer_payment_amount: 300,
      p_payment_platform: "Wise",
    },
  }[state.sample];
  return {
    p_customer_id: state.customer,
    p_creation_request_id: request,
    p_sales_user_id: "55555555-5555-4555-8555-555555555555",
    ...sample,
    p_notes: state.note,
    p_order_month: state.month,
  };
}
export function registerFeeOrderRequest(
  state: FeeOrderFixture,
  value: unknown,
) {
  const input = value as Record<string, unknown>;
  requireFeeUuid(input?.p_creation_request_id);
  assert.deepEqual(
    input,
    feeOrderCreatePayload(state, input.p_creation_request_id as string),
    "fee_order_create_payload_changed",
  );
  if (state.request) {
    assert.equal(input.p_creation_request_id, state.request);
    assert.deepEqual(input, state.payload);
    return;
  }
  assert.equal(
    findFeeOrders(state.actor, input.p_creation_request_id as string).length,
    0,
    "fee_order_request_preexisting",
  );
  state.request = input.p_creation_request_id as string;
  state.payload = JSON.parse(JSON.stringify(input));
}

export function feeOrderSnapshot(order: FeeRow, profit: number, basis: number) {
  return {
    versionId: order.salesman_commission_parameter_version_id,
    parameterCode: "wholesale_salesman_customer_commission",
    serviceFeeRmb: order.service_fee,
    commissionRate: order.commission_rate,
    grossProfitRmb: profit,
    commissionBasis: order.commission_basis,
    commissionBasisAmountRmb: basis,
  };
}
function validateInitialProof(state: FeeOrderFixture, proof: FeeOrderProof) {
  const order = proof.order;
  assert(order && state.payload, "fee_order_initial_missing");
  requireFeeUuid(order.id);
  requireFeeUuid(order.salesman_commission_parameter_version_id);
  requireFeeUuid(order.referral_amount_parameter_version_id);
  assert(
    typeof order.order_number === "string" &&
      /^\d{12}$/.test(order.order_number),
    "fee_order_number_invalid",
  );
  assert(
    typeof order._xmin === "string" && /^\d+$/.test(order._xmin),
    "fee_order_version_missing",
  );
  assert(
    Number.isFinite(Date.parse(String(order.created_at))),
    "fee_order_time_missing",
  );
  const basis = state.cohort === "new" ? "service_fee" : "gross_profit",
    rate = state.cohort === "new" ? 0.1 : 0.12;
  // 独立固定费用期望，不调用产品计算器，避免同一错误在测试两边同时通过。
  const expectedFees = {
    fees: {
      packing_fee: 300,
      service_fee: 500,
      cn_tax_fee: 300,
      payment_processing_fee: 108,
    },
    "creation-dedup": {
      packing_fee: 3,
      service_fee: 6.15,
      cn_tax_fee: 3.69,
      payment_processing_fee: 1.33,
    },
    "split-settlement": {
      packing_fee: 3,
      service_fee: 0.7,
      cn_tax_fee: 0.42,
      payment_processing_fee: 0.15,
    },
  }[state.sample];
  const expected = {
    ...Object.fromEntries(
      Object.entries(state.payload).map(([key, value]) => [
        key.slice(2),
        value,
      ]),
    ),
    id: order.id,
    order_number: order.order_number,
    created_by_user_id: state.actor,
    created_at: order.created_at,
    updated_at: order.created_at,
    ordered_at: order.created_at,
    settled_at: null,
    _xmin: order._xmin,
    ...expectedFees,
    status: "unsettled",
    settlement_exchange_rate: null,
    customer_payment_rmb_amount: null,
    gross_profit: null,
    gross_margin: null,
    commission_basis: basis,
    commission_rate: rate,
    commission_basis_amount_rmb: 0,
    salesman_commission_parameter_version_id:
      order.salesman_commission_parameter_version_id,
    referral_amount_parameter_version_id:
      order.referral_amount_parameter_version_id,
    commission_calculation_snapshot: {
      ...feeOrderSnapshot(order, 0, 0),
      commissionBasis: basis,
      commissionRate: rate,
    },
  };
  assert.deepEqual(order, expected, "fee_order_initial_scope_changed");
  assert.equal(
    proof.commissions.length,
    1,
    "fee_order_initial_commission_missing",
  );
  const commission = proof.commissions[0];
  requireFeeUuid(commission.id);
  assert(
    Number.isFinite(Date.parse(String(commission.calculated_at))),
    "fee_order_commission_time_missing",
  );
  assert.deepEqual(
    commission,
    {
      id: commission.id,
      order_id: order.id,
      customer_id: state.customer,
      beneficiary_user_id: "55555555-5555-4555-8555-555555555555",
      commission_rate: rate,
      parameter_version_id: order.salesman_commission_parameter_version_id,
      commission_basis: basis,
      commission_basis_amount_rmb: 0,
      commission_amount_rmb: 0,
      gross_profit_rmb: 0,
      order_payment_rmb_amount: 0,
      status: "pending",
      settled_at: null,
      settled_by_user_id: null,
      calculated_at: commission.calculated_at,
      calculation_snapshot: expected.commission_calculation_snapshot,
      _xmin: order._xmin,
    },
    "fee_order_initial_commission_changed",
  );
  for (const key of [
    "settlements",
    "logs",
    "attachments",
    "allocations",
  ] as const)
    assert.equal(proof[key].length, 0, "fee_order_initial_children_changed");
  const versions = readFeeOrderVersions(order);
  assert.equal(versions.length, 2);
  const salesman = versions.find(
      (row) => row.id === order.salesman_commission_parameter_version_id,
    ),
    referral = versions.find(
      (row) => row.id === order.referral_amount_parameter_version_id,
    );
  assert.equal(
    salesman?.parameter_code,
    "wholesale_salesman_customer_commission",
  );
  assert.deepEqual(salesman?.config, {
    existing_customer_rate: 0.12,
    new_customer_service_fee_rate: 0.1,
  });
  assert.equal(
    referral?.parameter_code,
    "wholesale_referral_order_amount_rate",
  );
  assert.deepEqual(referral?.config, { rate: 0.02 });
  state.parameterProof = versions;
}

/** 首次确认严格匹配初始形状；后续只能核对已有完整版本，不能把陌生更新收编为自有夹具。 */
export function confirmFeeOrder(state: FeeOrderFixture): FeeSavedOrder {
  assert(state.request, "fee_order_request_unregistered");
  const rows = findFeeOrders(state.actor, state.request);
  assert.equal(rows.length, 1, "fee_order_created_row_missing");
  requireFeeUuid(rows[0].id);
  const proof = readFeeOrderProof(rows[0].id as string);
  assert.deepEqual(rows[0], proof.order, "fee_order_read_changed");
  if (state.proof) {
    assert.deepEqual(proof, state.proof, "fee_order_confirmed_scope_changed");
    assert.deepEqual(
      readFeeOrderVersions(proof.order!),
      state.parameterProof,
      "fee_order_parameter_changed",
    );
  } else {
    validateInitialProof(state, proof);
    state.proof = proof;
  }
  return proof.order as FeeSavedOrder;
}
export function requireEmptyFeeOrder(proof: FeeOrderProof) {
  assert.equal(proof.order, null);
  for (const key of [
    "commissions",
    "settlements",
    "logs",
    "attachments",
    "allocations",
  ] as const)
    assert.equal(proof[key].length, 0, "fee_order_cleanup_child_remaining");
}
export function cleanupFeeOrder(state: FeeOrderFixture) {
  // 未确认终止的HTTP写入不能被一次零行查询冒充已回收，保留清单供隔离实例诊断。
  assert.equal(state.dispatchPending, 0, "fee_order_dispatch_unconfirmed");
  state.recover?.();
  if (!state.request) return { deleted: 0 };
  if (state.deleted) {
    requireEmptyFeeOrder(readFeeOrderProof(state.proof!.order!.id as string));
    assert.equal(findFeeOrders(state.actor, state.request).length, 0);
    return { deleted: 0 };
  }
  if (!state.proof && findFeeOrders(state.actor, state.request).length === 0)
    return { deleted: 0 };
  const order = confirmFeeOrder(state);
  const receipt = JSON.parse(
    runWholesaleFeeSql(buildFeeOrderCleanupSql(state.proof!)),
  );
  assert(
    receipt?.deleted === 1 && receipt.orderId === order.id,
    "fee_order_cleanup_receipt_invalid",
  );
  requireEmptyFeeOrder(readFeeOrderProof(order.id));
  assert.equal(findFeeOrders(state.actor, state.request).length, 0);
  state.deleted = true;
  return { deleted: 1 };
}
