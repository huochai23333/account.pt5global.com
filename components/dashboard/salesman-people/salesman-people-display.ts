import type { SalesmanCustomerRow, SalesmanCustomerType } from "@/lib/salesman-people-contract";
import type { Locale } from "@/lib/locale";
import { normalizeSearchText } from "@/lib/value-normalizers";

export type SalesmanCustomerTypeLabels = Record<SalesmanCustomerType, string>;

export function getSalesmanCustomerName(
  customer: SalesmanCustomerRow,
  fallback: string,
) {
  return customer.name ?? customer.email ?? customer.phone ?? fallback;
}

export function getSalesmanCustomerContact(
  customer: SalesmanCustomerRow,
  fallback: string,
) {
  return customer.email ?? customer.phone ?? fallback;
}

export function getSalesmanCustomerTypeLabel(
  value: SalesmanCustomerType | null,
  labels: SalesmanCustomerTypeLabels,
  fallback: string,
) {
  return value ? labels[value] : fallback;
}

export function formatSalesmanPeopleDate(
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
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Shanghai",
  }).format(date);
}

export function salesmanCustomerMatchesSearch(
  customer: SalesmanCustomerRow,
  searchText: string,
) {
  const normalizedSearch = normalizeSearchText(searchText);

  if (!normalizedSearch) {
    return true;
  }

  return [
    customer.name,
    customer.email,
    customer.phone,
    customer.city,
    customer.status,
    customer.customer_type,
    customer.private_note,
  ].some((value) => normalizeSearchText(value).includes(normalizedSearch));
}
