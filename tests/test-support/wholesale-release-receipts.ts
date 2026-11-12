import assert from "node:assert/strict";
import { isDeepStrictEqual as same } from "node:util";
import type { RepairGraph, RepairRow } from "./settlement-repair-sql";
import type {
  ReleaseName,
  WholesaleReleaseSeed,
} from "./wholesale-release-seed";

export type Publication = { id: string; requestId: string };
export type AllocationStep = "partial" | "full" | "clear" | "assign";
export const plans = {
  partial: {
    name: "formal",
    revision: 1,
    status: "partially_allocated",
    amounts: [1000, 500],
  },
  full: {
    name: "formal",
    revision: 2,
    status: "allocated",
    amounts: [1600, 1400],
  },
  clear: { name: "formal", revision: 3, status: "pending", amounts: [0, 0] },
  assign: {
    name: "temporary",
    revision: 1,
    status: "allocated",
    amounts: [500, 0],
  },
} as const;

function single(rows: RepairRow[], name: string) {
  assert(rows.length === 1, `wholesale_release_${name}_count`);
  return rows[0];
}

export function checkWholesaleReleaseSeed(
  graph: RepairGraph,
  seed: WholesaleReleaseSeed,
) {
  const customer = single(graph.customers, "customer");
  const archive = single(graph.archives, "archive");
  const folder = single(graph.folders, "folder");
  const rate = single(graph.rates, "rate");
  assert(
    customer.id === seed.customerId &&
      customer.unique_name === seed.customerName &&
      customer.assigned_sales_user_id === seed.salesman &&
      customer.created_by_user_id === seed.salesman &&
      archive.customer_id === customer.id &&
      archive.user_id === null &&
      archive.kind === "customer" &&
      folder.archive_id === archive.id &&
      folder.system_key === "personal" &&
      folder.parent_id === null,
    "wholesale_release_customer_scope",
  );
  assert(
    rate.id === seed.rateId &&
      rate.original_currency === "USD" &&
      rate.target_currency === "CNY" &&
      rate.source === "manual" &&
      rate.rate_date === seed.date &&
      rate.provider_rate_date === seed.date &&
      rate.bank_quote === 720 &&
      rate.daily_exchange_rate === 7.2 &&
      rate.bank_code === "BOC",
    "wholesale_release_quote_scope",
  );
  assert(
    graph.orders.length === 2 && graph.commissions.length === 2,
    "wholesale_release_order_count",
  );
  for (const order of seed.orders) {
    const actual = single(
      graph.orders.filter((row) => row.id === order.id),
      "order",
    );
    const commission = single(
      graph.commissions.filter((row) => row.order_id === actual.id),
      "commission",
    );
    assert(
      actual.customer_id === seed.customerId &&
        actual.order_number === order.number &&
        actual.sales_user_id === seed.salesman &&
        actual.created_by_user_id === seed.salesman &&
        actual.customer_payment_amount === order.amount &&
        actual.customer_payment_currency === "USD" &&
        commission.customer_id === seed.customerId &&
        commission.beneficiary_user_id === seed.salesman &&
        commission.status === "pending",
      "wholesale_release_order_scope",
    );
  }
  const chronological = [...graph.orders].sort(
    (a, b) =>
      Date.parse(String(a.ordered_at)) - Date.parse(String(b.ordered_at)),
  );
  assert(
    same(
      chronological.map((row) => row.id),
      seed.orders.map((row) => row.id),
    ),
    "wholesale_release_order_date",
  );
}

export function checkWholesalePublication(
  graph: RepairGraph,
  seed: WholesaleReleaseSeed,
  name: ReleaseName,
  receipt: Publication,
) {
  const release = single(
    graph.releases.filter((row) => row.id === receipt.id),
    "publication",
  );
  const value = seed.releases[name];
  assert(
    release.publication_request_id === receipt.requestId &&
      release.note === value.note &&
      release.published_by_user_id === seed.finance &&
      release.customer_id === value.customerId &&
      release.customer_name === value.customerName &&
      release.release_amount === value.amount &&
      release.release_currency === "USD" &&
      release.received_on === seed.date &&
      release.status === "pending" &&
      release.allocation_revision === 0 &&
      release.allocation_customer_id === null &&
      release.cancelled_at === null,
    "wholesale_release_publication_proof",
  );
}

function updatedRelease(
  before: RepairGraph,
  after: RepairGraph,
  id: string,
  fields: Record<string, unknown>,
) {
  const old = single(
    before.releases.filter((row) => row.id === id),
    "old_release",
  );
  const saved = single(
    after.releases.filter((row) => row.id === id),
    "saved_release",
  );
  assert(
    old._xmin !== saved._xmin &&
      same(saved, {
        ...old,
        ...fields,
        _xmin: saved._xmin,
        updated_at: saved.updated_at,
      }),
    "wholesale_release_revision_proof",
  );
  return saved;
}

