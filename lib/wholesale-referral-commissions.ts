import type { SupabaseClient } from "@supabase/supabase-js";

import { withRequestTimeout } from "./request-timeout";

export type WholesaleReferralCommissionRow = {
  amount: number | null;
  amountCommissionRmb: number;
  monthKey: string;
  monthlyOrderAmountRmb: number;
  orderAmountParameterVersionIds: string[];
  orderNumbers: string[];
  parameterMissing: boolean;
  rateMissing: boolean;
  referredCustomerId: string;
  referrerCustomerId: string;
  usdToCnyRate: number | null;
  waybillBonusParameterVersionId: string | null;
  waybillBonusRmb: number | null;
  waybillBonusUsd: number | null;
  waybillCount: number;
};

type ReferralCommissionRecord = {
  amount: number | string | null;
  amount_commission_rmb: number | string | null;
  month_key: string | null;
  monthly_order_amount_rmb: number | string | null;
  order_amount_parameter_version_ids: string[] | null;
  order_numbers: string[] | null;
  parameter_missing: boolean | null;
  rate_missing: boolean | null;
  referred_customer_id: string | null;
  referrer_customer_id: string | null;
  usd_to_cny_rate: number | string | null;
  waybill_bonus_parameter_version_id: string | null;
  waybill_bonus_rmb: number | string | null;
  waybill_bonus_usd: number | string | null;
  waybill_count: number | string | null;
};

/** 推荐佣金已由数据库按订单锁定版本计算，这里只做字段命名和数值归一化。 */
export async function getWholesaleReferralCommissionRows(
  supabase: SupabaseClient,
) {
  const { data, error } = await withRequestTimeout(
    supabase.rpc("get_wholesale_referral_commission_rows"),
  );
  if (error) throw error;

  return (
    (data ?? []) as unknown as ReferralCommissionRecord[]
  ).flatMap<WholesaleReferralCommissionRow>((row) => {
    if (
      !row.referrer_customer_id ||
      !row.referred_customer_id ||
      !row.month_key
    )
      return [];
    return [
      {
        amount: parseNullableNumber(row.amount),
        amountCommissionRmb: parseNumber(row.amount_commission_rmb),
        monthKey: row.month_key,
        monthlyOrderAmountRmb: parseNumber(row.monthly_order_amount_rmb),
        orderAmountParameterVersionIds:
          row.order_amount_parameter_version_ids ?? [],
        orderNumbers: row.order_numbers ?? [],
        parameterMissing: Boolean(row.parameter_missing),
        rateMissing: Boolean(row.rate_missing),
        referredCustomerId: row.referred_customer_id,
        referrerCustomerId: row.referrer_customer_id,
        usdToCnyRate: parseNullableNumber(row.usd_to_cny_rate),
        waybillBonusParameterVersionId: row.waybill_bonus_parameter_version_id,
        waybillBonusRmb: parseNullableNumber(row.waybill_bonus_rmb),
        waybillBonusUsd: parseNullableNumber(row.waybill_bonus_usd),
        waybillCount: parseNumber(row.waybill_count),
      },
    ];
  });
}

function parseNumber(value: number | string | null) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseNullableNumber(value: number | string | null) {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
