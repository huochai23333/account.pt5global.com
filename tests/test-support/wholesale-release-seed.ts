import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  prepareEmptySettlementGraphSql,
  repairUuid,
} from "./settlement-repair-sql";

const literal = (value: string) => "'" + value.replaceAll("'", "''") + "'";

/** 两张确定额度的订单只属于本次业务员；发布人与分配人沿用原岗位。 */
export function readWholesaleReleaseSeed(
  execute: (statement: string) => string,
) {
  const context = JSON.parse(
    execute(`select jsonb_build_object(
    'date',public.current_exchange_rate_date(),
    'roles',(select coalesce(jsonb_agg(distinct jsonb_build_object('role',r.role,'id',p.user_id)),'[]')
      from public.user_profiles p join public.user_roles_data d on d.user_id=p.user_id
      join public.user_roles r on r.id=d.role_id
      where r.role in ('finance','salesman') and p.status='active')); `),
  ) as {
    date: string;
    roles: { role: string; id: string }[];
  };
  assert(
    /^\d{4}-\d{2}-\d{2}$/.test(context.date),
    "wholesale_release_fixture_date",
  );
  const roleId = (role: string) => {
    const matches = context.roles.filter((row) => row.role === role);
    assert(
      matches.length === 1 && repairUuid.test(matches[0].id),
      "wholesale_release_fixture_roles",
    );
    return matches[0].id;
  };
  const finance = roleId("finance"),
    salesman = roleId("salesman");
  assert(finance !== salesman, "wholesale_release_fixture_roles");
  const marker = randomUUID(),
    customerId = randomUUID();
  const customerName = `Release Customer ${marker}`;
  const orders = [1600, 2200].map((amount, index) => ({
    id: randomUUID(),
    number: `REL-${marker.slice(0, 8)}-${index + 1}`,
    amount,
    daysAgo: 2 - index,
  }));
  return {
    finance,
    salesman,
    customerId,
    customerName,
    orders,
    date: context.date,
    rateId: randomUUID(),
    releases: {
      formal: {
        note: `多订单结汇分配 ${marker}`,
        customerId,
        customerName,
        amount: 3000,
      },
      temporary: {
        note: `手填客户后分配 ${marker}`,
        customerId: null,
        customerName: `待确认客户 ${marker}`,
        amount: 500,
      },
      cancelled: {
        note: `取消验证 ${marker}`,
        customerId: null,
        customerName: `取消收款 ${marker}`,
        amount: 88.66,
      },
    },
  };
}

export type WholesaleReleaseSeed = ReturnType<typeof readWholesaleReleaseSeed>;
export type ReleaseName = keyof WholesaleReleaseSeed["releases"];

export function seedWholesaleReleaseSql(seed: WholesaleReleaseSeed) {
  const { salesman, date, customerId, customerName, orders, rateId } = seed;
  const values = orders
    .map(
      (
        order,
      ) => `(${literal(order.id)},${literal(order.number)},${literal(customerId)},
    ${literal(salesman)},${literal(salesman)},date_trunc('month',now() at time zone 'Asia/Shanghai')::date,
    now()-interval '${order.daysAgo} days',${order.amount},'USD')`,
    )
    .join(",\n");
  // 只准备本地手工价。精确收款日有价时，正式分配无需派发报价任务。
  return prepareEmptySettlementGraphSql(`select set_config('request.jwt.claim.sub',${literal(salesman)},true) as fixture_salesman \\gset
    insert into public.wholesale_customers(id,unique_name,assigned_sales_user_id,created_by_user_id,salesman_commission_cohort)
      values (${literal(customerId)},${literal(customerName)},${literal(salesman)},${literal(salesman)},'new');
    insert into public.wholesale_orders(id,order_number,customer_id,created_by_user_id,sales_user_id,
      order_month,ordered_at,customer_payment_amount,customer_payment_currency) values ${values};
    insert into public.exchange_rate(id,original_currency,target_currency,rate_date,daily_exchange_rate,bank_quote,
      source,provider_updated_at,provider_rate_date,bank_code,quote_type,is_day_final)
      values(${literal(rateId)},'USD','CNY',${literal(date)},7.2,720,'manual',
        ${literal(date + "T00:00:00+08:00")},${literal(date)},'BOC','spot_buy',false);`);
}
