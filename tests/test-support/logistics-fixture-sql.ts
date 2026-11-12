const backup="private.pt5_e2e_logistics_backup";
export const logisticsFixturePackages=Array.from({length:50},(_,i)=>`LOCAL-RETRY-${i+1}`);
export const fixtureSqlValue=(value: string)=>"'"+value.replaceAll("'","''")+"'";
const packages=logisticsFixturePackages.map(fixtureSqlValue).join(",");
const control=`(select jsonb_build_object('state',(select to_jsonb(s) from public.wholesale_logistics_sync_state s where sync_key='dianxiaomi-archive'),
  'checkpoints',(select coalesce(jsonb_agg(c order by mode),'[]') from public.wholesale_logistics_checkpoints c),
  'secret',(select to_jsonb(j) from public.internal_job_request_secrets j where name='wholesale-logistics-sync')))`;
const oldRuns=`coalesce((select jsonb_agg(id order by id) from private.operation_runs where operation_key='wholesale-logistics-sync'),'[]'::jsonb)`;
const oldRunFingerprint=`(select md5(coalesce(string_agg(to_jsonb(r)::text||r.xmin::text,'|' order by id),'')) from private.operation_runs r where operation_key='wholesale-logistics-sync')`;
function tokenValue(token: string){
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(token))throw new Error("logistics_fixture_token_invalid");
  return fixtureSqlValue(token)+"::uuid";
}
function operationValues(ids: string[]){
  if(ids.length>32||new Set(ids).size!==ids.length)throw new Error("logistics_fixture_operations_invalid");
  return ids.map(id=>tokenValue(id)).join(",")||"null::uuid";
}
const begin="begin;set local statement_timeout='12s';set local lock_timeout='10s';";

/** 原始密钥只在专属DB私有备份内保存；宿主机只接收指纹和影响数，SQL错误也不包含密钥字面量。 */
export function buildLogisticsFixturePrepareSql(token: string){
  const owner=tokenValue(token);
  return `${begin}
create table ${backup}(owner uuid primary key,payload jsonb not null);
alter table ${backup} enable row level security;
revoke all on ${backup} from public,anon,authenticated,service_role;
do $logistics_fixture$ declare snapshot jsonb;affected integer;begin
  perform 1 from public.wholesale_logistics_sync_state where sync_key='dianxiaomi-archive' for update;
  if not found or exists(select 1 from public.wholesale_logistics_sync_state where sync_key='dianxiaomi-archive' and is_running)
    or exists(select 1 from private.operation_runs where operation_key='wholesale-logistics-sync' and status in ('queued','running'))
    or exists(select 1 from private.system_health_alerts where operation_key='wholesale-logistics-sync')
    then raise exception 'logistics_fixture_busy_or_missing';end if;
  perform 1 from public.wholesale_logistics_checkpoints for update;
  perform 1 from public.internal_job_request_secrets where name='wholesale-logistics-sync' for update;
  if exists(select 1 from public.wholesale_logistics_records where package_number like 'LOCAL-RETRY-%')
    or exists(select 1 from public.wholesale_logistics_observations where source_system='dianxiaomi' and observation_bucket=18000)
    then raise exception 'logistics_fixture_collision';end if;
  snapshot:=${control};
  insert into ${backup} values(${owner},jsonb_build_object('control',snapshot,'runIds',${oldRuns},'runsFingerprint',${oldRunFingerprint}));
  delete from public.wholesale_logistics_checkpoints;get diagnostics affected=row_count;
  if affected<>jsonb_array_length(snapshot->'checkpoints') then raise exception 'logistics_fixture_checkpoint_reset_unconfirmed';end if;
  update public.wholesale_logistics_sync_state set is_running=false,locked_until=null,lock_token=null,retry_not_before=null,last_successful_at=null,
    last_order_id=0,last_tracking_id=0,last_shipping_id=0,last_tracking_updated_at='1970-01-01Z',last_shipping_updated_at='1970-01-01Z'
    where sync_key='dianxiaomi-archive';get diagnostics affected=row_count;
  if affected<>1 then raise exception 'logistics_fixture_state_reset_unconfirmed';end if;
  insert into public.internal_job_request_secrets(name,endpoint,shared_secret)
    values('wholesale-logistics-sync','http://kong:8000/functions/v1/wholesale-logistics-sync','local-job-fixture')
    on conflict(name)do update set endpoint=excluded.endpoint,shared_secret=excluded.shared_secret;
  get diagnostics affected=row_count;if affected<>1 then raise exception 'logistics_fixture_secret_reset_unconfirmed';end if;
end $logistics_fixture$;
select jsonb_build_object('prepared',true,'fingerprint',md5((payload->'control')::text)) from ${backup} where owner=${owner};
commit;`;
}

