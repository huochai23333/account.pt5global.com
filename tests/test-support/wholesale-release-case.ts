import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { isDeepStrictEqual as same } from "node:util";
import { requireRepairGraph } from "./settlement-repair-receipts";
import {
  emptyRepairGraph,
  readRepairGraphSql,
  removeRepairGraphSql,
  repairKeys,
  repairUuid,
  type RepairGraph,
} from "./settlement-repair-sql";
import {
  checkWholesaleAllocation,
  checkWholesaleCancellation,
  checkWholesalePublication,
  checkWholesaleReleaseSeed,
  plans,
  type AllocationStep,
  type Publication,
} from "./wholesale-release-receipts";
import {
  readWholesaleReleaseSeed,
  seedWholesaleReleaseSql,
  type ReleaseName,
} from "./wholesale-release-seed";

const steps = [
  "formal",
  "temporary",
  "cancelled",
  "cancel",
  "partial",
  "full",
  "clear",
  "assign",
] as const;
type Step = (typeof steps)[number];

export function createWholesaleReleaseCase(execute: (sql: string) => string) {
  const seed = readWholesaleReleaseSeed(execute);
  const read = () =>
    requireRepairGraph(JSON.parse(execute(readRepairGraphSql)));
  const publications = new Map<ReleaseName, Publication>();
  let expected: RepairGraph | undefined;
  let position = 0,
    inFlight: Step | undefined;
  let preparationAttempted = false,
    cleanupAttempted = false,
    cleaned = false;
  const requireSnapshot = () => {
    assert(
      expected && !cleanupAttempted && !cleaned,
      "wholesale_release_no_confirmed_snapshot",
    );
    return expected;
  };
  const release = (name: ReleaseName) => {
    const value = publications.get(name);
    assert(value, "wholesale_release_unrecorded_publication");
    return value.id;
  };
  function finish(
    step: Step,
    check: (before: RepairGraph, graph: RepairGraph) => void,
  ) {
    assert(inFlight === step, "wholesale_release_unrecorded_action");
    const before = requireSnapshot(),
      graph = read();
    check(before, graph);
    expected = graph;
    inFlight = undefined;
    position++;
  }
  return {
    seed,
    prepare() {
      assert(!preparationAttempted, "wholesale_release_prepare_repeated");
      assert(
        same(read(), emptyRepairGraph()),
        "wholesale_release_scope_occupied",
      );
      preparationAttempted = true;
      const graph = requireRepairGraph(
        JSON.parse(execute(seedWholesaleReleaseSql(seed))),
      );
      checkWholesaleReleaseSeed(graph, seed);
      const allowed = [
        "customers",
        "archives",
        "folders",
        "rates",
        "orders",
        "commissions",
      ];
      assert(
        repairKeys.every(
          (key) => allowed.includes(key) || graph[key].length === 0,
        ),
        "wholesale_release_seed_scope",
      );
      assert(same(read(), graph), "wholesale_release_seed_unconfirmed");
      expected = graph;
    },
    begin(step: Step) {
      requireSnapshot();
      assert(
        !inFlight && steps[position] === step,
        "wholesale_release_action_order",
      );
      // 写请求一旦可能已发送，就只有独立终态能解除未知状态。
      inFlight = step;
    },
    published(name: ReleaseName, receipt: Publication) {
      assert(
        repairUuid.test(receipt.id) &&
          repairUuid.test(receipt.requestId) &&
          ![...publications.values()].some(
            (old) =>
              old.id === receipt.id || old.requestId === receipt.requestId,
          ),
        "wholesale_release_publication_id",
      );
      finish(name, (before, graph) => {
        checkWholesalePublication(graph, seed, name, receipt);
        assert(
          same(
            {
              ...graph,
              releases: graph.releases.filter((row) => row.id !== receipt.id),
            },
            before,
          ),
          "wholesale_release_publication_scope",
        );
      });
      publications.set(name, { ...receipt });
    },
    cancelled(receipt: string) {
      const id = release("cancelled");
      assert(receipt === id, "wholesale_release_cancel_response");
      finish("cancel", (before, graph) =>
        checkWholesaleCancellation(before, graph, id, seed),
      );
    },
    allocated(step: AllocationStep) {
      const id = release(plans[step].name);
      finish(step, (before, graph) =>
        checkWholesaleAllocation(before, graph, seed, step, id),
      );
    },
    unchanged() {
      assert(
        same(read(), requireSnapshot()),
        "wholesale_release_versions_changed",
      );
    },
    suggested() {
      const graph = requireSnapshot();
      assert(
        graph.allocations.length === 0 && graph.settlements.length === 0,
        "wholesale_release_suggestion_baseline",
      );
      const orders = [...graph.orders].sort(
        (a, b) =>
          Date.parse(String(a.ordered_at)) - Date.parse(String(b.ordered_at)),
      );
      // 期望来自独立订单及空结汇快照。准备的容量已经验证，与页面草稿无关。
      const first = Number(orders[0].customer_payment_amount);
      return [
        {
          orderNumber: String(orders[0].order_number),
          amount: first.toFixed(2),
        },
        {
          orderNumber: String(orders[1].order_number),
          amount: (seed.releases.formal.amount - first).toFixed(2),
        },
      ];
    },
    cleanup() {
      if (!preparationAttempted || cleaned) return;
      const graph = requireSnapshot();
      assert(
        !inFlight && same(read(), graph),
        "wholesale_release_cleanup_unconfirmed",
      );
      cleanupAttempted = true;
      const receipt = JSON.parse(execute(removeRepairGraphSql(graph)));
      assert(
        same(
          receipt,
          Object.fromEntries(repairKeys.map((key) => [key, graph[key].length])),
        ),
        "wholesale_release_cleanup_counts",
      );
      assert(
        same(read(), emptyRepairGraph()),
        "wholesale_release_cleanup_readback",
      );
      cleaned = true;
      return receipt;
    },
    evidence() {
      return {
        completed: steps.slice(0, position),
        inFlight,
        cleanupAttempted,
        cleaned,
        publications: Object.fromEntries(publications),
        rows: expected
          ? Object.fromEntries(
              repairKeys.map((key) => [
                key,
                expected![key].map((row) => ({
                  id: row.id,
                  version: row._xmin,
                  status: row.status,
                  revision: row.allocation_revision,
                })),
              ]),
            )
          : null,
        fingerprint: expected
          ? createHash("sha256").update(JSON.stringify(expected)).digest("hex")
          : null,
      };
    },
  };
}