export function checkWholesaleCancellation(
  before: RepairGraph,
  after: RepairGraph,
  id: string,
  seed: WholesaleReleaseSeed,
) {
  const row = single(
    after.releases.filter((value) => value.id === id),
    "cancelled",
  );
  assert(
    Number.isFinite(Date.parse(String(row.cancelled_at))),
    "wholesale_release_cancel_time",
  );
  updatedRelease(before, after, id, {
    status: "cancelled",
    cancelled_by_user_id: seed.finance,
    cancelled_at: row.cancelled_at,
  });
  assert(
    same(
      { ...after, releases: after.releases.filter((row) => row.id !== id) },
      { ...before, releases: before.releases.filter((row) => row.id !== id) },
    ),
    "wholesale_release_cancel_scope",
  );
}

/** 每一步都比较实际分配、订单结汇和原冲销历史，金额合计相同也不能掩盖错配订单。 */
export function checkWholesaleAllocation(
  before: RepairGraph,
  after: RepairGraph,
  seed: WholesaleReleaseSeed,
  step: AllocationStep,
  id: string,
) {
  const plan = plans[step];
  updatedRelease(before, after, id, {
    status: plan.status,
    allocation_revision: plan.revision,
    allocation_customer_id: step === "clear" ? null : seed.customerId,
  });
  checkWholesaleReleaseSeed(after, seed);
  const outside = (graph: RepairGraph) => ({
    ...graph,
    releases: graph.releases.filter((row) => row.id !== id),
    allocations: graph.allocations.filter((row) => row.release_id !== id),
    settlements: graph.settlements.filter(
      (row) => row.source_settlement_release_id !== id,
    ),
    orders: [],
    commissions: [],
  });
  assert(
    same(outside(before), outside(after)),
    "wholesale_release_external_change",
  );

  const oldAllocations = before.allocations.filter(
    (row) => row.release_id === id,
  );
  const allocations = after.allocations.filter((row) => row.release_id === id);
  const settlements = after.settlements.filter(
    (row) => row.source_settlement_release_id === id,
  );
  const active = allocations.filter((row) => row.status === "active");
  const planned = seed.orders
    .map((order, i) => ({ order, amount: plan.amounts[i] }))
    .filter((value) => value.amount > 0);
  assert(
    active.length === planned.length &&
      settlements.length === planned.length &&
      allocations.length === oldAllocations.length + planned.length,
    "wholesale_release_allocation_count",
  );
  for (const row of oldAllocations) {
    const saved = single(
      allocations.filter((value) => value.id === row.id),
      "history",
    );
    if (row.status === "reversed") {
      assert(same(saved, row), "wholesale_release_prior_reversal_changed");
    } else {
      assert(
        saved._xmin !== row._xmin &&
          Number.isFinite(Date.parse(String(saved.reversed_at))) &&
          same(saved, {
            ...row,
            status: "reversed",
            settlement_id: null,
            reversed_by_user_id: seed.salesman,
            reversed_at: saved.reversed_at,
            _xmin: saved._xmin,
          }),
        "wholesale_release_reversal_proof",
      );
    }
  }
  const quote = after.rates[0];
  for (const { order, amount } of planned) {
    const allocation = single(
      active.filter((row) => row.order_id === order.id),
      "allocation",
    );
    const settlement = single(
      settlements.filter((row) => row.id === allocation.settlement_id),
      "settlement",
    );
    const expectedRmb = Math.round((amount * 7128) / 10) / 100;
    for (const row of [allocation, settlement]) {
      assert(
        row.order_id === order.id &&
          row.created_by_user_id === seed.salesman &&
          row.settled_on === seed.date &&
          row.exchange_rate_id === quote.id &&
          row.exchange_rate_quoted_at === quote.provider_updated_at &&
          row.buying_exchange_rate === 7.2 &&
          row.settlement_exchange_rate === 7.128,
        "wholesale_release_quote_link",
      );
    }
    assert(
      allocation.allocation_amount === amount &&
        settlement.settlement_amount === amount &&
        settlement.settlement_rmb_amount === expectedRmb &&
        !before.settlements.some((row) => row.id === settlement.id),
      "wholesale_release_allocation_amount",
    );
  }
  for (const [index, order] of seed.orders.entries()) {
    const current = single(
      after.orders.filter((row) => row.id === order.id),
      "order",
    );
    const previous = single(
      before.orders.filter((row) => row.id === order.id),
      "previous_order",
    );
    const commission = single(
      after.commissions.filter((row) => row.order_id === order.id),
      "commission",
    );
    const priorCommission = single(
      before.commissions.filter((row) => row.order_id === order.id),
      "previous_commission",
    );
    const amount = plan.amounts[index];
    const status =
      amount === 0
        ? "unsettled"
        : amount === order.amount
          ? "settled"
          : "partial_settled";
    assert(
      current.status === status &&
        current.ordered_at === previous.ordered_at &&
        current.customer_payment_rmb_amount ===
          (amount ? Math.round((amount * 7128) / 10) / 100 : null) &&
        commission.id === priorCommission.id,
      "wholesale_release_order_receipt",
    );
    const affected =
      amount > 0 ||
      oldAllocations.some(
        (row) => row.order_id === order.id && row.status === "active",
      );
    if (affected)
      assert(
        current._xmin !== previous._xmin,
        "wholesale_release_order_version",
      );
    else
      assert(
        same(current, previous) && same(commission, priorCommission),
        "wholesale_release_unaffected_order",
      );
  }
}
