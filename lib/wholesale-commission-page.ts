import type { SupabaseClient } from "@supabase/supabase-js";
import { getCommissionRuleSettings } from "./commission-settings";
import { getWholesaleProfiles } from "./wholesale-profiles";
import { getWholesaleReferralCommissionRows } from "./wholesale-referral-commissions";
import { getAllWholesaleOrders, getWholesaleCustomers, queryWholesaleRows } from "./wholesale-row-queries";
import type { WholesaleCommission } from "./wholesale-types";

/** 推荐佣金与业务员提成展示不同数据，分别读取，避免等待另一页的完整账目。 */
export async function getWholesaleCommissionPageRows(supabase: SupabaseClient, section: "commission" | "incentives", canViewInternalFields: boolean) {
  if (section === "commission") {
    const [customers, referralCommissionRows] = await Promise.all([
      getWholesaleCustomers(supabase), getWholesaleReferralCommissionRows(supabase),
    ]);
    return { customers, referralCommissionRows };
  }
  const [customers, orders, commissions, profiles, commissionRuleSettings] = await Promise.all([
    getWholesaleCustomers(supabase), getAllWholesaleOrders(supabase, canViewInternalFields),
    queryWholesaleRows<WholesaleCommission>(supabase.from("wholesale_commissions").select("*").order("calculated_at", { ascending: false }).order("id", { ascending: false }), "批发提成"),
    getWholesaleProfiles(supabase, false), getCommissionRuleSettings(supabase),
  ]);
  return { customers, orders, commissions, profiles, commissionRuleSettings };
}
