import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { isDeepStrictEqual as same } from "node:util";
import {
  emptyRepairGraph,
  readRepairAdminSql,
  readRepairGraphSql,
  removeRepairGraphSql,
  repairKeys,
  repairUuid,
  seedRepairOrderSql,
  type RepairGraph,
} from "./settlement-repair-sql";
import {
  requireRepairAllocation,
  requireRepairGraph,
  requireRepairOrder,
  requireRepairRelease,
  requireRepairedRate,
  type RepairDispatch,
} from "./settlement-repair-receipts";

export function createSettlementRepairCase(
  execute: (sql: string) => string,
  date: string,
) {
  assert(
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      new Date(date).toISOString().slice(0, 10) === date,
    "settlement_repair_date_invalid",
  );
  const admins: unknown = JSON.parse(execute(readRepairAdminSql));
  assert(
    Array.isArray(admins) &&
      admins.length === 1 &&
      typeof admins[0] === "string" &&
      repairUuid.test(admins[0]),
    "settlement_repair_requires_one_active_admin",
  );
  const marker = randomUUID();
  const note = `补汇率测试 ${marker}`;
  const identity = {
    actor: admins[0] as string,
    customerId: randomUUID(),
    orderId: randomUUID(),
    customerName: `Rate Repair ${marker}`,
    orderNumber: `REPAIR-${marker}`,
    date,
  };
  const read = () =>
    requireRepairGraph(JSON.parse(execute(readRepairGraphSql)));
  let expected: RepairGraph | undefined;
  let release:
    { releaseId: string; requestId: string; note: string } | undefined;
  let dispatch: RepairDispatch | undefined;
  let submissionUnconfirmed = false;
  let stage:
    | "new"
    | "preparing"
    | "prepared"
    | "published"
    | "allocated"
    | "cleanup_attempted"
    | "cleaned" = "new";

  return {
    identity,
    note,
    prepare() {
      assert(stage === "new", "settlement_repair_prepare_repeated");
      assert(
        same(read(), emptyRepairGraph()),
        "settlement_repair_scope_occupied",
      );
      stage = "preparing";
      const graph = requireRepairGraph(
        JSON.parse(execute(seedRepairOrderSql(identity))),
      );
      requireRepairOrder(graph, identity);
      assert(
        repairKeys.every(
          (key) =>
            [
              "customers",
              "archives",
              "folders",
              "orders",
              "commissions",
            ].includes(key) || graph[key].length === 0,
        ),
        "settlement_repair_prepare_unexpected_write",
      );
      assert(same(read(), graph), "settlement_repair_prepare_readback");
      expected = graph;
      stage = "prepared";
    },
    published(releaseId: string, requestId: string) {
      assert(
        stage === "prepared" &&
          expected &&
          repairUuid.test(releaseId) &&
          repairUuid.test(requestId),
        "settlement_repair_publication_receipt",
      );
      const graph = read(),
        receipt = { releaseId, requestId, note };
      requireRepairRelease(graph, identity, receipt, "pending");
      // 发布应只增加收款。订单、任务与报价在保存分配前均维持原版本。
      assert(
        same({ ...graph, releases: [] }, expected),
        "settlement_repair_publication_changed_scope",
      );
      expected = graph;
      release = receipt;
      stage = "published";
    },
    beginAllocation() {
      assert(
        stage === "published" && !submissionUnconfirmed && !dispatch,
        "settlement_repair_submission_invalid",
      );
      submissionUnconfirmed = true;
    },
    dispatched(value: RepairDispatch) {
      assert(
        stage === "published" &&
          submissionUnconfirmed &&
          !dispatch &&
          repairUuid.test(value.operationId) &&
          Number.isSafeInteger(value.transportRequestId) &&
          value.transportRequestId > 0,
        "settlement_repair_dispatch_receipt",
      );
      dispatch = { ...value };
    },
    allocated() {
      assert(
        stage === "published" && release && expected && dispatch,
        "settlement_repair_missing_dispatch",
      );
      const graph = read();
      requireRepairOrder(graph, identity);
      const saved = requireRepairRelease(graph, identity, release, "allocated");
      assert(
        saved._xmin !== expected.releases[0]._xmin &&
          graph.orders[0]._xmin !== expected.orders[0]._xmin &&
          graph.commissions[0].id === expected.commissions[0].id &&
          graph.queue.length === 0 &&
          graph.alerts.length === 0 &&
          graph.logs.length === 0,
        "settlement_repair_allocation_graph",
      );
      assert(
        ["customers", "archives", "folders"].every((key) => {
          const scope = key as "customers" | "archives" | "folders";
          return same(graph[scope], expected![scope]);
        }),
        "settlement_repair_customer_changed",
      );
      const rate = requireRepairedRate(
        graph,
        identity,
        release.releaseId,
        dispatch,
      );
      requireRepairAllocation(graph, identity, release.releaseId, rate);
      expected = graph;
      stage = "allocated";
      submissionUnconfirmed = false;
    },
    refused() {
      assert(
        stage === "published" && submissionUnconfirmed && !dispatch && expected,
        "settlement_repair_refusal_without_submission",
      );
      assert(same(read(), expected), "settlement_repair_refusal_changed_scope");
      submissionUnconfirmed = false;
    },
    unchanged() {
      assert(
        expected && (stage === "published" || stage === "allocated"),
        "settlement_repair_not_published",
      );
      assert(
        same(read(), expected),
        "settlement_repair_business_versions_changed",
      );
    },
    cleanup() {
      if (stage === "new" || stage === "cleaned") return;
      assert(
        expected &&
          !submissionUnconfirmed &&
          !["preparing", "cleanup_attempted"].includes(stage) &&
          (!dispatch || stage === "allocated"),
        "settlement_repair_cleanup_unconfirmed",
      );
      assert(
        same(read(), expected),
        "settlement_repair_cleanup_snapshot_changed",
      );
      // 先记“已发出”。一旦进程回包丢失，不能再对旧快照重复删除。
      stage = "cleanup_attempted";
      const receipt = JSON.parse(execute(removeRepairGraphSql(expected)));
      assert(
        same(
          receipt,
          Object.fromEntries(
            repairKeys.map((key) => [key, expected![key].length]),
          ),
        ),
        "settlement_repair_cleanup_receipt",
      );
      assert(
        same(read(), emptyRepairGraph()),
        "settlement_repair_cleanup_readback",
      );
      stage = "cleaned";
      return receipt;
    },
    evidence() {
      // 响应正文及内部错误可能含环境信息。附件只保留本次编号、版本和不可逆摘要。
      return {
        stage,
        identity,
        release,
        dispatch,
        submissionUnconfirmed,
        realBankVerification: false,
        fingerprint: expected
          ? createHash("sha256").update(JSON.stringify(expected)).digest("hex")
          : null,
        rows: expected
          ? Object.fromEntries(
              repairKeys.map((key) => [
                key,
                expected![key].map((row) => ({
                  id: row.id,
                  version: row._xmin,
                })),
              ]),
            )
          : null,
      };
    },
  };
}
