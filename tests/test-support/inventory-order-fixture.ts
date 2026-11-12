import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import {
  inventoryFixtureKeys,
  readInventoryFixtureSql,
  removeInventoryFixtureSql,
  type InventoryFixtureGraph,
} from "./inventory-order-fixture-sql";

type OrderCase = "application" | "reuse";
type InventoryAction =
  | "credit_applied"
  | "credit_batch_reviewed"
  | "extension_requested"
  | "extension_reviewed"
  | "credit_repaid"
  | "credit_managed"
  | "items_updated";
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const writtenTables = {
  created: ["orders", "items"],
  credit_applied: ["credits"],
  credit_batch_reviewed: ["orders", "credits"],
  extension_requested: ["extensions"],
  extension_reviewed: ["extensions", "credits"],
  credit_repaid: ["repayments", "credits"],
  credit_managed: ["orders", "credits"],
  items_updated: ["orders", "items"],
} satisfies Record<
  InventoryAction | "created",
  (keyof InventoryFixtureGraph)[]
>;

function selectOrderGraph(
  graph: InventoryFixtureGraph,
  orderId: string,
): InventoryFixtureGraph {
  const credits = graph.credits.filter((row) => row.order_id === orderId);
  const creditIds = new Set(credits.map((row) => row.id));
  return {
    orders: graph.orders.filter((row) => row.id === orderId),
    items: graph.items.filter((row) => row.order_id === orderId),
    audit: graph.audit.filter((row) => row.order_id === orderId),
    extensions: graph.extensions.filter((row) =>
      creditIds.has(String(row.credit_application_id)),
    ),
    repayments: graph.repayments.filter((row) =>
      creditIds.has(String(row.credit_application_id)),
    ),
    credits,
    attachments: graph.attachments.filter((row) => row.order_id === orderId),
    objects: graph.objects.filter((row) =>
      String(row.name).startsWith(orderId + "/"),
    ),
  };
}

function omitRows(graph: InventoryFixtureGraph, scope: InventoryFixtureGraph) {
  return Object.fromEntries(
    inventoryFixtureKeys.map((key) => {
      const ids = new Set(scope[key].map((row) => row.id));
      return [key, graph[key].filter((row) => !ids.has(row.id))];
    }),
  ) as InventoryFixtureGraph;
}

export class InventoryOrderFixture {
  private readonly baseline: InventoryFixtureGraph;
  private last: InventoryFixtureGraph;
  private pendingWrite = false;
  private readonly orderIds = new Map<OrderCase, string>();
  private readonly token = randomUUID();
  private readonly sql: (statement: string) => string;

  constructor(sql: (statement: string) => string) {
    this.sql = sql;
    // 构造夹具先读数据库。原场景依赖固定客户没有在用信贷，由隔离实例提供起点。
    this.baseline = this.read();
    assert.equal(this.baseline.credits.length, 0, "专属库存夹具起点已有信贷");
    for (const number of ["INV-LOCAL-001", "INV-LOCAL-002"]) {
      assert.equal(
        this.baseline.orders.filter((row) => row.order_number === number)
          .length,
        1,
        "专属库存夹具缺少唯一的种子订单",
      );
    }
    this.last = this.baseline;
  }

  note(kind: OrderCase) {
    return `库存信贷回归-${this.token}-${kind === "application" ? "申请" : "复用"}`;
  }

  graph(kind: OrderCase) {
    const orderId = this.orderIds.get(kind);
    assert(orderId, "没有收到本轮订单 ID");
    return selectOrderGraph(this.last, orderId);
  }

  beginWrite() {
    assert(!this.pendingWrite, "上一次页面写入结果未确认");
    assert(
      isDeepStrictEqual(this.read(), this.last),
      "写前库存数据与已确认快照不符",
    );
    this.pendingWrite = true;
  }

  recordCreation(kind: OrderCase, id: unknown, amount: number) {
    assert(
      typeof id === "string" && uuid.test(id),
      "创建响应缺少有效的订单 ID",
    );
    assert(
      !this.orderIds.has(kind) &&
        !this.last.orders.some((row) => row.id === id),
      "创建响应指向已有订单",
    );
    const graph = this.confirm(id, "created", (next) => {
      const [row] = next.orders;
      assert.equal(row.notes, this.note(kind));
      assert.equal(row.purchase_amount, amount);
      assert.equal(row.currency, "USD");
      assert.equal(row.payment_status, "awaiting_payment");
      assert.equal(row.revision, 1);
      assert(
        typeof row.order_number === "string" && row.order_number.length > 0,
      );
    });
    this.orderIds.set(kind, id);
    return graph;
  }

