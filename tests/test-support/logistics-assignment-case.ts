import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

type ExecuteSql = (statement: string) => string;
type Row = Record<string, unknown>;
type Proof = { assignments: Row[]; records: Row[] };
const quote = (value: string) => "'" + value.replaceAll("'", "''") + "'";
const admin = "11111111-1111-4111-8111-111111111111";
const salesman = "55555555-5555-4555-8555-555555555555";
const alpha = "c1000000-0000-4000-8000-000000000001";
const beta = "c1000000-0000-4000-8000-000000000002";
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

/** 一份独占店铺/包裹替代修改固定Alpha；SQL能力必须由调用方显式提供并完成物理隔离准入。 */
export function createLogisticsAssignmentCase(execute: ExecuteSql) {
  const owner = randomUUID(),
    assignmentId = randomUUID(),
    recordId = randomUUID();
  const storeName = `Local Ownership ${owner}`,
    packageNumber = `LOCAL-OWN-${owner}`;
  const normalized = storeName.toLowerCase();
  let attempted = false,
    cleanupAttempted = false,
    cleaned = false;
  let peer: string | undefined, expected: Proof | undefined;
  const expression = `jsonb_build_object(
    'assignments',(select coalesce(jsonb_agg(to_jsonb(a)||jsonb_build_object('_xmin',xmin::text)order by id),'[]')
      from public.wholesale_logistics_store_assignments a where store_name_normalized=${quote(normalized)} or id='${assignmentId}'),
    'records',(select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('_xmin',xmin::text)order by id),'[]')
      from public.wholesale_logistics_records r where store_name_normalized=${quote(normalized)} or id='${recordId}'
        or(source_system='dianxiaomi'and package_number=${quote(packageNumber)})))`;
  const read = (): Proof => JSON.parse(execute(`select ${expression};`));
  function active() {
    if (!expected || cleaned || cleanupAttempted)
      throw new Error("logistics_case_not_active");
    return expected;
  }
  function validate(proof: Proof) {
    if (
      !Array.isArray(proof?.assignments) ||
      !Array.isArray(proof?.records) ||
      proof.assignments.length !== 1 ||
      proof.records.length !== 1
    )
      throw new Error("logistics_case_scope_count");
    const a = proof.assignments[0],
      r = proof.records[0];
    if (
      a.id !== assignmentId ||
      r.id !== recordId ||
      a.store_name !== storeName ||
      r.store_name !== storeName ||
      a.store_name_normalized !== normalized ||
      r.store_name_normalized !== normalized ||
      a.effective_from !== null ||
      a.effective_to !== null ||
      a.created_by_user_id !== admin ||
      r.source_system !== "dianxiaomi" ||
      r.package_number !== packageNumber ||
      r.source_order_id !== 1 ||
      Number(r.shipping_cost) !== 1 ||
      r.shipping_currency !== "CNY" ||
      !/^\d+$/.test(String(a._xmin)) ||
      !/^\d+$/.test(String(r._xmin))
    )
      throw new Error("logistics_case_receipt_invalid");
  }
  return {
    owner,
    assignmentId,
    recordId,
    storeName,
    packageNumber,
    prepare() {
      if (attempted)
        throw new Error("logistics_case_prepare_already_attempted");
      // 只读已有岗位/客户，不从认证辅助模块取账号，也不为测试改全局权限。
      const candidates = JSON.parse(
        execute(`select coalesce(jsonb_agg(p.user_id),'[]')
        from public.user_profiles p where p.name='本地协作业务员'and p.status='active'
        and p.user_id<>'${salesman}'and exists(select 1 from public.user_roles_data d join public.user_roles r on r.id=d.role_id
          where d.user_id=p.user_id and r.role='salesman');`),
      );
      if (
        !Array.isArray(candidates) ||
        candidates.length !== 1 ||
        !uuid.test(candidates[0])
      )
        throw new Error("logistics_case_peer_ambiguous");
      peer = candidates[0];
      attempted = true;
      const proof = JSON.parse(
        execute(`begin;set local standard_conforming_strings=on;
        insert into public.wholesale_logistics_records(id,source_order_id,package_number,store_name,order_created_at,shipping_cost,shipping_currency)
          values('${recordId}',1,${quote(packageNumber)},${quote(storeName)},now(),1,'CNY');
        insert into public.wholesale_logistics_store_assignments(id,store_name,sales_user_id,customer_id,created_by_user_id,updated_by_user_id)
          values('${assignmentId}',${quote(storeName)},'${salesman}','${beta}','${admin}','${admin}');
        select ${expression};commit;`),
      );
      validate(proof);
      if (
        proof.assignments[0].sales_user_id !== salesman ||
        proof.assignments[0].customer_id !== beta
      )
        throw new Error("logistics_case_initial_owner_invalid");
      expected = proof;
      this.unchanged();
    },
    snapshot() {
      return structuredClone(active());
    },
    unchanged() {
      const before = active();
      if (!isDeepStrictEqual(read(), before))
        throw new Error("logistics_case_changed");
    },
    confirm(target: "peer" | "initial") {
      if (target !== "peer" && target !== "initial")
        throw new Error("logistics_case_target_invalid");
      const before = active(),
        actual = read();
      validate(actual);
      const next = actual.assignments[0],
        old = before.assignments[0];
      const salesId = target === "peer" ? peer : salesman,
        customerId = target === "peer" ? alpha : beta;
      if (
        next.sales_user_id !== salesId ||
        next.customer_id !== customerId ||
        next.updated_by_user_id !== admin ||
        next._xmin === old._xmin ||
        typeof next.updated_at !== "string" ||
        !Number.isFinite(Date.parse(next.updated_at))
      )
        throw new Error("logistics_case_transition_invalid");
      // 只允许整个原区间的归属和审计版本变化；出现拆分、陌生字段或档案改写均拒绝接受。
      const normalized = structuredClone(actual);
      for (const field of [
        "sales_user_id",
        "customer_id",
        "updated_by_user_id",
        "updated_at",
        "_xmin",
      ])
        normalized.assignments[0][field] = old[field];
      if (!isDeepStrictEqual(normalized, before))
        throw new Error("logistics_case_unexpected_write");
      expected = actual;
      return structuredClone(next);
    },
    cleanup() {
      if (!attempted || cleaned) return { assignments: 0, records: 0 };
      if (!expected) throw new Error("logistics_case_prepare_outcome_unknown");
      if (cleanupAttempted)
        throw new Error("logistics_case_cleanup_outcome_unknown");
      const proof = active();
      cleanupAttempted = true;
      const receipt = JSON.parse(
        execute(`begin;set local standard_conforming_strings=on;
        lock table public.wholesale_logistics_records,public.wholesale_logistics_store_assignments in share row exclusive mode;
        do $logistics_case$declare affected integer;begin
          if exists(select 1 from pg_constraint where contype='f' and confrelid in(
            'public.wholesale_logistics_records'::regclass,'public.wholesale_logistics_store_assignments'::regclass))then
            raise exception 'logistics_case_external_reference';end if;
          if ${expression} is distinct from ${quote(JSON.stringify(proof))}::jsonb then
            raise exception 'logistics_case_cleanup_changed';end if;
          delete from public.wholesale_logistics_store_assignments where id='${assignmentId}'and xmin::text=${quote(String(proof.assignments[0]._xmin))};
          get diagnostics affected=row_count;if affected<>1 then raise exception 'logistics_case_assignment_delete_zero';end if;
          delete from public.wholesale_logistics_records where id='${recordId}'and xmin::text=${quote(String(proof.records[0]._xmin))};
          get diagnostics affected=row_count;if affected<>1 then raise exception 'logistics_case_record_delete_zero';end if;
        end $logistics_case$;commit;select jsonb_build_object('assignments',1,'records',1,'owner','${owner}');`),
      );
      if (
        receipt.assignments !== 1 ||
        receipt.records !== 1 ||
        receipt.owner !== owner
      )
        throw new Error("logistics_case_cleanup_receipt_invalid");
      const after = read();
      if (after.assignments.length !== 0 || after.records.length !== 0)
        throw new Error("logistics_case_cleanup_not_final");
      cleaned = true;
      return receipt;
    },
    evidence() {
      return {
        owner,
        storeName,
        assignmentId,
        recordId,
        peer,
        attempted,
        cleaned,
        cleanupAttempted,
        expected: structuredClone(expected),
      };
    },
  };
}
