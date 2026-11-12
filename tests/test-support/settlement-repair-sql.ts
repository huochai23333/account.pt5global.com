// 此文件只生成专属 SQL。页面、账号与外部服务不进入这个层。
export const repairTables = {
  customers: "public.wholesale_customers",
  archives: "public.document_archives",
  folders: "public.document_folders",
  rates: "public.exchange_rate",
  orders: "public.wholesale_orders",
  commissions: "public.wholesale_commissions",
  logs: "public.wholesale_order_change_logs",
  releases: "public.wholesale_settlement_releases",
  settlements: "public.wholesale_order_settlements",
  allocations: "public.wholesale_settlement_release_allocations",
  runs: "private.operation_runs",
  attempts: "private.operation_attempts",
  alerts: "private.system_health_alerts",
  responses: "net._http_response",
  queue: "net.http_request_queue",
} as const;

export const repairKeys = Object.keys(
  repairTables,
) as (keyof typeof repairTables)[];
export const repairUuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
export type RepairRow = Record<string, unknown> & {
  id: string | number;
  _xmin: string;
};
export type RepairGraph = Record<keyof typeof repairTables, RepairRow[]>;
export type RepairIdentity = {
  actor: string;
  customerId: string;
  orderId: string;
  customerName: string;
  orderNumber: string;
  date: string;
};

const literal = (value: string) => "'" + value.replaceAll("'", "''") + "'";
const tableNames = Object.values(repairTables);
// 固定角色会有个人档案。只纳入由本次客户插入触发的档案及目录。
const conditions: Partial<Record<keyof RepairGraph, string>> = {
  archives: "where t.customer_id is not null",
  folders:
    "where t.archive_id in (select id from public.document_archives where customer_id is not null)",
};
const graphSql = `jsonb_build_object(${repairKeys
  .map(
    (key) =>
      `${literal(key)},(select coalesce(jsonb_agg(to_jsonb(t)||jsonb_build_object('_xmin',t.xmin::text) order by t.id),'[]') from ${repairTables[key]} t ${conditions[key] ?? ""})`,
  )
  .join(",")})`;

// 共享历史日期在专属项目也只能只读检查。报价与任务归属随后靠本次真实回执确认。
export const readRepairGraphSql = `select ${graphSql};`;
export const emptyRepairGraph = () =>
  Object.fromEntries(
    repairKeys.map((key) => [key, [] as RepairRow[]]),
  ) as RepairGraph;
export const readRepairAdminSql = `select coalesce(jsonb_agg(distinct p.user_id),'[]')
  from public.user_profiles p join public.user_roles_data d on d.user_id=p.user_id
  join public.user_roles r on r.id=d.role_id where r.role='administrator' and p.status='active';`;

function start(expected: RepairGraph) {
  // 完整快照通过普通字符串传到临时表，禁止拼进 DO 的美元引号正文。
  return `begin;
    set local standard_conforming_strings=on;
    create temp table repair_expected(graph jsonb) on commit drop;
    insert into repair_expected values (${literal(JSON.stringify(expected))}::jsonb);
    select pg_advisory_xact_lock(hashtextextended('document-explorer-tree',0)) as repair_lock \\gset
    lock table ${tableNames.join(",")} in share row exclusive mode;`;
}

const compare = `if ${graphSql} is distinct from (select graph from repair_expected) then
  raise exception 'settlement_repair_graph_changed'; end if;`;

/** 收款场景共用这段锁内空范围校验；传入的准备语句只来自专属测试代码。 */
export function prepareEmptySettlementGraphSql(seed: string) {
  return `${start(emptyRepairGraph())}
    do $fixture$ begin ${compare} end $fixture$;
    ${seed}
    ${readRepairGraphSql} commit;`;
}

export function seedRepairOrderSql(identity: RepairIdentity) {
  const { actor, customerId, customerName, orderId, orderNumber } = identity;
  return prepareEmptySettlementGraphSql(`select set_config('request.jwt.claim.sub',${literal(actor)},true) as repair_actor \\gset
    insert into public.wholesale_customers(id,unique_name,created_by_user_id,salesman_commission_cohort)
      values (${literal(customerId)},${literal(customerName)},${literal(actor)},'new');
    insert into public.wholesale_orders(id,order_number,customer_id,created_by_user_id,order_month,ordered_at,customer_payment_amount,customer_payment_currency)
      values (${literal(orderId)},${literal(orderNumber)},${literal(customerId)},${literal(actor)},
        date_trunc('month',now() at time zone 'Asia/Shanghai')::date,now(),100,'USD');`);
}

export function removeRepairGraphSql(expected: RepairGraph) {
  const ids = (key: keyof RepairGraph) => {
    const type = key === "responses" || key === "queue" ? "bigint" : "uuid";
    return `select (value->>'id')::${type} from repair_expected, jsonb_array_elements(graph->${literal(key)})`;
  };
  const lockedRows = repairKeys
    .map(
      (key) =>
        `perform 1 from ${repairTables[key]} where id in (${ids(key)}) for update;`,
    )
    .join("\n");
  const tables = tableNames.map((table) => literal(table) + "::regclass");
  const scopes = repairKeys
    .map((key, index) => `(${tables[index]},${literal(key)})`)
    .join(",");
  const deletion = [...repairKeys]
    .reverse()
    .filter((key) => key !== "queue")
    .map(
      (key) =>
        `delete from ${repairTables[key]} where id in (${ids(key)});
      get diagnostics removed=row_count;
      if removed<>jsonb_array_length((select graph->${literal(key)} from repair_expected)) then
        raise exception 'settlement_repair_delete_count_${key}'; end if;`,
    )
    .join("\n");
  return `${start(expected)}
    do $fixture$ declare ref record; matched boolean; removed integer; begin
      ${lockedRows}
      ${compare}
      -- 行锁阻止新增外部关联。包括 SET NULL 和 CASCADE，任意未知引用均拒绝。
      for ref in select c.conrelid,a.attname,b.attname as parent,array_length(c.conkey,1) as keys,s.name,owned.name as owned_source
        from pg_constraint c join(values ${scopes})s(target,name)on s.target=c.confrelid
        left join(values ${scopes})owned(target,name)on owned.target=c.conrelid
        join pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
        join pg_attribute b on b.attrelid=c.confrelid and b.attnum=c.confkey[1]
        where c.contype='f' loop
        if ref.keys<>1 or ref.parent<>'id' then raise exception 'settlement_repair_unsupported_reference';end if;
        -- 同一张目录表也可能有别的账号数据，只排除本次已登记的子记录。
        execute format('select exists(select 1 from %s where %I::text in
          (select value->>''id'' from repair_expected,jsonb_array_elements(graph->$1)) %s)',
          ref.conrelid::regclass,ref.attname,
          case when ref.owned_source is null then '' else
            'and id::text not in (select value->>''id'' from repair_expected,jsonb_array_elements(graph->$2))' end)
          into matched using ref.name,ref.owned_source;
        if matched then raise exception 'settlement_repair_external_reference';end if;
      end loop;
      ${deletion}
      if ${graphSql} is distinct from ${literal(JSON.stringify(emptyRepairGraph()))}::jsonb then
        raise exception 'settlement_repair_cleanup_incomplete';end if;
    end $fixture$;
    select jsonb_object_agg(key,jsonb_array_length(value)) from repair_expected,jsonb_each(graph);
    commit;`;
}
