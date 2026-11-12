import { randomUUID } from "node:crypto";

type ExecuteSql = (statement: string) => string;
type Row = { record: Record<string, unknown>; version: string };
export const sharingOwnerId = "33333333-3333-4333-8333-333333333333";
export const sharingPeerId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const quote = (value: string) => "'" + value.replaceAll("'", "''") + "'";
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
const fullRow =
  "jsonb_build_object('record',to_jsonb(r),'version',r.xmin::text)";

/** 固定角色仍来自原套件；UUID数据意图、凭证和回收只使用调用方显式传入的专属SQL能力。 */
export function createReimbursementSharingCase(execute: ExecuteSql) {
  const marker = `协作报销回归-${randomUUID()}`;
  const intentions = [
    ...Array.from({ length: 205 }, (_, index) => ({
      owner: sharingOwnerId,
      date: "2024-07-25",
      label: `历史费用 ${index + 1}`,
      amount: 1,
    })),
    { owner: sharingPeerId, date: "2024-07-25", label: "同事费用", amount: 99 },
    { owner: sharingOwnerId, date: "2024-08-25", label: "其他周期", amount: 7 },
    { owner: sharingOwnerId, date: "2024-09-02", label: "竞态删除", amount: 8 },
    {
      owner: sharingPeerId,
      date: "2024-09-01",
      label: "上海时间边界",
      amount: 1,
    },
  ].map((value) => ({ ...value, id: randomUUID() }));
  const ids = intentions.map((row) => quote(row.id) + "::uuid").join(",");
  // 已知ID和本次前缀并查：内容被改名、ID被改写或多插入一行，都不能逃出清理核对。
  const scope = `(id in (${ids}) or left(content,${marker.length})=${quote(marker)})`;
  const graph = `select coalesce(jsonb_agg(${fullRow} order by r.id),'[]') from public.operator_reimbursements r where ${scope}`;
  const read = (): Row[] => JSON.parse(execute(graph + ";"));
  let last: Row[] | undefined;
  let attempted = false;
  let cleaned = false;
  function active() {
    if (!attempted || cleaned) throw new Error("sharing_fixture_not_active");
  }
  function validateSeed(rows: Row[]) {
    if (!Array.isArray(rows) || rows.length !== intentions.length)
      throw new Error("sharing_fixture_seed_count");
    for (const intent of intentions) {
      const row = rows.find((row) => row.record?.id === intent.id),
        record = row?.record;
      const period = intent.date < "2024-08-25" ? "2024-07-25" : "2024-08-25";
      const boundary = intent.label === "上海时间边界";
      if (
        !record ||
        typeof row?.version !== "string" ||
        !/^\d+$/.test(row.version) ||
        record.operator_user_id !== intent.owner ||
        record.content !== `${marker} ${intent.label}` ||
        record.spent_at !== intent.date ||
        record.reimbursement_period_start !== period ||
        record.reimbursement_period_end !==
          (period === "2024-07-25" ? "2024-08-24" : "2024-09-24") ||
        Number(record.amount) !== intent.amount ||
        record.status !== (boundary ? "reimbursed" : "unreimbursed") ||
        (boundary
          ? record.reimbursed_by_user_id !== sharingPeerId ||
            Date.parse(String(record.reimbursed_at)) !==
              Date.parse("2026-09-08T16:30:00Z") ||
            Date.parse(String(record.updated_at)) !==
              Date.parse("2026-09-08T16:30:00Z")
          : record.reimbursed_by_user_id !== null ||
            record.reimbursed_at !== null)
      )
        throw new Error("sharing_fixture_seed_mismatch");
    }
  }
  function unchanged() {
    active();
    if (!last || !same(read(), last))
      throw new Error("sharing_fixture_version_changed");
    return structuredClone(last);
  }
  const api = {
    marker,
    seed() {
      if (attempted) throw new Error("sharing_fixture_seed_repeated");
      attempted = true;
      const values = intentions
        .map(
          (row) =>
            `(${quote(row.id)},'${row.owner}','${row.date}',${quote(marker + " " + row.label)},${row.amount})`,
        )
        .join(",");
      // 短事务内锁表并核对两人的整个数据范围；汇总测试不能混入已有费用，绝不先清旧数据。
      execute(`begin; lock table public.operator_reimbursements in share row exclusive mode;
        do $$ begin
          if (select count(distinct p.user_id) from public.user_profiles p join public.user_roles_data d on d.user_id=p.user_id
            join public.user_roles r on r.id=d.role_id where p.user_id in ('${sharingOwnerId}','${sharingPeerId}')
            and p.status='active' and r.role='operator')<>2 or exists(select 1 from public.operator_reimbursements
              where operator_user_id in ('${sharingOwnerId}','${sharingPeerId}')) then
            raise exception 'sharing_fixture_actors_missing_or_scope_occupied';
          end if;
        end $$;
        insert into public.operator_reimbursements(id,operator_user_id,spent_at,content,amount) values ${values};
        -- 仅专属实例的准备事务固定跨日时间。LOCAL设置随提交/回滚恢复，不改全局触发器。
        set local session_replication_role=replica;
        update public.operator_reimbursements set status='reimbursed',reimbursed_by_user_id='${sharingPeerId}',
          reimbursed_at='2026-09-08T16:30:00Z',updated_at='2026-09-08T16:30:00Z'
          where id='${intentions.at(-1)!.id}';
        commit;`);
      const rows = read();
      validateSeed(rows);
      last = rows;
      return structuredClone(last);
    },
    unchanged,
    assertPeriodOwned() {
      unchanged();
      const rows: Row[] = JSON.parse(
        execute(`select coalesce(jsonb_agg(${fullRow} order by r.id),'[]')
        from public.operator_reimbursements r where operator_user_id='${sharingOwnerId}' and reimbursement_period_start='2024-07-25';`),
      );
      const expected = last!.filter(
        (row) =>
          row.record.operator_user_id === sharingOwnerId &&
          row.record.reimbursement_period_start === "2024-07-25",
      );
      if (!same(rows, expected))
        throw new Error("sharing_fixture_period_changed");
    },
    deleted() {
      active();
      if (!last) throw new Error("sharing_fixture_receipt_missing");
      const id = intentions.find((row) => row.label === "竞态删除")!.id;
      if (!last.some((row) => row.record.id === id))
        throw new Error("sharing_fixture_delete_repeated");
      const rows = read();
      if (
        !same(
          rows,
          last.filter((row) => row.record.id !== id),
        )
      )
        throw new Error("sharing_fixture_delete_not_final");
      last = rows;
      return { id, deleted: 1, remaining: rows.length };
    },
    reimbursed() {
      active();
      if (!last) throw new Error("sharing_fixture_receipt_missing");
      const before = last,
        rows = read();
      const mutable = [
        "status",
        "reimbursed_at",
        "reimbursed_by_user_id",
        "updated_at",
      ];
      const stable = (row: Row) =>
        Object.fromEntries(
          Object.entries(row.record).filter(([key]) => !mutable.includes(key)),
        );
      if (rows.length !== before.length)
        throw new Error("sharing_fixture_terminal_count");
      let changed = 0;
      for (const row of rows) {
        const previous = before.find(
          (value) => value.record.id === row.record.id,
        );
        if (!previous) throw new Error("sharing_fixture_terminal_identity");
        if (
          previous.record.operator_user_id === sharingOwnerId &&
          previous.record.reimbursement_period_start === "2024-07-25"
        ) {
          if (
            previous.record.status !== "unreimbursed" ||
            row.record.status !== "reimbursed" ||
            row.record.reimbursed_by_user_id !== sharingOwnerId ||
            row.version === previous.version ||
            !Number.isFinite(Date.parse(String(row.record.reimbursed_at))) ||
            !Number.isFinite(Date.parse(String(row.record.updated_at))) ||
            !same(stable(row), stable(previous))
          )
            throw new Error("sharing_fixture_terminal_invalid");
          changed++;
        } else if (!same(row, previous))
          throw new Error("sharing_fixture_other_scope_changed");
      }
      if (changed !== 205) throw new Error("sharing_fixture_terminal_count");
      last = rows;
      return { updated: changed, total: 205, records: structuredClone(rows) };
    },
    cleanup() {
      if (!attempted || cleaned) return { deleted: 0, inactive: true };
      const rows = read();
      if (!last && !rows.length) {
        cleaned = true;
        return { deleted: 0, absent: true };
      }
      // 准备已提交但回包丢失时，只接纳完全符合209条原始意图的图；业务操作结果未知时绝不接纳新基准。
      if (!last) {
        validateSeed(rows);
        last = rows;
      }
      if (!same(rows, last))
        throw new Error("sharing_fixture_cleanup_version_changed");
      const receipt = JSON.parse(
        execute(`begin;
        lock table public.operator_reimbursements in share row exclusive mode;
        do $$ declare actual jsonb; changed integer; begin
          select coalesce(jsonb_agg(${fullRow} order by r.id),'[]') into actual from public.operator_reimbursements r where ${scope};
          if actual is distinct from ${quote(JSON.stringify(last))}::jsonb then raise exception 'sharing_fixture_cleanup_version_changed'; end if;
          delete from public.operator_reimbursements where id in (${last.map((row) => quote(String(row.record.id)) + "::uuid").join(",")});
          get diagnostics changed=row_count;
          if changed<>${last.length} then raise exception 'sharing_fixture_cleanup_zero_affected'; end if;
        end $$;
        select jsonb_build_object('deleted',${last.length}); commit;`),
      );
      if (receipt.deleted !== last.length)
        throw new Error("sharing_fixture_cleanup_receipt_invalid");
      if (read().length !== 0)
        throw new Error("sharing_fixture_cleanup_not_final");
      cleaned = true;
      return receipt as { deleted: number };
    },
    evidence() {
      return {
        marker,
        attempted,
        cleanupConfirmed: cleaned,
        captured: last ? structuredClone(last) : null,
      };
    },
  };
  return api;
}
