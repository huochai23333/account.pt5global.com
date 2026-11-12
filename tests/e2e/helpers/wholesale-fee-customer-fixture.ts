import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  runWholesaleFeeSql,
  feeSqlValue as quote,
  readFeeCustomer,
  readFeeCustomerArchive,
  buildFeeCustomerCleanupSql,
  type FeeArchiveProof,
  type FeeRow,
} from "./wholesale-fee-database";

export type FeeCustomerFixture = {
  id: string;
  name: string;
  attempted: boolean;
  cohort: "new" | "existing";
  proof?: FeeRow;
  archiveProof?: FeeArchiveProof;
  cleaned?: boolean;
};

/** 编号与名称在任何写入前登记；准备中断时也能找回这一份清单，不依赖成功回执设置开关。 */
export function createFeeCustomerFixture(prefix: string): FeeCustomerFixture {
  assert(
    /^fees-e2e-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      prefix,
    ),
    "fee_customer_prefix_invalid",
  );
  return {
    id: randomUUID(),
    name: prefix + "-新客户",
    attempted: false,
    cohort: "new",
  };
}

/** 历史客户只属于本次隔离夹具；使用独立编号，绝不改共享Alpha或既有客户的创建日期。 */
export function createFeeHistoricalCustomerFixture(
  prefix: string,
): FeeCustomerFixture {
  const state = createFeeCustomerFixture(prefix);
  return { ...state, name: prefix + "-老客户", cohort: "existing" };
}

/** 未收到INSERT回执时只接受完整初始形状；改名、注册关联、备注、修订变化都不能重新绑定。 */
function bindInitialCustomer(state: FeeCustomerFixture, row: FeeRow) {
  const expected = {
    id: state.id,
    unique_name: state.name,
    registered_user_id: null,
    assigned_sales_user_id: "55555555-5555-4555-8555-555555555555",
    created_by_user_id: "11111111-1111-4111-8111-111111111111",
    customer_kind: "sales_created",
    other_names: [],
    contact_details: null,
    source: null,
    notes: null,
    salesman_commission_cohort: state.cohort,
    edit_revision: 1,
  };
  const stable = Object.fromEntries(
    Object.entries(row).filter(
      ([key]) => !["created_at", "updated_at", "_xmin"].includes(key),
    ),
  );
  assert.deepEqual(stable, expected, "fee_customer_initial_scope_changed");
  assert(
    typeof row._xmin === "string" && /^\d+$/.test(row._xmin),
    "fee_customer_version_missing",
  );
  // 分类触发器将created_at设为clock_timestamp，updated_at默认取事务now，首次插入二者可略有差异。
  const created = Date.parse(String(row.created_at));
  const updated = Date.parse(String(row.updated_at));
  assert(
    Number.isFinite(created) &&
      Number.isFinite(updated) &&
      (state.cohort === "existing"
        ? created === Date.parse("2026-10-07T00:00:00+08:00")
        : created >= updated && created - updated <= 12000),
    "fee_customer_initial_time_changed",
  );
  state.proof = row;
  const archive = readFeeCustomerArchive(state.id);
  assert(
    archive.archives.length === 1 &&
      archive.folders.length === 1 &&
      archive.files.length === 0 &&
      archive.templates.length === 0,
    "fee_customer_archive_not_initial",
  );
  const root = archive.archives[0],
    folder = archive.folders[0];
  assert.deepEqual(
    root,
    {
      id: root.id,
      customer_id: state.id,
      user_id: null,
      kind: "customer",
      created_at: row.updated_at,
      _xmin: row._xmin,
    },
    "fee_customer_archive_scope_changed",
  );
  assert.deepEqual(
    folder,
    {
      id: folder.id,
      archive_id: root.id,
      parent_id: null,
      zone: "personal",
      name: "资料文件夹",
      system_key: "personal",
      version: 1,
      created_at: row.updated_at,
      delete_batch_id: null,
      _xmin: row._xmin,
    },
    "fee_customer_folder_scope_changed",
  );
  for (const id of [root.id, folder.id])
    assert(
      typeof id === "string" && /^[a-f0-9-]{36}$/i.test(id),
      "fee_customer_archive_id_missing",
    );
  state.archiveProof = archive;
}

