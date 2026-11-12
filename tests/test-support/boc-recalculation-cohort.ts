import { randomUUID } from "node:crypto";
import { isDeepStrictEqual as same } from "node:util";

type Row = Record<string, unknown> & { id: string; _xmin: string };
const tables = {
  ordinary: "order_overview",
  orders: "wholesale_orders",
  settlements: "wholesale_order_settlements",
  commissions: "wholesale_commissions",
  logs: "wholesale_order_change_logs",
  attachments: "wholesale_order_list_attachments",
  allocations: "wholesale_settlement_release_allocations",
  runs: "exchange_rate_recalculation_runs",
  items: "exchange_rate_recalculation_items",
} as const;
type Graph = Record<keyof typeof tables, Row[]>;
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const quote = (value: string) => "'" + value.replaceAll("'", "''") + "'";
const raw = (row: Row) =>
  Object.fromEntries(Object.entries(row).filter(([key]) => key !== "_xmin"));
const expression =
  "jsonb_build_object(" +
  Object.entries(tables)
    .map(
      ([key, table]) =>
        `'${key}',(select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('_xmin',r.xmin::text) order by r.id),'[]') from public.${table} r)`,
    )
    .join(",") +
  ")";

/** 正式核算扫描全实例；本场景必须从空业务范围开始，只允许一个本次UUID备注订单。 */
export function createBocRecalculationCohort(execute: (sql: string) => string) {
  const note = `中行成交价核验 ${randomUUID()}`;
  const read = (): Graph => JSON.parse(execute(`select ${expression};`));
  let expected: Graph | undefined, orderId: string | undefined;
  let cleaned = false,
    cleanupAttempted = false;
  const keys = Object.keys(tables) as (keyof Graph)[];
  function shape(graph: Graph) {
    if (
      !graph ||
      !keys.every(
        (key) =>
          Array.isArray(graph[key]) &&
          graph[key].every(
            (row) =>
              row &&
              uuid.test(row.id) &&
              typeof row._xmin === "string" &&
              /^\d+$/.test(row._xmin),
          ),
      )
    )
      throw new Error("boc_cohort_graph_invalid");
  }
  function active() {
    if (!expected || cleaned || cleanupAttempted)
      throw new Error("boc_cohort_not_active");
    return expected;
  }
  function business(graph: Graph) {
    return Object.fromEntries(
      keys
        .filter((key) => !["runs", "items"].includes(key))
        .map((key) => [key, graph[key]]),
    );
  }
  function own(graph: Graph) {
    shape(graph);
    const order = graph.orders[0],
      settlement = graph.settlements[0];
    if (
      graph.ordinary.length ||
      graph.orders.length !== 1 ||
      !order ||
      order.id !== orderId ||
      order.notes !== note ||
      order.customer_id !== "c1000000-0000-4000-8000-000000000001" ||
      order.customer_payment_currency !== "USD" ||
      Number(order.customer_payment_amount) !== 300 ||
      Number(order.product_purchase_amount) !== 10 ||
      Number(order.international_shipping_fee) !== 1 ||
      Number(order.small_order_count) !== 1 ||
      !uuid.test(String(order.created_by_user_id)) ||
      graph.settlements.length !== 1 ||
      !settlement ||
      settlement.order_id !== orderId ||
      Number(settlement.settlement_amount) !== 100 ||
      graph.attachments.length ||
      graph.allocations.length ||
      ![...graph.commissions, ...graph.logs].every(
        (row) => row.order_id === orderId,
      )
    )
      throw new Error("boc_cohort_business_scope_changed");
    for (const item of graph.items)
      if (
        item.order_id !== orderId ||
        item.order_kind !== "wholesale" ||
        !graph.runs.some((run) => run.id === item.run_id)
      )
        throw new Error("boc_cohort_foreign_item");
    for (const run of graph.runs)
      if (
        run.created_by !== order.created_by_user_id ||
        !same(run.scope_counts, {
          ordinary: 0,
          wholesale: 1,
          settlements: 1,
          wholesaleCommissions: graph.commissions.length,
        })
      )
        throw new Error("boc_cohort_run_scope_changed");
  }
  return {
    note,
    prepare() {
      if (expected) throw new Error("boc_cohort_prepare_repeated");
      const graph = read();
      shape(graph);
      if (keys.some((key) => graph[key].length))
        throw new Error("boc_cohort_requires_empty_scope");
      expected = graph;
    },
    settled(id: string, settlementId: string) {
      const before = active();
      if (
        orderId ||
        keys.some((key) => before[key].length) ||
        !uuid.test(id) ||
        !uuid.test(settlementId)
      )
        throw new Error("boc_cohort_settlement_intent_invalid");
      orderId = id;
      const graph = read();
      own(graph);
      if (
        graph.runs.length ||
        graph.items.length ||
        graph.settlements[0].id !== settlementId
      )
        throw new Error("boc_cohort_settlement_receipt_invalid");
      expected = graph;
      return structuredClone(graph);
    },
    preview(id: string) {
      const before = active();
      if (!uuid.test(id) || before.runs.some((row) => row.id === id))
        throw new Error("boc_cohort_preview_intent_invalid");
      const graph = read();
      own(graph);
      const run = graph.runs.find((row) => row.id === id),
        items = graph.items.filter((row) => row.run_id === id);
      // 新预览只能增加本次一份run/一条明细，正式预览子事务不得改写业务行或已有凭证。
      if (
        !run ||
        run.status !== "preview" ||
        items.length !== 1 ||
        items[0].status !== "ready" ||
        !same(business(graph), business(before)) ||
        graph.runs.length !== before.runs.length + 1 ||
        graph.items.length !== before.items.length + 1 ||
        !same(
          graph.runs.filter((row) => row.id !== id),
          before.runs,
        ) ||
        !same(
          graph.items.filter((row) => row.run_id !== id),
          before.items,
        )
      )
        throw new Error("boc_cohort_preview_not_owned");
      expected = graph;
      return structuredClone(run);
    },
    applied(id: string) {
      const before = active(),
        graph = read();
      own(graph);
      const previousRun = before.runs.find((row) => row.id === id),
        run = graph.runs.find((row) => row.id === id);
      const previousItem = before.items.find((row) => row.run_id === id),
        item = graph.items.find((row) => row.run_id === id);
      const proof = run?.proof as Record<string, unknown> | undefined,
        snapshot = item?.after_snapshot as Record<string, unknown> | undefined;
      if (
        !previousRun ||
        previousRun.status !== "preview" ||
        !previousItem ||
        previousItem.status !== "ready" ||
        !run ||
        run.status !== "succeeded" ||
        !Number.isFinite(Date.parse(String(run.executed_at))) ||
        run._xmin === previousRun._xmin ||
        !proof ||
        proof.runId !== id ||
        proof.status !== "succeeded" ||
        typeof proof.affectedRows !== "number" ||
        !Number.isSafeInteger(proof.affectedRows) ||
        proof.affectedRows <= 0 ||
        proof.succeededCount !== 1 ||
        proof.failedCount !== 0 ||
        !item ||
        item.id !== previousItem.id ||
        item.status !== "succeeded" ||
        typeof item.affected_rows !== "number" ||
        !Number.isSafeInteger(item.affected_rows) ||
        item.affected_rows <= 0 ||
        item.message !== null ||
        item._xmin === previousItem._xmin ||
        !snapshot ||
        !same(snapshot.order, raw(graph.orders[0])) ||
        !same(snapshot.settlements, graph.settlements.map(raw)) ||
        !same(snapshot.commissions, graph.commissions.map(raw)) ||
        !same(snapshot.allocations, graph.allocations.map(raw)) ||
        graph.runs.length !== before.runs.length ||
        graph.items.length !== before.items.length ||
        !same(
          graph.runs.filter((row) => row.id !== id),
          before.runs.filter((row) => row.id !== id),
        ) ||
        !same(
          graph.items.filter((row) => row.run_id !== id),
          before.items.filter((row) => row.run_id !== id),
        )
      )
        throw new Error("boc_cohort_terminal_invalid");
      expected = graph;
      return structuredClone(graph);
    },
    unchanged() {
      const before = active();
      if (!same(read(), before)) throw new Error("boc_cohort_version_changed");
    },
    cleanup() {
      if (!expected || cleaned) return { deletedOrders: 0, inactive: true };
      const graph = active();
      if (!same(read(), graph))
        throw new Error("boc_cohort_cleanup_graph_changed");
      if (keys.every((key) => !graph[key].length)) {
        cleaned = true;
        return { deletedOrders: 0, empty: true };
      }
      own(graph);
      cleanupAttempted = true;
      const receipt = JSON.parse(
        execute(`begin;
        lock table ${Object.values(tables)
          .map((table) => "public." + table)
          .join(",")} in share row exclusive mode;
        do $$ declare changed integer; begin
          if ${expression} is distinct from ${quote(JSON.stringify(graph))}::jsonb then raise exception 'boc_cohort_cleanup_graph_changed'; end if;
          -- 不能因后来新增外键而扩大级联回收；未知关系先停止，留给维护者确认。
          if exists(select 1 from pg_constraint where contype='f'
            and confrelid in (${keys
              .filter((key) => key !== "ordinary")
              .map((key) => "'public." + tables[key] + "'::regclass")
              .join(",")})
            and conrelid not in (${keys
              .filter((key) => key !== "ordinary")
              .map((key) => "'public." + tables[key] + "'::regclass")
              .join(",")}))
            then raise exception 'boc_cohort_unknown_reference'; end if;
          delete from public.exchange_rate_recalculation_items where id in (${graph.items.map((row) => quote(row.id) + "::uuid").join(",") || "null::uuid"});
          get diagnostics changed=row_count;
          if changed<>${graph.items.length} then raise exception 'boc_cohort_cleanup_zero_items'; end if;
          delete from public.exchange_rate_recalculation_runs where id in (${graph.runs.map((row) => quote(row.id) + "::uuid").join(",") || "null::uuid"});
          get diagnostics changed=row_count;
          if changed<>${graph.runs.length} then raise exception 'boc_cohort_cleanup_zero_runs'; end if;
          delete from public.wholesale_orders where id='${orderId}' and notes=${quote(note)} and xmin::text=${quote(graph.orders[0]._xmin)};
          get diagnostics changed=row_count;
          if changed<>1 then raise exception 'boc_cohort_cleanup_zero_order'; end if;
        end $$;
        select jsonb_build_object('deletedOrders',1,'deletedRuns',${graph.runs.length},'deletedItems',${graph.items.length}); commit;`),
      );
      if (
        receipt.deletedOrders !== 1 ||
        receipt.deletedRuns !== graph.runs.length ||
        receipt.deletedItems !== graph.items.length
      )
        throw new Error("boc_cohort_cleanup_receipt_invalid");
      const after = read();
      shape(after);
      if (keys.some((key) => after[key].length))
        throw new Error("boc_cohort_cleanup_not_final");
      cleaned = true;
      return receipt;
    },
    evidence() {
      return structuredClone({
        note,
        orderId,
        cleaned,
        cleanupAttempted,
        expected,
      });
    },
  };
}
