import type { SupabaseClient } from "@supabase/supabase-js";
import { getWholesaleOrderAssessmentSample } from "./wholesale-order-assessment-sample";

import type { AppRole } from "./auth-routing";
import {
  type CommissionRuleSetting,
} from "./commission-settings";
import { getWholesaleCommissionPageRows } from "./wholesale-commission-page";
import { getWholesaleCustomers, queryWholesaleRows as queryRows } from "./wholesale-row-queries";
import { getCurrentSessionContext } from "./current-session-context";
import { getExchangeRates, type ExchangeRateRow } from "./exchange-rates";
import { getDefaultOrderDateRange } from "./order-date-range";
import {
  getDefaultWholesaleLogisticsFilters,
  getInitialWholesaleLogisticsData,
  type WholesaleReferralWaybillCount,
} from "./wholesale-logistics-page";
import { scopeWholesaleRows } from "./wholesale-scope";
import {
  type WholesaleReferralCommissionRow,
} from "./wholesale-referral-commissions";
import {
  getWholesaleOrderPage,
  type WholesaleOrderFilters,
} from "./wholesale-order-page";
import {
  getWholesaleProfiles,
  getWholesaleProfilesWithCandidates,
} from "./wholesale-profiles";
import type { WorkspaceWholesaleSectionKey } from "./workspace-config";
import type {
  WholesaleCommission,
  WholesaleCustomer,
  WholesaleOrder,
  WholesaleOrderChangeLog,
  WholesaleOrderSettlement,
  WholesalePageData,
  WholesaleProfile,
  WholesaleReferral,
} from "./wholesale-types";

export * from "./wholesale-types";

export async function getWholesalePageData(
  supabase: SupabaseClient,
  section: WorkspaceWholesaleSectionKey,
  options?: {
    orderFilters?: WholesaleOrderFilters;
    orderSampleSize?: number;
  },
): Promise<WholesalePageData> {
  const sessionContext = await getCurrentSessionContext(supabase);
  const currentRole = sessionContext.role;
  const currentUserId = sessionContext.user?.id ?? null;
  const baseData = createEmptyWholesalePageData({
    currentRole,
    currentUserId,
    section,
  });

  if (section === "orders") {
    const filters = options?.orderFilters ?? getInitialWholesaleOrderFilters();
    const [customers, profiles, exchangeRates, orderPageResult] =
      await Promise.all([
        getWholesaleCustomers(supabase),
        getWholesaleProfiles(supabase, false),
        getExchangeRates(supabase),
        getWholesaleOrderPage(supabase, filters)
          .then((page) => ({ error: null, page }))
          .catch((error: unknown) => ({
            error:
              error instanceof Error
                ? error.message
                : "批发订单暂时没有加载成功，请稍后重试。",
            page: null,
          })),
      ]);

    const orderPage = orderPageResult.page && options?.orderSampleSize
      ? await getWholesaleOrderAssessmentSample(supabase, filters, orderPageResult.page, options.orderSampleSize)
      : orderPageResult.page;

    return {
      ...baseData,
      customers,
      exchangeRates,
      orderChangeLogs: orderPage?.orderChangeLogs ?? [],
      orderPage,
      orderPageError: orderPageResult.error,
      // 订单列表会按当前角色裁剪内部字段；只有具备内部查看权限时，其他批发板块才接收完整订单。
      orders: orderPage?.canViewInternalFields
        ? (orderPage.orders as WholesaleOrder[])
        : [],
      orderSettlements: orderPage?.orderSettlements ?? [],
      profiles,
    };
  }

  if (section === "logistics") {
    const logisticsFilters = getDefaultWholesaleLogisticsFilters(
      currentRole,
      currentUserId,
    );
    const [customers, profiles, logisticsData] = await Promise.all([
      getWholesaleCustomers(supabase),
      getWholesaleProfiles(supabase, false),
      getInitialWholesaleLogisticsData(supabase, logisticsFilters),
    ]);

    return {
      ...baseData,
      ...logisticsData,
      customers,
      logisticsFilters,
      profiles,
    };
  }

  const rows = await getWholesaleSectionRows(supabase, section, currentRole);
  const scopedRows = scopeWholesaleRows({
    ...rows,
    currentRole,
    currentUserId,
  });

  return {
    ...baseData,
    commissionRuleSettings: rows.commissionRuleSettings,
    exchangeRates: rows.exchangeRates,
    ...scopedRows,
    // 推荐佣金的 RPC 已按调用者 RLS 裁剪；页面必须拿到查询结果，不能回落为空数组。
    referralCommissionRows: rows.referralCommissionRows,
  };
}