export function prepareFeeCustomer(state: FeeCustomerFixture) {
  assert(!state.attempted, "fee_customer_prepare_already_attempted");
  assert.equal(readFeeCustomer(state.id), null, "fee_customer_preexisting_id");
  state.attempted = true;
  const history = state.cohort === "existing";
  // ALTER TABLE持有事务级独占锁；仅本次历史INSERT暂时停用指定触发器，提交前恢复，异常整体回滚。
  const begin = history
    ? `begin;do $history$begin
    if (select tgenabled from pg_trigger where tgrelid='public.wholesale_customers'::regclass
      and tgname='wholesale_customers_10_commission_cohort') is distinct from 'O' then raise exception 'fee_history_trigger_not_ready';end if;
    end $history$;alter table public.wholesale_customers disable trigger wholesale_customers_10_commission_cohort;`
    : "";
  const returned = JSON.parse(
    runWholesaleFeeSql(`${begin}insert into public.wholesale_customers(id,unique_name,customer_kind,assigned_sales_user_id,created_by_user_id${history ? ",created_at,salesman_commission_cohort" : ""})
    values(${quote(state.id)}::uuid,${quote(state.name)},'sales_created','55555555-5555-4555-8555-555555555555','11111111-1111-4111-8111-111111111111'${history ? ",'2026-10-07 00:00:00+08','existing'" : ""})
    returning to_jsonb(wholesale_customers)||jsonb_build_object('_xmin',xmin::text);
    ${history ? "alter table public.wholesale_customers enable trigger wholesale_customers_10_commission_cohort;commit;" : ""}`),
  );
  bindInitialCustomer(state, returned);
  assert.deepEqual(
    readFeeCustomer(state.id),
    state.proof,
    "fee_customer_prepare_readback_changed",
  );
  return state.proof!;
}

/** 锁内保护全部字段及外键；只有已独立确认成功的清理才能在重试时返回0。 */
export function cleanupFeeCustomer(state: FeeCustomerFixture) {
  if (!state.attempted) return { deleted: 0 };
  const current = readFeeCustomer(state.id);
  if (state.cleaned) {
    assert.equal(current, null, "fee_customer_reappeared");
    assert.deepEqual(
      readFeeCustomerArchive(state.id, state.archiveProof),
      { archives: [], folders: [], files: [], templates: [] },
      "fee_customer_archive_reappeared",
    );
    return { deleted: 0 };
  }
  if (!current) {
    assert(!state.proof, "fee_customer_missing_since_confirm");
    return { deleted: 0 };
  }
  if (!state.proof) bindInitialCustomer(state, current);
  assert.deepEqual(current, state.proof, "fee_customer_cleanup_scope_changed");
  assert(state.archiveProof, "fee_customer_archive_unconfirmed");
  assert.deepEqual(
    readFeeCustomerArchive(state.id, state.archiveProof),
    state.archiveProof,
    "fee_customer_archive_changed",
  );
  const receipt = JSON.parse(
    runWholesaleFeeSql(
      buildFeeCustomerCleanupSql(state.proof!, state.archiveProof),
    ),
  );
  assert(
    receipt?.deleted === 1 && receipt.customerId === state.id,
    "fee_customer_cleanup_receipt_invalid",
  );
  assert.equal(
    readFeeCustomer(state.id),
    null,
    "fee_customer_cleanup_readback_failed",
  );
  assert.deepEqual(
    readFeeCustomerArchive(state.id, state.archiveProof),
    { archives: [], folders: [], files: [], templates: [] },
    "fee_customer_archive_cleanup_readback_failed",
  );
  state.cleaned = true;
  return { deleted: 1 };
}
