import { randomUUID } from "node:crypto";

type ExecuteSql = (statement: string) => string;
type Snapshot = { record: Record<string, unknown>; version: string };
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const quote = (value: string) => "'" + value.replaceAll("'", "''") + "'";
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

/** 只接受原套件显式提供的专属SQL能力，不发现账号、读取密钥或选择共享容器。 */
export function createOperatorReimbursementFixture(
  execute: ExecuteSql,
  operatorId: string,
  periodStart: string,
) {
  if (!uuid.test(operatorId) || !/^\d{4}-(?:0[1-9]|1[0-2])-25$/.test(periodStart))
    throw new Error("reimbursement_fixture_identity_invalid");
  const end = new Date(periodStart + "T00:00:00Z");
  if (!Number.isFinite(end.getTime())) throw new Error("reimbursement_fixture_period_invalid");
  end.setUTCMonth(end.getUTCMonth() + 1);
  end.setUTCDate(end.getUTCDate() - 1);
  const periodEnd = end.toISOString().slice(0, 10);
  const content = `自动测试报销 ${randomUUID()}`;
  let amount: string | undefined;
  let last: Snapshot | undefined;
  let prepared = false;
  let cleaned = false;
  const candidate = `operator_user_id='${operatorId}'::uuid and content=${quote(content)}`;
  const fullRow = "jsonb_build_object('record',to_jsonb(r),'version',r.xmin::text)";
  const read = (): Snapshot[] =>
    JSON.parse(
      execute(`select coalesce(jsonb_agg(${fullRow} order by r.id),'[]')
    from public.operator_reimbursements r where ${candidate};`),
    );
  function requirePrepared() {
    if (!prepared || !amount || cleaned) throw new Error("reimbursement_fixture_not_active");
  }
  function validate(row: Snapshot) {
    const record = row?.record;
    if (
      !record ||
      typeof record.id !== "string" ||
      !uuid.test(record.id) ||
      typeof row.version !== "string" ||
      record.operator_user_id !== operatorId ||
      record.content !== content ||
      record.spent_at !== periodStart ||
      record.reimbursement_period_start !== periodStart ||
      record.reimbursement_period_end !== periodEnd ||
      Number(record.amount).toFixed(2) !== amount ||
      (last && record.id !== last.record.id)
    )
      throw new Error("reimbursement_fixture_record_mismatch");
  }
  function one() {
    const rows = read();
    if (!Array.isArray(rows) || rows.length !== 1) throw new Error("reimbursement_fixture_record_count");
    validate(rows[0]);
    return rows[0];
  }
  const api = {
    content,
    periodStart,
    periodEnd,
    prepare(expectedAmount: string) {
      if (prepared || !/^\d{1,10}\.\d{2}$/.test(expectedAmount) || Number(expectedAmount) <= 0)
        throw new Error("reimbursement_fixture_prepare_invalid");
      const result = JSON.parse(
        execute(`select jsonb_build_object(
        'activeOperator',exists(select 1 from public.user_profiles p join public.user_roles_data d on d.user_id=p.user_id
          join public.user_roles r on r.id=d.role_id where p.user_id='${operatorId}'::uuid and p.status='active' and r.role='operator'),
        'periodCount',(select count(*) from public.operator_reimbursements where operator_user_id='${operatorId}'::uuid
          and reimbursement_period_start='${periodStart}'::date));`),
      );
      if (result.activeOperator !== true || result.periodCount !== 0)
        throw new Error("reimbursement_fixture_period_not_empty_or_operator_missing");
      // 周期由本次测试独占。已有记录就停止，绝不清旧前缀给当前测试腾空。
      amount = expectedAmount;
      prepared = true;
    },
    seed() {
      requirePrepared();
      execute(`insert into public.operator_reimbursements(operator_user_id,spent_at,content,amount)
        values('${operatorId}','${periodStart}',${quote(content)},${quote(amount!)}::numeric);`);
      return api.saved();
    },
    saved() {
      requirePrepared();
      const row = one();
      if (
        row.record.status !== "unreimbursed" ||
        row.record.reimbursed_at !== null ||
        row.record.reimbursed_by_user_id !== null
      )
        throw new Error("reimbursement_fixture_pending_metadata_invalid");
      if (last && !same(row, last)) throw new Error("reimbursement_fixture_saved_version_changed");
      last = row;
      return structuredClone(row);
    },
    assertPeriodOwned() {
      requirePrepared();
      if (!last) throw new Error("reimbursement_fixture_saved_receipt_missing");
      const rows = JSON.parse(
        execute(`select coalesce(jsonb_agg(${fullRow} order by r.id),'[]')
        from public.operator_reimbursements r where operator_user_id='${operatorId}'::uuid
          and reimbursement_period_start='${periodStart}'::date;`),
      );
      if (!Array.isArray(rows) || rows.length !== 1 || !same(rows[0], last))
        throw new Error("reimbursement_fixture_period_changed");
    },
    reimbursed() {
      requirePrepared();
      if (!last || last.record.status !== "unreimbursed")
        throw new Error("reimbursement_fixture_pending_receipt_missing");
      const row = one();
      const immutable = (value: Record<string, unknown>) =>
        Object.fromEntries(
          Object.entries(value).filter(
            ([key]) => !["status", "reimbursed_at", "reimbursed_by_user_id", "updated_at"].includes(key),
          ),
        );
      if (
        row.record.status !== "reimbursed" ||
        typeof row.record.reimbursed_at !== "string" ||
        row.record.reimbursed_by_user_id !== operatorId ||
        row.version === last.version ||
        !same(immutable(row.record), immutable(last.record))
      )
        throw new Error("reimbursement_fixture_terminal_invalid");
      last = row;
      return structuredClone(row);
    },
    unchanged() {
      requirePrepared();
      if (!last || !same(one(), last)) throw new Error("reimbursement_fixture_version_changed");
      return structuredClone(last);
    },
    cleanup() {
      if (!prepared || cleaned) return { deleted: 0, inactive: true };
      const rows = read();
      if (!Array.isArray(rows)) throw new Error("reimbursement_fixture_cleanup_snapshot_invalid");
      if (!rows.length && !last) {
        cleaned = true;
        return { deleted: 0, alreadyAbsent: true };
      }
      if (rows.length !== 1) throw new Error("reimbursement_fixture_cleanup_record_count");
      validate(rows[0]);
      // 首次创建的响应丢失时，只能接纳本次UUID的未报销行；未知报销结果不能重写旧凭证。
      if (last ? !same(rows[0], last) : rows[0].record.status !== "unreimbursed")
        throw new Error("reimbursement_fixture_cleanup_version_changed");
      const expected = rows[0],
        id = expected.record.id as string;
      const receipt = JSON.parse(
        execute(`begin;
        lock table public.operator_reimbursements in share row exclusive mode;
        create temp table expected_reimbursement on commit drop as select ${quote(JSON.stringify(expected))}::jsonb value;
        do $$ declare actual jsonb; changed integer; begin
          select ${fullRow} into actual from public.operator_reimbursements r where id='${id}'::uuid;
          if actual is distinct from (select value from pg_temp.expected_reimbursement) then
            raise exception 'reimbursement_fixture_cleanup_version_changed';
          end if;
          delete from public.operator_reimbursements where id='${id}'::uuid and ${candidate} and xmin::text=${quote(expected.version)};
          get diagnostics changed=row_count;
          if changed<>1 then raise exception 'reimbursement_fixture_cleanup_zero_affected'; end if;
        end $$;
        select jsonb_build_object('id','${id}','deleted',1);
        commit;`),
      );
      if (receipt.id !== id || receipt.deleted !== 1)
        throw new Error("reimbursement_fixture_cleanup_receipt_invalid");
      const remaining = JSON.parse(
        execute(
          `select count(*) from public.operator_reimbursements where id='${id}'::uuid or (${candidate});`,
        ),
      );
      if (remaining !== 0) throw new Error("reimbursement_fixture_cleanup_not_final");
      cleaned = true;
      return receipt;
    },
    evidence() {
      // 返回最后已核对的凭证副本；未知结果不读成新基准，也不允许报告修改内部期望。
      return {
        content,
        operatorId,
        periodStart,
        amount,
        prepared,
        cleanupConfirmed: cleaned,
        captured: last ? structuredClone(last) : null,
      };
    },
  };
  return api;
}