export function buildLogisticsFixturePreparedReadSql(){
  return `select jsonb_build_object('state',(select count(*) from public.wholesale_logistics_sync_state where sync_key='dianxiaomi-archive'
    and not is_running and locked_until is null and lock_token is null and retry_not_before is null and last_successful_at is null
    and last_order_id=0 and last_tracking_id=0 and last_shipping_id=0 and last_tracking_updated_at='1970-01-01Z' and last_shipping_updated_at='1970-01-01Z'),
    'checkpoints',(select count(*) from public.wholesale_logistics_checkpoints),
    'secret',(select count(*) from public.internal_job_request_secrets where name='wholesale-logistics-sync'
      and endpoint='http://kong:8000/functions/v1/wholesale-logistics-sync' and shared_secret='local-job-fixture'));`;
}

/** 先锁备份和业务行并查明所有新增运行；拒绝陌生前缀/观测/任务，精确回收后原子恢复控制配置。 */
export function buildLogisticsFixtureRestoreSql(token: string,ids: string[]){
  const owner=tokenValue(token),operations=operationValues(ids);
  // 空集合的NOT IN(NULL)结果是未知，不能发现陌生运行；没有登记编号时，所有新增运行都属未登记。
  const unregistered=ids.length?`id not in (${operations})`:"true";
  return `${begin}
do $logistics_fixture$ declare saved jsonb;snapshot jsonb;expected integer;affected integer;records integer:=0;observations integer:=0;runs integer:=0;receipt jsonb;begin
 if to_regclass('${backup}') is null then
   receipt:=jsonb_build_object('restored',false,'notPrepared',true);
 else
  select payload into saved from ${backup} where owner=${owner} for update;
  if not found or (select count(*) from ${backup})<>1 then raise exception 'logistics_fixture_backup_owner_mismatch';end if;
  snapshot:=saved->'control';
  perform 1 from public.wholesale_logistics_sync_state where sync_key='dianxiaomi-archive' for update;
  if not found or exists(select 1 from public.wholesale_logistics_sync_state where sync_key='dianxiaomi-archive' and is_running)
    then raise exception 'logistics_fixture_worker_still_running';end if;
  perform 1 from public.wholesale_logistics_records where package_number like 'LOCAL-RETRY-%' for update;
  if exists(select 1 from public.wholesale_logistics_records where package_number like 'LOCAL-RETRY-%' and
    (source_system is distinct from 'dianxiaomi' or package_number not in (${packages}) or store_name is distinct from 'Local Retry Shop'
      or source_order_id is distinct from 9000000+case when package_number in (${packages}) then substring(package_number from 13)::bigint end))
    then raise exception 'logistics_fixture_record_ownership_changed';end if;
  perform 1 from public.wholesale_logistics_observations where source_system='dianxiaomi' and observation_bucket=18000 for update;
  if exists(select 1 from public.wholesale_logistics_observations b cross join lateral jsonb_object_keys(b.seen)k
    where source_system='dianxiaomi' and observation_bucket=18000 and k not in (${packages}))
    then raise exception 'logistics_fixture_observation_ownership_changed';end if;
  perform 1 from private.operation_runs where operation_key='wholesale-logistics-sync' for update;
  if exists(select 1 from private.operation_runs where operation_key='wholesale-logistics-sync' and not ((saved->'runIds') ? id::text) and ${unregistered})
    or exists(select 1 from private.operation_runs where id in (${operations}) and (operation_key<>'wholesale-logistics-sync' or (saved->'runIds') ? id::text or status='running'))
    or (select count(*) from private.operation_runs where id in (${operations}))<>${ids.length}
    or exists(select 1 from private.system_health_alerts where operation_run_id in (${operations}))
    then raise exception 'logistics_fixture_operation_manifest_mismatch';end if;
  select count(*) into expected from public.wholesale_logistics_records where source_system='dianxiaomi' and package_number in (${packages});
  delete from public.wholesale_logistics_records where source_system='dianxiaomi' and package_number in (${packages});get diagnostics affected=row_count;
  if affected<>expected then raise exception 'logistics_fixture_record_delete_unconfirmed';end if;records:=affected;
  select count(*) into expected from public.wholesale_logistics_observations where source_system='dianxiaomi' and observation_bucket=18000;
  delete from public.wholesale_logistics_observations where source_system='dianxiaomi' and observation_bucket=18000;get diagnostics affected=row_count;
  if affected<>expected then raise exception 'logistics_fixture_observation_delete_unconfirmed';end if;observations:=affected;
  delete from private.operation_runs where id in (${operations}) and operation_key='wholesale-logistics-sync';get diagnostics affected=row_count;
  if affected<>${ids.length} then raise exception 'logistics_fixture_operation_delete_unconfirmed';end if;runs:=affected;
  delete from public.wholesale_logistics_checkpoints;
  insert into public.wholesale_logistics_checkpoints select * from jsonb_populate_recordset(null::public.wholesale_logistics_checkpoints,snapshot->'checkpoints');
  get diagnostics affected=row_count;if affected<>jsonb_array_length(snapshot->'checkpoints') then raise exception 'logistics_fixture_checkpoint_restore_unconfirmed';end if;
  delete from public.wholesale_logistics_sync_state where sync_key='dianxiaomi-archive';
  insert into public.wholesale_logistics_sync_state select * from jsonb_populate_record(null::public.wholesale_logistics_sync_state,snapshot->'state');
  get diagnostics affected=row_count;if affected<>1 then raise exception 'logistics_fixture_state_restore_unconfirmed';end if;
  delete from public.internal_job_request_secrets where name='wholesale-logistics-sync';
  if snapshot->'secret'<>'null'::jsonb then
    insert into public.internal_job_request_secrets select * from jsonb_populate_record(null::public.internal_job_request_secrets,snapshot->'secret');
    get diagnostics affected=row_count;if affected<>1 then raise exception 'logistics_fixture_secret_restore_unconfirmed';end if;
  end if;
  if ${control} is distinct from snapshot or ${oldRunFingerprint} is distinct from saved->>'runsFingerprint'
    or exists(select 1 from public.wholesale_logistics_records where package_number like 'LOCAL-RETRY-%')
    or exists(select 1 from public.wholesale_logistics_observations where source_system='dianxiaomi' and observation_bucket=18000)
    then raise exception 'logistics_fixture_restore_unconfirmed';end if;
  receipt:=jsonb_build_object('restored',true,'records',records,'observations',observations,'operations',runs,'fingerprint',md5(snapshot::text));
  drop table ${backup};
 end if;
 perform set_config('pt5.fixture.logistics_receipt',receipt::text,true);
end $logistics_fixture$;
select current_setting('pt5.fixture.logistics_receipt');
commit;`;
}

export function buildLogisticsFixtureRestoredReadSql(ids: string[]){
  const operations=operationValues(ids);
  return `select jsonb_build_object('fingerprint',md5(${control}::text),'backup',to_regclass('${backup}') is not null,
    'records',(select count(*) from public.wholesale_logistics_records where package_number like 'LOCAL-RETRY-%'),
    'observations',(select count(*) from public.wholesale_logistics_observations where source_system='dianxiaomi' and observation_bucket=18000),
    'operations',(select count(*) from private.operation_runs where id in (${operations})));`;
}
