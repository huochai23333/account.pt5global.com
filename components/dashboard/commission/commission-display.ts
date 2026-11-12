"use client";

import type {
  AdminCommissionRow,
  CommissionCategory,
  CommissionSettlementStatus,
} from "@/lib/admin-commission";
import type { Locale } from "@/lib/locale";
import type { AppRole } from "@/lib/user-self-service";

import {
  getRawErrorMessage,
} from "@/components/dashboard/dashboard-shared-ui";

type TranslationValues = Record<string, string | number>;
type TranslateFn = (key: string, values?: TranslationValues) => string;

export function formatCommissionMoney(value: number, locale: Locale) {
  return new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNullableCommissionMoney(
  value: number | null,
  locale: Locale,
  t: TranslateFn,
) {
  return value === null
    ? t("shared.fallback.none")
    : formatCommissionMoney(value, locale);
}

export function getCommissionRoleLabel(role: AppRole | null, t: TranslateFn) {
  switch (role) {
    case "administrator":
      return t("shared.roles.administrator");
    case "operator":
      return t("shared.roles.operator");
    case "manager":
      return t("shared.roles.manager");
    case "recruiter":
      return t("shared.roles.recruiter");
    case "promoter":
      return t("shared.roles.promoter");
    case "salesman":
      return t("shared.roles.salesman");
    case "finance":
      return t("shared.roles.finance");
    case "client":
      return t("shared.roles.client");
    default:
      return t("shared.roles.unknown");
  }
}

export function getCommissionCategoryLabel(
  category: CommissionCategory,
  t: TranslateFn,
) {
  switch (category) {
    case "salesman_purchase":
      return t("shared.categories.salesmanPurchase");
    case "salesman_service":
      return t("shared.categories.salesmanService");
    case "referral_purchase":
      return t("shared.categories.referralPurchase");
    case "referral_service":
      return t("shared.categories.referralService");
    case "referral_vip_first_year_bonus":
      return t("shared.categories.referralVipFirstYearBonus");
    case "manual_adjustment":
      return t("shared.categories.manualAdjustment");
    default:
      return t("shared.categories.default");
  }
}

export function getCommissionSettlementStatusLabel(
  status: CommissionSettlementStatus,
  t: TranslateFn,
) {
  switch (status) {
    case "pending":
      return t("shared.settlementStatuses.pending");
    case "paid":
      return t("shared.settlementStatuses.paid");
    case "cancelled":
      return t("shared.settlementStatuses.cancelled");
    case "reversed":
      return t("shared.settlementStatuses.reversed");
    default:
      return t("shared.settlementStatuses.unknown");
  }
}

export function getCommissionOrderStatusLabel(
  status: string | null,
  t: TranslateFn,
) {
  switch (status) {
    case "pending":
      return t("shared.orderStatuses.pending");
    case "in_progress":
      return t("shared.orderStatuses.inProgress");
    case "settled":
      return t("shared.orderStatuses.settled");
    case "completed":
      return t("shared.orderStatuses.completed");
    case "cancelled":
      return t("shared.orderStatuses.cancelled");
    case "refunding":
      return t("shared.orderStatuses.refunding");
    default:
      return t("shared.orderStatuses.unknown");
  }
}

export function getCommissionOriginText(
  commission: AdminCommissionRow,
  t: TranslateFn,
) {
  const customerLabel =
    commission.sourceCustomer?.label ?? t("shared.origin.customerFallback");

  switch (commission.category) {
    case "salesman_purchase":
      return t("shared.origin.salesmanPurchase", {
        customerLabel,
        orderNumber: commission.orderNumber,
      });
    case "salesman_service":
      return t("shared.origin.salesmanService", {
        customerLabel,
        orderNumber: commission.orderNumber,
      });
    case "referral_purchase":
      return t("shared.origin.referralPurchase", {
        customerLabel,
        orderNumber: commission.orderNumber,
      });
    case "referral_service":
      return t("shared.origin.referralService", {
        customerLabel,
        orderNumber: commission.orderNumber,
      });
    case "referral_vip_first_year_bonus":
      return t("shared.origin.referralVipFirstYearBonus", {
        customerLabel,
        orderNumber: commission.orderNumber,
      });
    case "manual_adjustment":
      return t("shared.origin.manualAdjustment", {
        orderNumber: commission.orderNumber,
      });
    default:
      return t("shared.origin.default", {
        orderNumber: commission.orderNumber,
      });
  }
}

export function toCommissionErrorMessage(
  error: unknown,
  t: TranslateFn,
  scope: "admin" | "salesman",
) {
  const rawMessage = getRawErrorMessage(error);

  if (rawMessage.includes("commission settlement no longer pending")) {
    return t("shared.errors.settlementChanged");
  }

  if (rawMessage.includes("commission settlement not confirmed")) {
    return t("shared.errors.settlementUnconfirmed");
  }

  if (
    rawMessage.includes("current user cannot") ||
    rawMessage.includes("row-level security") ||
    rawMessage.includes("permission denied") ||
    rawMessage.includes("not authorized") ||
    rawMessage.includes("unauthorized") ||
    rawMessage.includes("forbidden")
  ) {
    return scope === "admin"
      ? t("shared.errors.noAdminAccess")
      : t("shared.errors.noSalesmanAccess");
  }

  return t("shared.errors.unknown");
}
