import assert from "node:assert/strict";
import {
  readQuoteFixture,
  type QuoteFixture,
} from "./current-exchange-rate-fixture";
import {
  confirmFeeOrder,
  feeOrderSnapshot,
  requireFeeUuid,
  type FeeOrderFixture,
} from "./wholesale-fee-order-fixture";
import {
  beginFeeOrderChange,
  requireChangedFeeOrder,
  expectedFeeCommission,
} from "./wholesale-fee-order-transitions";
import type { FeeRow } from "./wholesale-fee-database";

/** 独立期望用整数分/百万分，先逐笔舍入再汇总，不能用产品计算器作为自己的测试答案。 */
const units = (value: number, places: number) =>
  BigInt(value.toFixed(places).replace(".", ""));
const roundedRatio = (numerator: bigint, denominator: bigint) =>
  numerator < 0n
    ? -((-numerator + denominator / 2n) / denominator)
    : (numerator + denominator / 2n) / denominator;
export function directUsdCompanyRate(buyingRate: number) {
  assert(Number.isFinite(buyingRate) && buyingRate > 0);
  return Number(roundedRatio(units(buyingRate, 6) * 99n, 100n)) / 1_000_000;
}

/** 原300美元、100+200两次登记场景；预声明请求，完整核对两笔不可变明细、订单和提成。 */
export function beginDirectUsdSettlement(
  state: FeeOrderFixture,
  quote: QuoteFixture,
  amount: 100 | 200,
  date: string,
) {
  confirmFeeOrder(state);
  const before = state.proof!,
    order = before.order!;
  assert(
    state.sample === "split-settlement" &&
      state.cohort === "new" &&
      order.customer_payment_amount === 300 &&
      order.customer_payment_currency === "USD",
    "direct_settlement_sample_changed",
  );
  const held = quote.proof ?? quote.before;
  assert(
    held && held.rate_date === date && quote.date === date,
    "direct_settlement_quote_missing",
  );
  assert(
    held.bank_code === "BOC" &&
      held.quote_type === "spot_buy" &&
      held.original_currency === "USD" &&
      held.target_currency === "CNY",
    "direct_settlement_quote_invalid",
  );
  const buyingRate = Number(held.daily_exchange_rate),
    companyRate = directUsdCompanyRate(buyingRate);
  const quoteUnchanged = () =>
    assert.deepEqual(
      readQuoteFixture(date),
      held,
      "direct_settlement_quote_changed",
    );
  quoteUnchanged();
  const previous = before.settlements.reduce(
    (sum, row) => sum + units(Number(row.settlement_amount), 2),
    0n,
  );
  assert(
    (previous === 0n && amount === 100) ||
      (previous === 10000n && amount === 200),
    "direct_settlement_sequence_changed",
  );
  const totalUsd = previous + units(amount, 2),
    companyMicros = units(companyRate, 6);
  const newRmb = roundedRatio(units(amount, 2) * companyMicros, 1_000_000n);
  const totalRmb = before.settlements.reduce(
    (sum, row) => sum + units(Number(row.settlement_rmb_amount), 2),
    newRmb,
  );
  const full = totalUsd === 30000n;
  // 已确认业务毛利只扣采购、运费、打包、其他和推荐费用；服务费/税费/手续费不重复扣减。
  const profitCents = full ? totalRmb - 1400n : 0n;
  const paid = Number(totalRmb) / 100,
    profit = Number(profitCents) / 100;
  const basis = full ? 0.7 : 0,
    commission = full ? 0.07 : 0;
  let request: string | undefined;
  const action = beginFeeOrderChange(state, (after) => {
    assert(request, "direct_settlement_request_missing");
    quoteUnchanged();
    const actual = requireChangedFeeOrder(before, after);
    const expectedOrder: FeeRow = {
      ...order,
      _xmin: actual._xmin,
      updated_at: actual.updated_at,
      settled_at: actual.updated_at,
      status: full ? "settled" : "partial_settled",
      settlement_exchange_rate:
        Number(roundedRatio(totalRmb * 1_000_000n, totalUsd)) / 1_000_000,
      customer_payment_rmb_amount: paid,
      gross_profit: full ? profit : order.gross_profit,
      gross_margin: full
        ? Number(roundedRatio(profitCents * 1_000_000n, totalRmb)) / 1_000_000
        : order.gross_margin,
      commission_basis_amount_rmb: basis,
      commission_calculation_snapshot: feeOrderSnapshot(order, profit, basis),
    };
    const matches = after.settlements.filter(
      (row) => row.settlement_request_id === request,
    );
    assert.equal(matches.length, 1, "direct_settlement_receipt_missing");
    const row = matches[0];
    requireFeeUuid(row.id);
    assert.deepEqual(
      row,
      {
        id: row.id,
        order_id: order.id,
        settlement_amount: amount,
        settlement_exchange_rate: companyRate,
        settlement_rmb_amount: Number(newRmb) / 100,
        settled_on: date,
        settled_at: actual.updated_at,
        created_at: actual.updated_at,
        created_by_user_id: state.actor,
        source_settlement_release_id: null,
        exchange_rate_id: held.id,
        buying_exchange_rate: buyingRate,
        exchange_rate_quoted_at: held.provider_updated_at,
        settlement_request_id: request,
        _xmin: actual._xmin,
      },
      "direct_settlement_row_changed",
    );
    assert.deepEqual(
      after.settlements.filter((item) => item.id !== row.id),
      before.settlements,
      "direct_settlement_previous_changed",
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
            paid,
            profit,
            basis,
          ),
        ],
      },
      "direct_settlement_graph_changed",
    );
  });
  return {
    ...action,
    register(value: unknown) {
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
        "direct_settlement_payload_changed",
      );
      if (request)
        assert.equal(
          request,
          input.p_settlement_request_id,
          "direct_settlement_request_changed",
        );
      assert(
        !before.settlements.some(
          (row) => row.settlement_request_id === input.p_settlement_request_id,
        ),
        "direct_settlement_request_preexisting",
      );
      request = input.p_settlement_request_id as string;
    },
  };
}