  recordChange(kind: OrderCase, action: InventoryAction) {
    const [row] = this.graph(kind).orders;
    return this.confirm(row.id, action);
  }

  cleanup() {
    // 只要点击后的写入未能独立确认，便不能把新增行猜作夹具或删除旧快照。
    assert(!this.pendingWrite, "页面写入未确认，保留专属库存夹具以供核对");
    if (this.orderIds.size === 0) return;
    let remaining = this.last;
    for (const id of this.orderIds.values()) {
      remaining = omitRows(remaining, selectOrderGraph(this.last, id));
    }
    assert(
      isDeepStrictEqual(remaining, this.baseline),
      "清理范围之外存在数据变更",
    );
    const owned = omitRows(this.last, this.baseline);
    const counts = JSON.parse(
      this.sql(removeInventoryFixtureSql(this.last, this.baseline, owned)),
    );
    assert(
      isDeepStrictEqual(
        counts,
        Object.fromEntries(
          inventoryFixtureKeys.map((key) => [key, owned[key].length]),
        ),
      ),
      "删除影响行数与夹具不一致",
    );
    assert(
      isDeepStrictEqual(this.read(), this.baseline),
      "独立回读未恢复夹具基线",
    );
    return counts as Record<keyof InventoryFixtureGraph, number>;
  }

  private read(): InventoryFixtureGraph {
    return JSON.parse(this.sql(readInventoryFixtureSql));
  }

  private confirm(
    orderId: string,
    action: InventoryAction | "created",
    validate?: (next: InventoryFixtureGraph) => void,
  ) {
    assert(this.pendingWrite, "缺少写前夹具快照");
    const next = this.read();
    const before = selectOrderGraph(this.last, orderId);
    const after = selectOrderGraph(next, orderId);
    assert.equal(after.orders.length, 1);
    assert(
      after.attachments.length === 0 && after.objects.length === 0,
      "本场景没有附件写入，发现关联附件时保留现场",
    );
    assert(
      isDeepStrictEqual(omitRows(next, after), omitRows(this.last, before)),
      "发现当前订单之外的数据变更",
    );
    assert(
      isDeepStrictEqual(
        after.audit.filter((row) =>
          before.audit.some((old) => old.id === row.id),
        ),
        before.audit,
      ),
      "已有审计凭证发生变化",
    );
    const addedAudit = after.audit.filter(
      (row) => !before.audit.some((old) => old.id === row.id),
    );
    const expectedAuditCount = action === "credit_managed" ? 4 : 1;
    assert(
      addedAudit.length === expectedAuditCount &&
        addedAudit.every((row) => row.action === action),
      "数据库未返回预期的独立动作凭证",
    );
    // 审计行和本次改动来自同一个事务。连到同一订单、但由别的事务写入的行不能认领。
    const transaction = addedAudit[0]._xmin;
    assert(
      addedAudit.every((row) => row._xmin === transaction),
      "检测到多次提交",
    );
    const allowed = new Set<keyof InventoryFixtureGraph>(writtenTables[action]);
    for (const key of inventoryFixtureKeys) {
      if (key === "audit") continue;
      if (!allowed.has(key)) {
        assert(
          isDeepStrictEqual(before[key], after[key]),
          "本次动作以外的库存数据被修改",
        );
        continue;
      }
      const previous = new Map(before[key].map((row) => [row.id, row]));
      assert(
        after[key].every(
          (row) =>
            isDeepStrictEqual(previous.get(row.id), row) ||
            row._xmin === transaction,
        ),
        "订单内存在其他事务写入",
      );
      if (key !== "items") {
        assert(
          before[key].every((row) =>
            after[key].some((updated) => updated.id === row.id),
          ),
          "现有库存凭证意外消失",
        );
      }
    }
    validate?.(after);
    this.last = next;
    this.pendingWrite = false;
    return after;
  }
}