type WholesaleSectionRows = {
  commissionRuleSettings: CommissionRuleSetting[];
  commissions: WholesaleCommission[];
  customers: WholesaleCustomer[];
  exchangeRates: ExchangeRateRow[];
  referralWaybillCounts: WholesaleReferralWaybillCount[];
  referralCommissionRows: WholesaleReferralCommissionRow[];
  orderChangeLogs: WholesaleOrderChangeLog[];
  orderSettlements: WholesaleOrderSettlement[];
  orders: WholesaleOrder[];
  profiles: WholesaleProfile[];
  referrals: WholesaleReferral[];
  registeredCandidates: WholesaleProfile[];
};

async function getWholesaleSectionRows(
  supabase: SupabaseClient,
  section: WorkspaceWholesaleSectionKey,
  currentRole: AppRole | null,
): Promise<WholesaleSectionRows> {
  const rows = createEmptyWholesaleSectionRows();
  const canViewInternalFields = currentRole !== "client";

  if (section === "customers") {
    const [customers, profileResult] = await Promise.all([
      getWholesaleCustomers(supabase),
      getWholesaleProfilesWithCandidates(supabase, true),
    ]);

    return { ...rows, customers, ...profileResult };
  }

  if (section === "people") {
    return { ...rows, profiles: await getWholesaleProfiles(supabase, false) };
  }

  if (section === "referrals") {
    const [customers, referrals] = await Promise.all([
      getWholesaleCustomers(supabase),
      queryRows<WholesaleReferral>(
        supabase
          .from("wholesale_referrals")
          .select("*")
          .order("created_at", { ascending: false }).order("id", { ascending: false }),
        "批发推荐关系",
      ),
    ]);

    return { ...rows, customers, referrals };
  }

  if (section === "commission" || section === "incentives") {
    return { ...rows, ...await getWholesaleCommissionPageRows(supabase, section, canViewInternalFields) };
  }

  return rows;
}

function createEmptyWholesalePageData({
  currentRole,
  currentUserId,
  section,
}: {
  currentRole: AppRole | null;
  currentUserId: string | null;
  section: WorkspaceWholesaleSectionKey;
}): WholesalePageData {
  return {
    ...createEmptyWholesaleSectionRows(),
    currentRole,
    currentUserId,
    logisticsAssignments: [],
    logisticsFilters: null,
    logisticsPage: null,
    logisticsStoreOptions: [],
    orderPage: null,
    orderPageError: null,
    section,
  };
}

function createEmptyWholesaleSectionRows(): WholesaleSectionRows {
  return {
    commissionRuleSettings: [],
    commissions: [],
    customers: [],
    exchangeRates: [],
    referralWaybillCounts: [],
    referralCommissionRows: [],
    orderChangeLogs: [],
    orderSettlements: [],
    orders: [],
    profiles: [],
    referrals: [],
    registeredCandidates: [],
  };
}

function getInitialWholesaleOrderFilters(): WholesaleOrderFilters {
  const range = getDefaultOrderDateRange();

  return {
    customerId: "",
    orderMonth: "",
    orderedFromDate: range.fromDate,
    orderedToDate: range.toDate,
    salesUserId: "",
    searchText: "",
    searchMode: "date_range",
    status: "all",
  };
}
