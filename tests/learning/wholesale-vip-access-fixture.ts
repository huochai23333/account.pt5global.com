import { randomUUID } from "node:crypto";
import { expect } from "@playwright/test";
import {
  createLearningUser,
  executeLearningSql,
} from "../../scripts/learning/local-fixture-session.mjs";

type Actor = Awaited<ReturnType<typeof createLearningUser>>;
const quote = (value: string) => "'" + value.replaceAll("'", "''") + "'";

/** 两个专属客户区分本人和他人。客户账号沿用自己自动建立的档案，不改写共享客户。 */
export function createVipAccessFixture(actor: Actor, staff: Actor, client: boolean) {
  for (const id of [actor.id, staff.id]) expect(id).toMatch(/^[a-f0-9-]{36}$/);
  const ids = [
    client
      ? executeLearningSql(
          `select id from public.wholesale_customers where registered_user_id='${actor.id}';`,
        )
      : randomUUID(),
    randomUUID(),
  ];
  for (const id of ids) expect(id).toMatch(/^[a-f0-9-]{36}$/);
  const names = ids.map((id) => `Learning VIP ${id}`);
  const created = client ? [1] : [0, 1];
  executeLearningSql(`begin;
    ${created
      .map(
        (
          index,
        ) => `insert into public.wholesale_customers(id,unique_name,created_by_user_id,assigned_sales_user_id,salesman_commission_cohort)
      values('${ids[index]}','${names[index]}','${index === 0 ? actor.id : staff.id}','${staff.id}','new');`,
      )
      .join("\n")}
    commit;`);
  const selected = ids.map(quote).join(",");
  const tables = {
    customers: ["wholesale_customers", "id"],
    memberships: ["wholesale_vip_memberships", "customer_id"],
    recharges: ["wholesale_vip_recharges", "customer_id"],
    adjustments: ["wholesale_vip_membership_adjustments", "customer_id"],
    commissions: ["wholesale_commissions", "customer_id"],
  } as const;
  const projections = Object.entries(tables).map(
    ([key, [table, column]]) =>
      `'${key}',(select coalesce(jsonb_agg(to_jsonb(t)||jsonb_build_object('rowVersion',xmin::text)order by id),'[]')from public.${table} t where ${column} in(${selected}))`,
  );
  const capture = () =>
    JSON.parse(executeLearningSql(`select jsonb_build_object(${projections.join(",")});`));
  const baseline = capture();
  expect(baseline.customers).toHaveLength(2);
  for (const key of ["memberships", "recharges", "adjustments", "commissions"])
    expect(baseline[key]).toEqual([]);
  return {
    ids,
    names,
    capture,
    baseline,
    facts() {
      // 权限事实由当前数据库读取；真实HTTP还会使用页面登录返回的真实访问令牌独立验收。
      return JSON.parse(
        executeLearningSql(`begin;set local role authenticated;
        set local request.jwt.claim.role='authenticated';set local request.jwt.claim.sub='${actor.id}';
        select jsonb_build_object('role',public.current_app_role(),'business',public.current_user_has_wholesale_access(),
        'staff',public.current_user_is_wholesale_staff(),'canManage',public.current_user_can_manage_wholesale_customer('${ids[0]}'));
        rollback;`),
      );
    },
    requireYear(rechargeId: string) {
      expect(rechargeId).toMatch(/^[a-f0-9-]{36}$/);
      expect(
        executeLearningSql(`select case when operation_type='open'
        then next_expires_at=created_at+interval '1 year'
        else next_expires_at=previous_expires_at+interval '1 year' end
        from public.wholesale_vip_recharges where id='${rechargeId}' and customer_id='${ids[0]}';`),
      ).toBe("t");
    },
    cleanup() {
      const final = capture();
      // 不盲删陌生收费或佣金。未知写入会保留现场，账号清理也会被关联保护挡住。
      expect(final.adjustments).toEqual([]);
      expect(final.commissions).toEqual([]);
      for (const row of final.recharges) expect(row.confirmed_by_user_id).toBe(actor.id);
      for (const row of final.memberships) expect(row.created_by_user_id).toBe(actor.id);
      // 先锁住父客户及本批记录，再比较整行和版本，避免检查后到删除前又出现写入。
      const checks = Object.entries(tables).map(
        ([key, [table, column]]) => `
        perform 1 from public.${table} where ${column} in(${selected})for update;
        if (select coalesce(jsonb_agg(to_jsonb(t)||jsonb_build_object('rowVersion',xmin::text)order by id),'[]')from public.${table} t where ${column} in(${selected}))
          is distinct from ${quote(JSON.stringify(final[key]))}::jsonb then raise exception 'VIP夹具版本已变化，保留现场';end if;`,
      );
      executeLearningSql(`begin;do $$begin ${checks.join("\n")} end$$;
        delete from public.wholesale_vip_recharges where customer_id in(${selected})and confirmed_by_user_id='${actor.id}';
        delete from public.wholesale_vip_memberships where customer_id in(${selected})and created_by_user_id='${actor.id}';
        ${created.map((index) => `delete from public.wholesale_customers where id='${ids[index]}' and unique_name='${names[index]}'and created_by_user_id='${index === 0 ? actor.id : staff.id}';`).join("\n")}
        commit;`);
      const after = capture();
      for (const key of ["memberships", "recharges", "adjustments", "commissions"])
        expect(after[key]).toEqual([]);
      const createdIds = created.map((index) => ids[index]);
      expect(after.customers.filter((row: { id: string }) => createdIds.includes(row.id))).toEqual(
        [],
      );
      if (client)
        expect(after.customers).toEqual(
          baseline.customers.filter((row: { id: string }) => row.id === ids[0]),
        );
      return { createdCustomers: 0, memberships: 0, recharges: 0, adjustments: 0, commissions: 0 };
    },
  };
}
