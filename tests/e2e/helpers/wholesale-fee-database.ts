import { runLocalSupabaseSql } from "./local-supabase";
import assert from "node:assert/strict";

/** 费用领域共用同一个专属执行器；全局规则夹具必须准备在可重建隔离实例。 */
export const runWholesaleFeeSql = runLocalSupabaseSql;

/** 引号仅用于本文件生成的夹具编号和备注，绝不把页面输入拼成未经转义的SQL。 */
export function feeSqlValue(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

export function readWholesaleFeeOrder(id: string) {
  return JSON.parse(
    runWholesaleFeeSql(
      `select to_jsonb(o) from public.wholesale_orders o where id=${feeSqlValue(id)};`,
    ),
  );
}
export function readWholesaleFeeCommission(id: string) {
  return JSON.parse(
    runWholesaleFeeSql(
      `select to_jsonb(c) from public.wholesale_commissions c where order_id=${feeSqlValue(id)};`,
    ),
  );
}

export type FeeRow = Record<string, unknown>;
export type FeeArchiveProof = Record<
  "archives" | "folders" | "files" | "templates",
  FeeRow[]
>;
export type FeeOrderProof = { order: FeeRow | null } & Record<
  "commissions" | "settlements" | "logs" | "attachments" | "allocations",
  FeeRow[]
>;
const children = {
  commissions: "wholesale_commissions",
  settlements: "wholesale_order_settlements",
  logs: "wholesale_order_change_logs",
  attachments: "wholesale_order_list_attachments",
  allocations: "wholesale_settlement_release_allocations",
} as const;

/** 所有级联子行都带完整内容与xmin；附件/外部分配属于另一业务，不能随费用夹具回收。 */
function orderProofExpression(id: string) {
  return `jsonb_build_object('order',(select to_jsonb(o)||jsonb_build_object('_xmin',o.xmin::text)
    from public.wholesale_orders o where id=(${id})::uuid),${Object.entries(
      children,
    )
      .map(
        ([key, table]) =>
          `'${key}',(select coalesce(jsonb_agg(to_jsonb(t)||jsonb_build_object('_xmin',t.xmin::text)order by id),'[]'::jsonb)
      from public.${table} t where order_id=(${id})::uuid)`,
      )
      .join(",")})`;
}
export function readFeeOrderProof(id: string): FeeOrderProof {
  return JSON.parse(
    runWholesaleFeeSql(`select ${orderProofExpression(feeSqlValue(id))};`),
  );
}

/** Storage目录只读；包含孤立对象，用对象version保护内容，不把访问记账时间当作内容版本。 */
export function readWholesaleOrderAttachmentObjects(orderId: string): FeeRow[] {
  assert(
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      orderId,
    ),
    "attachment_fixture_order_id_invalid",
  );
  const prefix = orderId + "/";
  return JSON.parse(
    runWholesaleFeeSql(`select coalesce(jsonb_agg(to_jsonb(o)-'last_accessed_at'-'updated_at'order by name),'[]'::jsonb)
    from storage.objects o where bucket_id='wholesale-order-lists'and left(name,${prefix.length})=${feeSqlValue(prefix)};`),
  );
}
export function findFeeOrders(actor: string, request: string): FeeRow[] {
  return JSON.parse(
    runWholesaleFeeSql(`select coalesce(jsonb_agg(to_jsonb(o)||jsonb_build_object('_xmin',xmin::text)order by id),'[]'::jsonb)
    from public.wholesale_orders o where created_by_user_id=${feeSqlValue(actor)}::uuid and creation_request_id=${feeSqlValue(request)}::uuid;`),
  );
}
/** 只读订单已锁定的两个参数版本；不能把另一个参数的UUID当成有效费用来源。 */
export function readFeeOrderVersions(order: FeeRow): FeeRow[] {
  return JSON.parse(
    runWholesaleFeeSql(`select coalesce(jsonb_agg(to_jsonb(v)||jsonb_build_object('_xmin',xmin::text)order by parameter_code),'[]'::jsonb)
    from public.business_parameter_versions v where id in(${feeSqlValue(String(order.salesman_commission_parameter_version_id))}::uuid,${feeSqlValue(String(order.referral_amount_parameter_version_id))}::uuid);`),
  );
}
export function readFeeCustomer(id: string): FeeRow | null {
  return JSON.parse(
    runWholesaleFeeSql(`select coalesce((select to_jsonb(c)||jsonb_build_object('_xmin',xmin::text)
    from public.wholesale_customers c where id=${feeSqlValue(id)}::uuid),'null'::jsonb);`),
  );
}

