import type { SupabaseClient } from "@supabase/supabase-js";
import { getCommissionRuleSettings } from "./commission-settings";
import { getWholesaleProfiles } from "./wholesale-profiles";
import { getWholesaleReferralCommissionRows } from "./wholesale-referral-commissions";
import { getAllWholesaleOrders, getWholesaleCustomers, queryWholesaleRows } from "./wholesale-row-queries";
import type { WholesaleCommission } from "./wholesale-types";
import type { WholesaleCommissionBoard } from "./wholesale-commission-boards";

/** 两个标签共用客户查询；客户分支不读取内部订单、员工资料或业务员提成。 */
export async function getWholesaleCommissionPageRows(supabase: SupabaseClient, boards: WholesaleCommissionBoard[]) {
  if (!boards.length) throw new Error("当前账号无法查看提成与佣金。");
  const commissionBoardErrors: Partial<Record<WholesaleCommissionBoard, string>> = {};
  // 两类账目独立处理读取失败；推荐佣金缺报价时仍允许查看已经生成的业务员提成。
  const referralRows = getWholesaleReferralCommissionRows(supabase).catch(() => {
    commissionBoardErrors.referrals = "客户推荐佣金暂时没有加载成功，请刷新页面后重试。";
    return [];
  });
  if (!boards.includes("salesman")) {
    const [customers, referralCommissionRows] = await Promise.all([
      getWholesaleCustomers(supabase), referralRows,
    ]);
    return { customers, referralCommissionRows, commissionBoardErrors };
  }
  const incentives = Promise.all([
    getAllWholesaleOrders(supabase, true),
    queryWholesaleRows<WholesaleCommission>(supabase.from("wholesale_commissions").select("*").order("calculated_at", { ascending: false }).order("id", { ascending: false }), "批发提成"),
    getWholesaleProfiles(supabase, false), getCommissionRuleSettings(supabase),
  ]).then(([orders, commissions, profiles, commissionRuleSettings]) => ({ orders, commissions, profiles, commissionRuleSettings }))
    .catch(() => {
      commissionBoardErrors.salesman = "业务员提成暂时没有加载成功，请刷新页面后重试。";
      return { orders: [], commissions: [], profiles: [], commissionRuleSettings: [] };
    });
  const [customers, incentiveRows, referralCommissionRows] = await Promise.all([
    getWholesaleCustomers(supabase), incentives, referralRows,
  ]);
  return { customers, ...incentiveRows, referralCommissionRows, commissionBoardErrors };
}
