import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

type ExecuteSql = (statement: string) => string;
type Row = Record<string, unknown>;
export type CommissionOrderProof = { order: Row | null } & Record<
  "commissions" | "settlements" | "logs" | "attachments" | "allocations",
  Row[]
>;
const quote = (value: string) => "'" + value.replaceAll("'", "''") + "'";
const children = {
  commissions: "wholesale_commissions",
  settlements: "wholesale_order_settlements",
  logs: "wholesale_order_change_logs",
  attachments: "wholesale_order_list_attachments",
  allocations: "wholesale_settlement_release_allocations",
} as const;

/** 只使用调用方明确提供的专属SQL能力；编号和备注均属于本次运行，不寻找或修改种子订单。 */
export function createCommissionMergeOrder(execute: ExecuteSql) {
  const id = randomUUID(),
    number = `MERGE-${id.slice(0, 8)}`,
    notes = `commission-merge-e2e:${id}`;
  let attempted = false,
    cleaned = false,
    cleanupAttempted = false;
  let expected: CommissionOrderProof | undefined;
  const expression = `jsonb_build_object('order',(select to_jsonb(t)||jsonb_build_object('_xmin',xmin::text)
    from public.wholesale_orders t where id='${id}'::uuid),${Object.entries(
      children,
    )
      .map(
        ([key, table]) =>
          `'${key}',(select coalesce(jsonb_agg(to_jsonb(t)||jsonb_build_object('_xmin',xmin::text)order by id),'[]'::jsonb)
      from public.${table} t where order_id='${id}'::uuid)`,
      )
      .join(",")})`;
  const read = (): CommissionOrderProof =>
    JSON.parse(execute(`select ${expression};`));
  function active() {
    if (!expected || cleaned || cleanupAttempted)
      throw new Error("commission_order_not_active");
    return expected;
  }
  function validate(proof: CommissionOrderProof) {
    const order = proof?.order,
      commission = proof?.commissions?.[0];
    if (
      !order ||
      !Object.keys(children).every((key) =>
        Array.isArray(proof[key as keyof typeof children]),
      ) ||
      order.id !== id ||
      order.order_number !== number ||
      order.notes !== notes ||
      order.sales_user_id !== "55555555-5555-4555-8555-555555555555" ||
      order.customer_id !== "c1000000-0000-4000-8000-000000000001" ||
      order.customer_payment_currency !== "CNY" ||
      Number(order.customer_payment_amount) !== 10000 ||
      Number(order.product_purchase_amount) !== 9000 ||
      !/^\d+$/.test(String(order._xmin)) ||
      proof.commissions.length !== 1 ||
      !commission ||
      commission.order_id !== id ||
      !/^\d+$/.test(String(commission._xmin)) ||
      !(Number(commission.commission_amount_rmb) > 0) ||
      !Number.isFinite(Number(commission.commission_amount_rmb)) ||
      commission.beneficiary_user_id !== order.sales_user_id ||
      proof.settlements.length !== 1 ||
      proof.settlements[0].order_id !== id ||
      Number(proof.settlements[0].settlement_amount) !== 10000 ||
      Number(proof.settlements[0].settlement_exchange_rate) !== 1 ||
      !Array.isArray(proof.logs) ||
      proof.attachments.length !== 0 ||
      proof.allocations.length !== 0
    )
      throw new Error("commission_order_receipt_invalid");
  }
  return {
    id,
    number,
    prepare() {
      if (attempted)
        throw new Error("commission_order_prepare_already_attempted");
      attempted = true;
      // 订单和结汇在同一事务；第二步失败不能留下半份夹具。回执丢失则保留实例调查。
      const proof = JSON.parse(
        execute(`begin;set local standard_conforming_strings=on;
        insert into public.wholesale_orders(id,order_number,customer_id,sales_user_id,
          product_purchase_amount,customer_payment_currency,customer_payment_amount,order_month,notes)
        values('${id}',${quote(number)},'c1000000-0000-4000-8000-000000000001',
          '55555555-5555-4555-8555-555555555555',9000,'CNY',10000,date_trunc('month',now())::date,${quote(notes)});
        insert into public.wholesale_order_settlements(order_id,settlement_amount,settlement_exchange_rate,settled_on)
          values('${id}',10000,1,current_date);
        select ${expression};commit;`),
      );
      validate(proof);
      if (
        proof.commissions[0].status !== "pending" ||
        proof.commissions[0].settled_at !== null
      )
        throw new Error("commission_order_initial_status_invalid");
      expected = proof;
      this.assertUnchanged();
    },
    snapshot() {
      return structuredClone(active());
    },
    assertUnchanged() {
      if (!isDeepStrictEqual(read(), active()))
        throw new Error("commission_order_changed");
    },
    confirmSettlement() {
      const before = active(),
        actual = read();
      validate(actual);
      const old = before.commissions[0],
        next = actual.commissions[0];
      if (
        old.status !== "pending" ||
        next.status !== "settled" ||
        typeof next.settled_at !== "string" ||
        !Number.isFinite(Date.parse(next.settled_at)) ||
        next._xmin === old._xmin
      )
        throw new Error("commission_order_terminal_invalid");
      // 此表没有updated_at；只允许状态、结算时间和行版本变化，金额、受益人及其他子行必须不变。
      const normalized = structuredClone(actual);
      for (const field of ["status", "settled_at", "_xmin"])
        normalized.commissions[0][field] = old[field];
      if (!isDeepStrictEqual(normalized, before))
        throw new Error("commission_order_unexpected_write");
      expected = actual;
      return structuredClone(next);
    },
    cleanup() {
      if (!attempted || cleaned) return { deleted: 0, notCreated: !attempted };
      if (!expected)
        throw new Error("commission_order_prepare_outcome_unknown");
      if (cleanupAttempted)
        throw new Error("commission_order_cleanup_outcome_unknown");
      const proof = active();
      cleanupAttempted = true;
      const receipt = JSON.parse(
        execute(`begin;set local standard_conforming_strings=on;
        lock table public.wholesale_orders,${Object.values(children)
          .map((t) => `public.${t}`)
          .join(",")}
          in share row exclusive mode;
        do $commission_cleanup$declare affected integer;begin
          if exists(select 1 from pg_constraint c where c.contype='f' and
            c.confrelid='public.wholesale_orders'::regclass and c.conrelid not in(
              ${Object.values(children)
                .map((t) => `'public.${t}'::regclass`)
                .join(",")})) then
            raise exception 'commission_order_unknown_reference';end if;
          if ${expression} is distinct from ${quote(JSON.stringify(proof))}::jsonb then
            raise exception 'commission_order_cleanup_changed';end if;
          delete from public.wholesale_orders where id='${id}'::uuid and xmin::text=${quote(String(proof.order!._xmin))};
          get diagnostics affected=row_count;
          if affected<>1 then raise exception 'commission_order_cleanup_zero';end if;
        end $commission_cleanup$;
        commit;select jsonb_build_object('deleted',1,'orderId','${id}');`),
      );
      if (receipt.deleted !== 1 || receipt.orderId !== id)
        throw new Error("commission_order_cleanup_receipt_invalid");
      const after = read();
      if (
        after.order !== null ||
        Object.keys(children).some(
          (key) => after[key as keyof typeof children].length !== 0,
        )
      )
        throw new Error("commission_order_cleanup_not_final");
      cleaned = true;
      return receipt;
    },
    evidence() {
      return {
        id,
        number,
        attempted,
        cleaned,
        cleanupAttempted,
        expected: structuredClone(expected),
      };
    },
  };
}
