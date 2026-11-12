// 本文件只生成夹具 SQL。固定表名按删除依赖排序，Storage 两张表全程只读。
export const inventoryFixtureTables = {
  audit: "public.customer_inventory_order_audit_logs",
  repayments: "public.customer_inventory_credit_repayments",
  extensions: "public.customer_inventory_credit_extension_requests",
  credits: "public.customer_inventory_credit_applications",
  items: "public.customer_inventory_order_items",
  orders: "public.customer_inventory_orders",
  attachments: "public.customer_inventory_order_list_attachments",
  objects: "storage.objects",
} as const;

type TableKey = keyof typeof inventoryFixtureTables;
export type InventoryFixtureRow = Record<string, unknown> & {
  id: string;
  _xmin: string;
};
export type InventoryFixtureGraph = Record<TableKey, InventoryFixtureRow[]>;

export const inventoryFixtureKeys = Object.keys(
  inventoryFixtureTables,
) as TableKey[];
const deletionKeys = inventoryFixtureKeys.filter(
  (key) => key !== "attachments" && key !== "objects",
);
const literal = (value: string) => "'" + value.replaceAll("'", "''") + "'";
const graphSql = `jsonb_build_object(${inventoryFixtureKeys
  .map((key) => {
    const scope =
      key === "objects"
        ? "where t.bucket_id = 'customer-inventory-order-lists'"
        : "";
    return `${literal(key)}, (select coalesce(
    jsonb_agg(to_jsonb(t) || jsonb_build_object('_xmin', t.xmin::text) order by t.id), '[]'
    ) from ${inventoryFixtureTables[key]} t ${scope})`;
  })
  .join(",")})`;

export const readInventoryFixtureSql = `select ${graphSql};`;

export function removeInventoryFixtureSql(
  last: InventoryFixtureGraph,
  baseline: InventoryFixtureGraph,
  owned: InventoryFixtureGraph,
) {
  const targets = deletionKeys.map(
    (key) => `${literal(inventoryFixtureTables[key])}::regclass`,
  );
  const deleteExactRows = deletionKeys
    .map(
      (key) => `
    delete from ${inventoryFixtureTables[key]}
      where id in (select (fixture_row->>'id')::uuid from inventory_fixture,
        jsonb_array_elements(owned->${literal(key)}) as fixture_row);
    get diagnostics removed = row_count;
    if removed <> (select jsonb_array_length(owned->${literal(key)}) from inventory_fixture) then
      raise exception 'inventory_fixture_delete_count_${key}';
    end if;`,
    )
    .join("\n");

  // 先锁表再复查版本和引用，防止清理时同一订单被别人修改或追加附件。
  // 新增级联或置空外键时停止清理，保留现场供人工核对。
  return `begin;
    set local standard_conforming_strings = on;
    create temp table inventory_fixture (last jsonb, baseline jsonb, owned jsonb) on commit drop;
    insert into inventory_fixture values (
      ${literal(JSON.stringify(last))}, ${literal(JSON.stringify(baseline))}, ${literal(JSON.stringify(owned))}
    );
    lock table ${Object.values(inventoryFixtureTables).join(", ")} in share row exclusive mode;
    do $inventory$ declare removed integer; begin
      if ${graphSql} is distinct from (select last from inventory_fixture) then
        raise exception 'inventory_fixture_changed';
      end if;
      if exists (select 1 from pg_constraint
        where contype = 'f' and confrelid in (${targets.join(", ")})
        and confdeltype not in ('a', 'r')) then
        raise exception 'inventory_fixture_unsafe_reference';
      end if;
      ${deleteExactRows}
      if ${graphSql} is distinct from (select baseline from inventory_fixture) then
        raise exception 'inventory_fixture_cleanup_incomplete';
      end if;
    end $inventory$;
    select jsonb_object_agg(key, jsonb_array_length(value))
      from inventory_fixture, jsonb_each(owned);
    commit;`;
}
