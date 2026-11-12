"use client";

import type { AdminPersonRow } from "@/lib/admin-people-contract";
import type { Locale } from "@/lib/locale";
import { normalizeSearchText } from "@/lib/value-normalizers";

export type TourismPeopleTab = "customers" | "promoters";

export function isTourismCustomer(person: AdminPersonRow) {
  return (
    person.role === "client" &&
    person.workspace_business_access.includes("tourism")
  );
}

export function isTourismPromoter(person: AdminPersonRow) {
  return person.role === "promoter";
}

/** 人员与客户目录先由调用方限定角色，再共用相同的检索字段和状态筛选。 */
export function filterTourismPeople(people: AdminPersonRow[], searchText: string, statusFilter: string) {
  const searchValue = normalizeSearchText(searchText);
  return people.filter((person) => {
    if (statusFilter !== "all" && person.status !== statusFilter) return false;
    if (!searchValue) return true;

    return [
      person.name, person.email, person.phone, person.city, person.referral_code,
      person.referrer_name, person.referrer_email, person.team_name,
    ].some((value) => normalizeSearchText(value).includes(searchValue));
  });
}

export function getTourismPersonName(person: AdminPersonRow, fallback: string) {
  return person.name?.trim() || person.email?.trim() || fallback;
}

export function getTourismPersonContact(
  person: AdminPersonRow,
  fallback: string,
) {
  return [person.email, person.phone].filter(Boolean).join(" / ") || fallback;
}

export function formatTourismPeopleDate(
  value: string | null,
  locale: Locale,
  fallback: string,
) {
  if (!value) return fallback;

  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return fallback;
  }
}
