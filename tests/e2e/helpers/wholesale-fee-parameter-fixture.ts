import assert from "node:assert/strict";
import {
  runWholesaleFeeSql,
  feeSqlValue as quote,
} from "./wholesale-fee-database";

const code = "wholesale_salesman_customer_commission";
const config = {
  existing_customer_rate: 0.12,
  new_customer_service_fee_rate: 0.1,
};
const publisher = "11111111-1111-4111-8111-111111111111";
type Row = Record<string, unknown>;
export type FeeParameterRows = { definition: Row; versions: Row[] };
export type FeeParameterFixture = {
  reason: string;
  before: FeeParameterRows;
  requestId?: string;
  published?: FeeParameterRows;
};
const uuid = (value: unknown) =>
  assert(
    typeof value === "string" &&
      /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
        value,
      ),
    "fee_parameter_uuid_invalid",
  );

/** 包含xmin的完整两表快照；不能只保存修订号后猜测版本仍归本次运行。 */
export function readFeeParameterRows(): FeeParameterRows {
  return JSON.parse(
    runWholesaleFeeSql(`select jsonb_build_object(
    'definition',(select to_jsonb(d)||jsonb_build_object('_xmin',d.xmin::text) from public.business_parameter_definitions d where parameter_code='${code}'),
    'versions',(select coalesce(jsonb_agg(to_jsonb(v)||jsonb_build_object('_xmin',v.xmin::text)order by v.id),'[]'::jsonb)
      from public.business_parameter_versions v where parameter_code='${code}'));`),
  );
}
export function captureFeeParameterFixture(
  reason: string,
): FeeParameterFixture {
  const match = /^fees-e2e-([a-f0-9-]{36})-参数发布$/i.exec(reason);
  assert(match, "fee_parameter_reason_invalid");
  uuid(match[1]);
  const before = readFeeParameterRows();
  assert(
    before.definition &&
      before.definition.parameter_code === code &&
      before.versions.length > 0,
    "fee_parameter_baseline_missing",
  );
  assert(
    Number.isSafeInteger(before.definition.current_revision) &&
      Number(before.definition.current_revision) > 0,
    "fee_parameter_revision_missing",
  );
  return { reason, before };
}

/** 必须在route.fetch之前登记页面原请求，不改写其编号或参数来替代真实前端行为。 */
export function registerFeeParameterRequest(
  state: FeeParameterFixture,
  value: unknown,
) {
  const input = value as Record<string, unknown>;
  assert(
    input &&
      input.p_parameter_code === code &&
      input.p_change_reason === state.reason,
    "fee_parameter_request_scope_changed",
  );
  assert.deepEqual(input.p_config, config);
  assert.equal(
    input.p_expected_revision,
    state.before.definition.current_revision,
  );
  assert.equal(input.p_effective_from, null);
  uuid(input.p_request_id);
  if (state.requestId)
    assert.equal(
      input.p_request_id,
      state.requestId,
      "fee_parameter_request_id_changed",
    );
  state.requestId = input.p_request_id as string;
}

const definitionCore = (row: Row) =>
  Object.fromEntries(
    Object.entries(row).filter(
      ([key]) => !["current_revision", "updated_at", "_xmin"].includes(key),
    ),
  );
/** 首次提交回执丢失后，独立核对自己的请求、配置、发布人、旧版本及完整定义，再绑定可恢复快照。 */
export function bindFeeParameterPublication(state: FeeParameterFixture) {
  uuid(state.requestId);
  const current = readFeeParameterRows();
  assert.deepEqual(
    definitionCore(current.definition),
    definitionCore(state.before.definition),
  );
  assert.equal(
    current.definition.current_revision,
    Number(state.before.definition.current_revision) + 1,
  );
  const owned = current.versions.filter(
    (row) => row.request_id === state.requestId,
  );
  assert.equal(owned.length, 1, "fee_parameter_publication_missing");
  const version = owned[0];
  uuid(version.id);
  assert.equal(version.change_reason, state.reason);
  assert.equal(version.parameter_code, code);
  assert.equal(version.published_by, publisher);
  assert.deepEqual(version.config, config);
  assert.equal(version.version_number, current.definition.current_revision);
  assert.equal(version.is_migration_baseline, false);
  assert.equal(version.requested_effective_from, null);
  assert.equal(version.cancelled_at, null);
  assert.equal(version.cancelled_by, null);
  assert(
    Number.isFinite(Date.parse(String(version.published_at))) &&
      Number.isFinite(Date.parse(String(version.effective_from))),
    "fee_parameter_time_missing",
  );
  assert.deepEqual(
    current.versions.filter((row) => row.id !== version.id),
    state.before.versions,
  );
  if (state.published)
    assert.deepEqual(
      current,
      state.published,
      "fee_parameter_confirmed_state_changed",
    );
  state.published = current;
  return version;
}

