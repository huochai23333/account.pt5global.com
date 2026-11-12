import assert from "node:assert/strict";
import { isDeepStrictEqual as same } from "node:util";
import {
  repairKeys,
  repairUuid,
  type RepairGraph,
  type RepairIdentity,
  type RepairRow,
} from "./settlement-repair-sql";

export type RepairDispatch = {
  operationId: string;
  transportRequestId: number;
};

export function requireRepairGraph(value: unknown): RepairGraph {
  const graph = value as RepairGraph | null;
  assert(
    graph &&
      Object.keys(graph).length === repairKeys.length &&
      repairKeys.every(
        (key) =>
          Array.isArray(graph[key]) &&
          graph[key].every(
            (row) =>
              row &&
              typeof row._xmin === "string" &&
              /^\d+$/.test(row._xmin) &&
              (key === "responses" || key === "queue"
                ? typeof row.id === "number" &&
                  Number.isSafeInteger(row.id) &&
                  row.id > 0
                : typeof row.id === "string" && repairUuid.test(row.id)),
          ),
      ),
    "settlement_repair_snapshot_invalid",
  );
  return graph;
}

function single(rows: RepairRow[], label: string) {
  assert(rows.length === 1, `settlement_repair_${label}_count`);
  return rows[0];
}

export function requireRepairOrder(
  graph: RepairGraph,
  fixture: RepairIdentity,
) {
  const customer = single(graph.customers, "customer");
  const order = single(graph.orders, "order");
  const commission = single(graph.commissions, "commission");
  const archive = single(graph.archives, "archive");
  const folder = single(graph.folders, "folder");
  assert(
    customer.id === fixture.customerId &&
      customer.unique_name === fixture.customerName &&
      customer.created_by_user_id === fixture.actor &&
      order.id === fixture.orderId &&
      order.customer_id === customer.id &&
      order.order_number === fixture.orderNumber &&
      order.created_by_user_id === fixture.actor &&
      order.customer_payment_currency === "USD" &&
      order.customer_payment_amount === 100 &&
      commission.order_id === order.id &&
      commission.customer_id === customer.id &&
      commission.status === "pending",
    "settlement_repair_order_ownership",
  );
  assert(
    archive.customer_id === customer.id &&
      archive.kind === "customer" &&
      archive.user_id === null &&
      folder.archive_id === archive.id &&
      folder.parent_id === null &&
      folder.zone === "personal" &&
      folder.system_key === "personal" &&
      folder.delete_batch_id === null,
    "settlement_repair_customer_archive_ownership",
  );
}

export function requireRepairRelease(
  graph: RepairGraph,
  fixture: RepairIdentity,
  receipt: { releaseId: string; requestId: string; note: string },
  status: "pending" | "allocated",
) {
  const release = single(graph.releases, "release");
  assert(
    release.id === receipt.releaseId &&
      release.publication_request_id === receipt.requestId &&
      release.note === receipt.note &&
      release.customer_id === fixture.customerId &&
      release.customer_name === fixture.customerName &&
      release.published_by_user_id === fixture.actor &&
      release.release_currency === "USD" &&
      release.release_amount === 10 &&
      release.received_on === fixture.date &&
      release.status === status &&
      release.allocation_revision === (status === "pending" ? 0 : 1) &&
      release.allocation_customer_id ===
        (status === "pending" ? null : fixture.customerId),
    "settlement_repair_release_proof",
  );
  return release;
}

/** 一份收款、一条任务、一次传输和一份日末报价必须互相指向。 */
export function requireRepairedRate(
  graph: RepairGraph,
  fixture: RepairIdentity,
  releaseId: string,
  dispatch: RepairDispatch,
) {
  const rate = single(graph.rates, "rate");
  const run = single(graph.runs, "run");
  const attempt = single(graph.attempts, "attempt");
  const response = single(graph.responses, "response");
  const target = {
    baseCurrency: "USD",
    rateDate: fixture.date,
    settlementReleaseId: releaseId,
  };
  assert(
    run.id === dispatch.operationId &&
      run.operation_key === "exchange-rate-sync" &&
      run.trigger_source === "event" &&
      run.requested_by_user_id === fixture.actor &&
      run.idempotency_key === `settlement-rate:${releaseId}:${fixture.date}` &&
      run.status === "succeeded" &&
      run.expected_count === 1 &&
      run.succeeded_count === 1 &&
      run.failed_count === 0 &&
      run.attempt_count === 1 &&
      run.next_attempt_at === null &&
      Number.isFinite(Date.parse(String(run.completed_at))) &&
      attempt.operation_run_id === run.id &&
      attempt.attempt_number === 1 &&
      attempt.status === "succeeded" &&
      Number.isFinite(Date.parse(String(attempt.completed_at))) &&
      attempt.transport_request_id === dispatch.transportRequestId &&
      response.id === dispatch.transportRequestId &&
      response.status_code === 200 &&
      response.error_msg === null &&
      response.timed_out !== true,
    "settlement_repair_task_proof",
  );
  assert(
    same(run.request_payload, { ...target, trigger: "settlement_repair" }),
    "settlement_repair_task_target",
  );
  assert(
    same(run.result_proof, {
      ...target,
      rateRecordId: rate.id,
      source: "nowapi",
      verifiedDates: [fixture.date],
    }),
    "settlement_repair_rate_proof",
  );
  assert(
    rate.original_currency === "USD" &&
      rate.target_currency === "CNY" &&
      rate.rate_date === fixture.date &&
      rate.provider_rate_date === fixture.date &&
      rate.source === "nowapi" &&
      rate.bank_code === "BOC" &&
      rate.quote_type === "spot_buy" &&
      rate.is_day_final === true &&
      rate.bank_quote === 669.93 &&
      rate.daily_exchange_rate === 6.6993 &&
      Date.parse(String(rate.provider_updated_at)) ===
        Date.parse(fixture.date + "T23:59:59+08:00"),
    "settlement_repair_exact_quote",
  );
  return rate;
}

/** 当前本地样本：10 USD、原价 6.6993，公司价 6.632307，实际入账 66.32。 */
export function requireRepairAllocation(
  graph: RepairGraph,
  fixture: RepairIdentity,
  releaseId: string,
  rate: RepairRow,
) {
  const allocation = single(graph.allocations, "allocation");
  const settlement = single(graph.settlements, "settlement");
  for (const row of [allocation, settlement]) {
    assert(
      row.order_id === fixture.orderId &&
        row.settled_on === fixture.date &&
        row.exchange_rate_id === rate.id &&
        row.exchange_rate_quoted_at === rate.provider_updated_at &&
        row.buying_exchange_rate === 6.6993 &&
        row.settlement_exchange_rate === 6.632307 &&
        row.created_by_user_id === fixture.actor,
      "settlement_repair_allocation_quote_link",
    );
  }
  assert(
    allocation.release_id === releaseId &&
      allocation.settlement_id === settlement.id &&
      allocation.status === "active" &&
      allocation.allocation_amount === 10 &&
      settlement.source_settlement_release_id === releaseId &&
      settlement.settlement_amount === 10 &&
      settlement.settlement_rmb_amount === 66.32 &&
      graph.orders[0].status === "partial_settled" &&
      graph.orders[0].customer_payment_rmb_amount === 66.32,
    "settlement_repair_allocation_proof",
  );
}
