export type SettlementCleanupReceipt = {
  releaseIds: string[];
  allocationIds: string[];
  settlementIds: string[];
  deleted: { releases: number; allocations: number; settlements: number };
};

/** 精确备注仅由测试生成；拒绝空/控制字符，不能退化成全表或LIKE前缀清理。 */
export function settlementFixtureNotes(values: string[]) {
  if (!Array.isArray(values) || values.length > 100 || values.some(value =>
    typeof value !== "string" || !value.trim() || value.length > 256 || /[\0\r\n]/.test(value))) {
    throw new Error("settlement_fixture_notes_invalid");
  }
  return [...new Set(values)];
}
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;
const textArray = (values: string[]) => `array[${values.map(literal).join(",")}]::text[]`;
const uuidArray = (values: string[]) => `array[${values.map(literal).join(",")}]::uuid[]`;

/** 先锁定本次收款，再同事务删除分配、结汇、收款；中途失败全部回滚，重试仍能找到来源。 */
export function buildSettlementFixtureCleanupSql(values: string[]) {
  const notes = settlementFixtureNotes(values);
  if (!notes.length) throw new Error("settlement_fixture_cleanup_empty");
  // 输入放在DO之外，备注中的引号或美元分隔符只是数据，不能终止匿名函数正文。
  return `\\set ON_ERROR_STOP on
begin;
set local standard_conforming_strings=on;
set local statement_timeout='12s';
set local lock_timeout='10s';
create temp table cleanup_notes(note text primary key);
insert into cleanup_notes select unnest(${textArray(notes)});
create temp table cleanup_receipt(receipt jsonb not null);
do $cleanup$ declare releases uuid[];allocations uuid[];settlements uuid[];removed integer;begin
 select coalesce(array_agg(id order by id),array[]::uuid[]) into releases from (
  select r.id from public.wholesale_settlement_releases r join cleanup_notes n on n.note=r.note
  order by r.id for update of r
 ) locked;
 if exists(select 1 from public.wholesale_settlement_releases r join cleanup_notes n on n.note=r.note
   group by r.note having count(*)>1) then raise exception 'settlement_fixture_note_ambiguous';end if;
 select coalesce(array_agg(id order by id),array[]::uuid[]) into allocations
 from public.wholesale_settlement_release_allocations where release_id=any(releases);
 select coalesce(array_agg(id order by id),array[]::uuid[]) into settlements from (
  select id from public.wholesale_order_settlements where source_settlement_release_id=any(releases)
  union select settlement_id from public.wholesale_settlement_release_allocations where release_id=any(releases) and settlement_id is not null
 ) linked;
 if exists(select 1 from public.wholesale_order_settlements where id=any(settlements)
  and source_settlement_release_id is not null and not(source_settlement_release_id=any(releases)))
  then raise exception 'settlement_fixture_ownership_conflict';end if;
 -- 分配先删，避免其“有效分配必须有结汇记录”约束；收款最后删，来源外键不会提前变空。
 delete from public.wholesale_settlement_release_allocations where id=any(allocations);
 get diagnostics removed=row_count;
 if removed<>cardinality(allocations) then raise exception 'settlement_fixture_allocation_count_mismatch';end if;
 delete from public.wholesale_order_settlements where id=any(settlements);
 get diagnostics removed=row_count;
 if removed<>cardinality(settlements) then raise exception 'settlement_fixture_settlement_count_mismatch';end if;
 delete from public.wholesale_settlement_releases where id=any(releases);
 get diagnostics removed=row_count;
 if removed<>cardinality(releases) then raise exception 'settlement_fixture_release_count_mismatch';end if;
 if exists(select 1 from public.wholesale_settlement_releases where id=any(releases))
  or exists(select 1 from public.wholesale_order_settlements where id=any(settlements))
  or exists(select 1 from public.wholesale_settlement_release_allocations where id=any(allocations))
  then raise exception 'settlement_fixture_remaining';end if;
 insert into cleanup_receipt values(jsonb_build_object('releaseIds',releases,'allocationIds',allocations,'settlementIds',settlements,
  'deleted',jsonb_build_object('releases',cardinality(releases),'allocations',cardinality(allocations),'settlements',cardinality(settlements))));
end $cleanup$;
commit;
select receipt from cleanup_receipt;
`;
}

/** 返回编号和实际影响数必须一一对应；不接受缺字段、重复编号或伪造的零影响回执。 */
export function validateSettlementCleanupReceipt(value: unknown): SettlementCleanupReceipt {
  const receipt = value as SettlementCleanupReceipt | null;
  if (!receipt || typeof receipt !== "object" || !receipt.deleted) throw new Error("settlement_fixture_receipt_missing");
  for (const [idsKey, countKey] of [["releaseIds", "releases"], ["allocationIds", "allocations"], ["settlementIds", "settlements"]] as const) {
    const ids = receipt[idsKey];
    if (!Array.isArray(ids) || ids.some(id => typeof id !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))
      || new Set(ids.map(id => id.toLowerCase())).size !== ids.length || receipt.deleted[countKey] !== ids.length) {
      throw new Error("settlement_fixture_receipt_mismatch");
    }
  }
  return receipt;
}

/** 提交后另开连接核对备注及已删除主键；不能仅用同事务的DELETE回执当最终清理凭证。 */
export function buildSettlementFixtureReadbackSql(values: string[], value: unknown) {
  const notes = settlementFixtureNotes(values), receipt = validateSettlementCleanupReceipt(value);
  return `set standard_conforming_strings=on;
select json_build_object(
 'releases',(select count(*) from public.wholesale_settlement_releases where note=any(${textArray(notes)}) or id=any(${uuidArray(receipt.releaseIds)})),
 'allocations',(select count(*) from public.wholesale_settlement_release_allocations where release_id=any(${uuidArray(receipt.releaseIds)}) or id=any(${uuidArray(receipt.allocationIds)})),
 'settlements',(select count(*) from public.wholesale_order_settlements where source_settlement_release_id=any(${uuidArray(receipt.releaseIds)}) or id=any(${uuidArray(receipt.settlementIds)})));`;
}
