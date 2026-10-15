"use client";

import { useMemo, useState } from "react";
import { normalizeSearchText } from "@/lib/value-normalizers";
import type { WholesaleCustomer } from "@/lib/wholesale";
import type { WholesaleReferralCommissionRow } from "@/lib/wholesale-referral-commissions";
import { getCustomerName } from "./wholesale-display";

const ALL = "all";
/** 推荐佣金的筛选与汇总独立管理，两个标签的筛选条件互不覆盖。 */
export function useWholesaleReferralCommissionViewModel(customersById: Map<string, WholesaleCustomer>, referralRows: WholesaleReferralCommissionRow[]) {
  const [search, setSearch] = useState("");
  const [customerFilter, setCustomerFilter] = useState(ALL);
  const filteredRows = useMemo(() => {
    const searchValue = normalizeSearchText(search);
    return referralRows.filter((row) => {
      if (
        customerFilter !== ALL &&
        row.referrerCustomerId !== customerFilter &&
        row.referredCustomerId !== customerFilter
      ) {
        return false;
      }
      if (!searchValue) return true;
      return [
        getCustomerName(customersById, row.referrerCustomerId),
        getCustomerName(customersById, row.referredCustomerId),
        row.orderNumbers.join(" "),
        row.monthKey,
      ].some((value) => normalizeSearchText(value).includes(searchValue));
    });
  }, [customerFilter, customersById, referralRows, search]);
  const totalReferralCommission = referralRows.reduce(
    (sum, row) => sum + (row.amount ?? 0),
    0,
  );
  const chargedWaybillCount = referralRows.reduce(
    (sum, row) => sum + row.waybillCount,
    0,
  );
  const hasActiveFilters = search || customerFilter !== ALL;
  return { search, setSearch, customerFilter, setCustomerFilter, filteredRows,
    totalReferralCommission, chargedWaybillCount, hasActiveFilters };
}