/** 原编号也参与查询；目录被移动或档案解除客户关联后仍会被找到，不能被空关联查询掩盖。 */
function archiveProofExpression(
  customer: string,
  archives: string,
  folders: string,
) {
  const archiveWhere = `customer_id=(${customer})::uuid or id=any(${archives})`;
  const folderWhere = `archive_id in(select id from public.document_archives where ${archiveWhere})or id=any(${folders})`;
  return `jsonb_build_object(
    'archives',(select coalesce(jsonb_agg(to_jsonb(a)||jsonb_build_object('_xmin',xmin::text)order by id),'[]'::jsonb)from public.document_archives a where ${archiveWhere}),
    'folders',(select coalesce(jsonb_agg(to_jsonb(f)||jsonb_build_object('_xmin',xmin::text)order by id),'[]'::jsonb)from public.document_folders f where ${folderWhere}),
    'files',(select coalesce(jsonb_agg(to_jsonb(t)||jsonb_build_object('_xmin',xmin::text)order by id),'[]'::jsonb)from public.document_files t where folder_id in(select id from public.document_folders where ${folderWhere})),
    'templates',(select coalesce(jsonb_agg(to_jsonb(t)||jsonb_build_object('_xmin',xmin::text)order by id),'[]'::jsonb)from public.company_template_documents t where folder_id in(select id from public.document_folders where ${folderWhere})))`;
}
export function readFeeCustomerArchive(
  customer: string,
  known?: FeeArchiveProof,
): FeeArchiveProof {
  const ids = (rows: FeeRow[]) =>
    `array[${rows.map((row) => feeSqlValue(String(row.id))).join(",")}]::uuid[]`;
  return JSON.parse(
    runWholesaleFeeSql(
      `select ${archiveProofExpression(feeSqlValue(customer), ids(known?.archives ?? []), ids(known?.folders ?? []))};`,
    ),
  );
}

/** 锁内再次比较完整图，再删除一行父记录；级联删除数量通过旧凭证和独立读回核对。 */
export function buildFeeOrderCleanupSql(proof: FeeOrderProof) {
  assert(
    proof.order && /^fees-e2e-[a-f0-9-]{36}-/.test(String(proof.order.notes)),
    "fee_order_cleanup_scope_invalid",
  );
  assert(
    proof.attachments.length === 0 && proof.allocations.length === 0,
    "fee_order_external_resource_present",
  );
  const id = "m->'order'->>'id'";
  return `begin;set local standard_conforming_strings=on;
create temp table fee_cleanup_input(data jsonb);insert into fee_cleanup_input values(${feeSqlValue(JSON.stringify(proof))}::jsonb);
create temp table fee_cleanup_receipt(data jsonb);
do $fee_cleanup$declare m jsonb;actual jsonb;affected integer;begin
 select data into m from fee_cleanup_input;
 perform 1 from public.wholesale_orders where id=(${id})::uuid for update;
 ${Object.values(children)
   .map(
     (table) =>
       `perform 1 from public.${table} where order_id=(${id})::uuid order by id for update;`,
   )
   .join("\n")}
 select ${orderProofExpression(id)} into actual;
 if actual is distinct from m then raise exception 'fee_order_cleanup_scope_changed';end if;
 delete from public.wholesale_orders where id=(${id})::uuid and xmin::text=m->'order'->>'_xmin';
 get diagnostics affected=row_count;if affected<>1 then raise exception 'fee_order_cleanup_zero';end if;
 insert into fee_cleanup_receipt values(jsonb_build_object('deleted',affected,'orderId',${id}));
end $fee_cleanup$;commit;select data from fee_cleanup_receipt;`;
}

