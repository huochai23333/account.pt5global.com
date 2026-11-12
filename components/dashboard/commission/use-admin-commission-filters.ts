"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import type { AdminCommissionRow } from "@/lib/admin-commission";

import {
  filterAdminCommissions,
  summarizeByBeneficiary,
  type CategoryFilter,
  type CommissionFilters,
  type SettlementFilter,
} from "./admin-commission-view-model";

const EMPTY_FILTERS: CommissionFilters = {
  beneficiaryUserId: "",
  category: "all",
  orderNumber: "",
  searchText: "",
  settlementStatus: "all",
};

// 筛选只影响当前列表与汇总，输入关键字时让表单先响应。
export function useAdminCommissionFilters(commissions: AdminCommissionRow[]) {
  const t = useTranslations("Commission");
  const [filters, setFilters] = useState<CommissionFilters>(EMPTY_FILTERS);
  const deferredSearchText = useDeferredValue(filters.searchText);

  const beneficiaryOptions = useMemo(
    () => summarizeByBeneficiary(commissions),
    [commissions],
  );
  const filteredCommissions = useMemo(
    () => filterAdminCommissions(commissions, { ...filters, searchText: deferredSearchText }, t),
    [commissions, deferredSearchText, filters, t],
  );
  const beneficiarySummaries = useMemo(
    () => summarizeByBeneficiary(filteredCommissions),
    [filteredCommissions],
  );

  const settlementOptions = useMemo(
    () => [
      { value: "all" as SettlementFilter, label: t("options.settlement.all") },
      {
        value: "pending" as SettlementFilter,
        label: t("options.settlement.pending"),
      },
      {
        value: "paid" as SettlementFilter,
        label: t("options.settlement.paid"),
      },
      {
        value: "cancelled" as SettlementFilter,
        label: t("options.settlement.cancelled"),
      },
      {
        value: "reversed" as SettlementFilter,
        label: t("options.settlement.reversed"),
      },
    ],
    [t],
  );
  const categoryOptions = useMemo(
    () => [
      { value: "all" as CategoryFilter, label: t("options.category.all") },
      {
        value: "salesman_purchase" as CategoryFilter,
        label: t("options.category.salesmanPurchase"),
      },
      {
        value: "salesman_service" as CategoryFilter,
        label: t("options.category.salesmanService"),
      },
      {
        value: "referral_purchase" as CategoryFilter,
        label: t("options.category.referralPurchase"),
      },
      {
        value: "referral_service" as CategoryFilter,
        label: t("options.category.referralService"),
      },
      {
        value: "referral_vip_first_year_bonus" as CategoryFilter,
        label: t("options.category.referralVipFirstYearBonus"),
      },
      {
        value: "manual_adjustment" as CategoryFilter,
        label: t("options.category.manualAdjustment"),
      },
    ],
    [t],
  );
  return {
    beneficiaryOptions,
    beneficiarySummaries,
    categoryOptions,
    drillDownToBeneficiary: (userId: string) =>
      setFilters({ ...EMPTY_FILTERS, beneficiaryUserId: userId }),
    filteredCommissions,
    filters,
    focusOrderNumber: (orderNumber: string) =>
      setFilters((current) => ({ ...current, orderNumber, searchText: "" })),
    handleFilterChange: <Key extends keyof CommissionFilters>(
      key: Key,
      value: CommissionFilters[Key],
    ) => setFilters((current) => ({ ...current, [key]: value })),
    hasActiveFilters: Boolean(
      filters.searchText ||
      filters.beneficiaryUserId ||
      filters.orderNumber ||
      filters.settlementStatus !== "all" ||
      filters.category !== "all",
    ),
    resetFilters: () => setFilters(EMPTY_FILTERS),
    settlementOptions,
  };
}
