import type {
  BusinessVipRechargeRecord,
  BusinessVipRow,
  BusinessVipStatus,
} from "@/lib/business-vip-management";
import type { Locale } from "@/lib/locale";

export type BusinessVipStatusFilter = BusinessVipStatus | "all";

export const BUSINESS_VIP_STATUS_FILTERS = [
  "all",
  "active",
  "expired",
  "cancelled",
  "none",
] as const satisfies readonly BusinessVipStatusFilter[];

export function businessVipRowMatchesFilters({
  row,
  searchText,
  statusFilter,
}: {
  row: BusinessVipRow;
  searchText: string;
  statusFilter: BusinessVipStatusFilter;
}) {
  const normalizedSearch = searchText.trim().toLowerCase();
  const matchesStatus =
    statusFilter === "all" ? true : row.status === statusFilter;

  if (!matchesStatus) {
    return false;
  }

  if (!normalizedSearch) {
    return true;
  }

  return [
    row.customerLabel,
    row.contactLabel,
    row.secondaryLabel,
    row.targetId,
  ]
    .filter(Boolean)
    .some((value) => value?.toLowerCase().includes(normalizedSearch));
}

export function getBusinessVipSummary(rows: readonly BusinessVipRow[]) {
  const pendingCount = rows.reduce(
    (count, row) =>
      count + row.requests.filter((request) => request.status === "pending").length,
    0,
  );

  return {
    activeCount: rows.filter((row) => row.status === "active").length,
    pendingCount,
    totalCount: rows.length,
  };
}

export function formatBusinessVipDate(
  value: string | null | undefined,
  locale: Locale,
  fallback: string,
) {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatBusinessVipMoney(
  record: BusinessVipRechargeRecord,
  fallback: string,
) {
  return formatBusinessVipAmount(record.amount, record.currency, fallback);
}

export function formatBusinessVipAmount(
  amount: number | null | undefined,
  currency: string | null | undefined,
  fallback: string,
) {
  if (amount === null || amount === undefined) {
    return fallback;
  }

  const currencyLabel = currency ?? "USD";

  return `${amount.toFixed(2)} ${currencyLabel}`;
}

export function getBusinessVipDateTimeInputValue(
  value: string | null | undefined,
) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);

  return localDate.toISOString().slice(0, 16);
}

export function getBusinessVipStatusTone(status: BusinessVipStatus) {
  if (status === "active") return "success" as const;
  if (status === "expired") return "warning" as const;
  if (status === "cancelled") return "danger" as const;
  return "info" as const;
}

export function getBusinessVipRequestTone(status: string) {
  if (status === "approved") return "success" as const;
  if (status === "rejected") return "danger" as const;
  return "warning" as const;
}