/** JSON在DO之外作为数据写入；理由中的引号/美元标签不能改变SQL结构。 */
export function buildFeeParameterRestoreSql(state: FeeParameterFixture) {
  assert(
    state.published && state.requestId,
    "fee_parameter_publication_unconfirmed",
  );
  const version = state.published.versions.find(
    (row) => row.request_id === state.requestId,
  );
  assert(
    version &&
      version.change_reason === state.reason &&
      version.parameter_code === code,
    "fee_parameter_restore_manifest_invalid",
  );
  uuid(version.id);
  const payload = quote(JSON.stringify({ ...state, versionId: version.id }));
  return `begin;
set local statement_timeout='12s';set local lock_timeout='10s';set local standard_conforming_strings=on;
create temp table fee_restore_input(data jsonb);insert into fee_restore_input values(${payload}::jsonb);
create temp table fee_restore_receipt(data jsonb);
do $fee_restore$ declare m jsonb;d jsonb;vs jsonb;affected integer;begin
 select data into m from fee_restore_input;
 perform 1 from public.business_parameter_definitions where parameter_code='${code}' for update;
 perform 1 from public.business_parameter_versions where parameter_code='${code}' order by id for update;
 select to_jsonb(t)||jsonb_build_object('_xmin',t.xmin::text) into d from public.business_parameter_definitions t where parameter_code='${code}';
 select coalesce(jsonb_agg(to_jsonb(v)||jsonb_build_object('_xmin',v.xmin::text)order by v.id),'[]'::jsonb) into vs
   from public.business_parameter_versions v where parameter_code='${code}';
 -- 重复收尾只读确认，不为相同目标再次改写定义时间或行版本。
 if d->'current_revision'=m->'before'->'definition'->'current_revision'
   and (d-array['current_revision','updated_at','_xmin'])=((m->'before'->'definition')-array['current_revision','updated_at','_xmin'])
   and vs=m->'before'->'versions' then
   insert into fee_restore_receipt values(jsonb_build_object('restored',0,'removed',0));return;
 end if;
 if d is distinct from m->'published'->'definition' or vs is distinct from m->'published'->'versions'
   then raise exception 'fee_parameter_restore_scope_changed';end if;
 update public.business_parameter_definitions set current_revision=(m->'before'->'definition'->>'current_revision')::integer,
   updated_at=clock_timestamp() where parameter_code='${code}' and current_revision=(m->'published'->'definition'->>'current_revision')::integer
   and xmin::text=m->'published'->'definition'->>'_xmin';
 get diagnostics affected=row_count;if affected<>1 then raise exception 'fee_parameter_restore_definition_zero';end if;
 delete from public.business_parameter_versions where id=(m->>'versionId')::uuid and request_id=(m->>'requestId')::uuid;
 get diagnostics affected=row_count;if affected<>1 then raise exception 'fee_parameter_restore_version_zero';end if;
 insert into fee_restore_receipt values(jsonb_build_object('restored',1,'removed',1));
end $fee_restore$;
commit;select data from fee_restore_receipt;`;
}

/** 恢复/删除必须同事务；提交后另连接确认旧版本完整保留，定义的新时间/xmin属于本次恢复写入。 */
export function restoreFeeParameterFixture(state: FeeParameterFixture) {
  if (!state.published) {
    assert.deepEqual(
      readFeeParameterRows(),
      state.before,
      "fee_parameter_publication_unconfirmed",
    );
    return { restored: 0, removed: 0 };
  }
  const receipt = JSON.parse(
    runWholesaleFeeSql(buildFeeParameterRestoreSql(state)),
  );
  assert(
    [0, 1].includes(receipt?.restored) && receipt.removed === receipt.restored,
    "fee_parameter_restore_receipt_invalid",
  );
  const after = readFeeParameterRows();
  assert.equal(
    after.definition.current_revision,
    state.before.definition.current_revision,
  );
  assert.deepEqual(
    definitionCore(after.definition),
    definitionCore(state.before.definition),
  );
  assert.deepEqual(after.versions, state.before.versions);
  assert(
    Number.isFinite(Date.parse(String(after.definition.updated_at))) &&
      typeof after.definition._xmin === "string",
    "fee_parameter_restore_final_version_missing",
  );
  return receipt as { restored: number; removed: number };
}