/** 临时故障只允许50↔51；先按原锁顺序核对完整图，不能用订单号粗略UPDATE后再猜测归属。 */
export function buildFeeCommissionAmountSql(
  proof: FeeOrderProof,
  amount: 50 | 51,
) {
  assert(
    proof.order && /^fees-e2e-[a-f0-9-]{36}-/.test(String(proof.order.notes)),
    "fee_fault_scope_invalid",
  );
  assert(
    proof.commissions.length === 1 && [50, 51].includes(amount),
    "fee_fault_amount_invalid",
  );
  assert.equal(
    proof.commissions[0].commission_amount_rmb,
    amount === 51 ? 50 : 51,
  );
  const id = "m->'proof'->'order'->>'id'";
  return `begin;set local standard_conforming_strings=on;
create temp table fee_fault_input(data jsonb);insert into fee_fault_input values(${feeSqlValue(JSON.stringify({ proof, amount }))}::jsonb);
create temp table fee_fault_receipt(data jsonb);
do $fee_fault$declare m jsonb;actual jsonb;affected integer;begin
 select data into m from fee_fault_input;
 perform 1 from public.wholesale_orders where id=(${id})::uuid for update;
 ${Object.values(children)
   .map(
     (table) =>
       `perform 1 from public.${table} where order_id=(${id})::uuid order by id for update;`,
   )
   .join("\n")}
 select ${orderProofExpression(id)} into actual;
 if actual is distinct from m->'proof' then raise exception 'fee_fault_scope_changed';end if;
 update public.wholesale_commissions set commission_amount_rmb=(m->>'amount')::numeric
   where id=(m->'proof'->'commissions'->0->>'id')::uuid and order_id=(${id})::uuid
   and xmin::text=m->'proof'->'commissions'->0->>'_xmin';
 get diagnostics affected=row_count;if affected<>1 then raise exception 'fee_fault_write_zero';end if;
 insert into fee_fault_receipt values(jsonb_build_object('affected',affected,'proof',${orderProofExpression(id)}));
end $fee_fault$;commit;select data from fee_fault_receipt;`;
}

/** 客户所有外键都先检查，避免SET NULL或CASCADE悄悄改动其他模块；未来新外键也自动拒绝。 */
export function buildFeeCustomerCleanupSql(
  row: FeeRow,
  archive: FeeArchiveProof,
) {
  assert(
    /^fees-e2e-[a-f0-9-]{36}-(新客户|老客户)$/.test(String(row.unique_name)),
    "fee_customer_cleanup_scope_invalid",
  );
  assert(
    archive.archives.length === 1 &&
      archive.folders.length === 1 &&
      archive.files.length === 0 &&
      archive.templates.length === 0,
    "fee_customer_archive_not_initial",
  );
  const archiveIds =
    "array(select (x->>'id')::uuid from jsonb_array_elements(m->'archive'->'archives')x)";
  const folderIds =
    "array(select (x->>'id')::uuid from jsonb_array_elements(m->'archive'->'folders')x)";
  return `begin;set local standard_conforming_strings=on;
create temp table fee_customer_input(data jsonb);insert into fee_customer_input values(${feeSqlValue(JSON.stringify({ ...row, archive }))}::jsonb);
create temp table fee_customer_receipt(data jsonb);
do $fee_customer$declare m jsonb;actual jsonb;fk record;linked boolean;affected integer;begin
 select data into m from fee_customer_input;
 perform 1 from public.wholesale_customers where id=(m->>'id')::uuid for update;
 perform pg_advisory_xact_lock(hashtextextended('document-explorer-tree',0));
 perform 1 from public.document_archives where customer_id=(m->>'id')::uuid or id=any(${archiveIds})order by id for update;
 perform 1 from public.document_folders where archive_id=any(${archiveIds})or id=any(${folderIds})order by id for update;
 select to_jsonb(c)||jsonb_build_object('_xmin',c.xmin::text) into actual from public.wholesale_customers c where id=(m->>'id')::uuid;
 if actual is distinct from m-'archive' then raise exception 'fee_customer_cleanup_scope_changed';end if;
 select ${archiveProofExpression("m->>'id'", archiveIds, folderIds)} into actual;
 if actual is distinct from m->'archive' then raise exception 'fee_customer_archive_changed';end if;
 for fk in select k.conrelid::regclass as child,a.attname as column_name,k.conkey,k.confkey
   from pg_constraint k join pg_attribute a on a.attrelid=k.conrelid and a.attnum=k.conkey[1]
   where k.contype='f' and k.confrelid='public.wholesale_customers'::regclass loop
   if cardinality(fk.conkey)<>1 or cardinality(fk.confkey)<>1 then raise exception 'fee_customer_foreign_key_review_required';end if;
   -- 仅完整核对过的自动空档案由既有guard_customer_delete触发器清理，不删除其他业务引用。
   if fk.child='public.document_archives'::regclass and fk.column_name='customer_id' then continue;end if;
   execute format('select exists(select 1 from %s where %I=$1)',fk.child,fk.column_name)into linked using (m->>'id')::uuid;
   if linked then raise exception 'fee_customer_external_reference';end if;
 end loop;
 delete from public.wholesale_customers where id=(m->>'id')::uuid and xmin::text=m->>'_xmin';
 get diagnostics affected=row_count;if affected<>1 then raise exception 'fee_customer_cleanup_zero';end if;
 insert into fee_customer_receipt values(jsonb_build_object('deleted',affected,'customerId',m->>'id'));
end $fee_customer$;commit;select data from fee_customer_receipt;`;
}
