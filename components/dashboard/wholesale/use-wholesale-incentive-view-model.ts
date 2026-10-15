"use client";

import { useMemo, useState } from "react";
import { useLocale } from "@/components/i18n/locale-provider";
import type { CommissionRuleSetting } from "@/lib/commission-settings";
import { normalizeSearchText } from "@/lib/value-normalizers";
import type { WholesaleCommission, WholesaleCustomer, WholesaleOrder, WholesaleProfile } from "@/lib/wholesale";
import { getCustomerName, getProfileName } from "./wholesale-display";
import { formatWholesaleOrderCommissionDescription } from "./wholesale-commission-settings";

const ALL = "all";
/** 筛选和金额汇总只使用已经过服务端权限裁剪的数据，标签切换时持续保留此 hook。 */
export function useWholesaleIncentiveViewModel({ commissions, customersById, orders, profilesById, commissionRuleSettings }: {
  commissions: WholesaleCommission[];
  customersById: Map<string, WholesaleCustomer>;
  orders: WholesaleOrder[];
  profilesById: Map<string, WholesaleProfile>;
  commissionRuleSettings: CommissionRuleSetting[];
}) {
  const [incentiveSearch, setIncentiveSearch] = useState("");
  const [incentiveStatusFilter, setIncentiveStatusFilter] = useState(ALL);
  const [incentiveSalesFilter, setIncentiveSalesFilter] = useState(ALL);
  const { locale } = useLocale();
  const orderById = useMemo(
    () => new Map(orders.map((order) => [order.id, order])),
    [orders],
  );
  const commissionDescription = useMemo(
    () =>
      formatWholesaleOrderCommissionDescription(commissionRuleSettings, locale),
    [commissionRuleSettings, locale],
  );
  const filteredCommissions = useMemo(() => {
    const searchValue = normalizeSearchText(incentiveSearch);
    return commissions.filter((commission) => {
      const order = orderById.get(commission.order_id);
      if (
        incentiveStatusFilter !== ALL &&
        commission.status !== incentiveStatusFilter
      ) {
        return false;
      }
      if (
        incentiveSalesFilter !== ALL &&
        (commission.beneficiary_user_id ?? "") !== incentiveSalesFilter
      ) {
        return false;
      }
      if (!searchValue) return true;
      return [
        order?.order_number ?? "",
        getCustomerName(customersById, commission.customer_id),
        getProfileName(profilesById, commission.beneficiary_user_id),
      ].some((value) => normalizeSearchText(value).includes(searchValue));
    });
  }, [
    commissions,
    customersById,
    incentiveSalesFilter,
    incentiveSearch,
    incentiveStatusFilter,
    orderById,
    profilesById,
  ]);
  const totalCommission = commissions.reduce(
    (sum, row) => sum + Number(row.commission_amount_rmb ?? 0),
    0,
  );
  const pendingCommission = commissions
    .filter((row) => row.status === "pending")
    .reduce((sum, row) => sum + Number(row.commission_amount_rmb ?? 0), 0);
  const salesAccounts = useMemo(() => {
    const userIds = new Set(
      commissions
        .map((commission) => commission.beneficiary_user_id)
        .filter((value): value is string => Boolean(value)),
    );
    return [...userIds].map((userId) => ({
      label: getProfileName(profilesById, userId),
      userId,
    }));
  }, [commissions, profilesById]);
  const hasActiveFilters =
    incentiveSearch ||
    incentiveStatusFilter !== ALL ||
    incentiveSalesFilter !== ALL;
  return { incentiveSearch, setIncentiveSearch, incentiveStatusFilter, setIncentiveStatusFilter,
    incentiveSalesFilter, setIncentiveSalesFilter, orderById, commissionDescription,
    filteredCommissions, totalCommission, pendingCommission, salesAccounts, hasActiveFilters };
}
