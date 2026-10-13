"use client";

import type {
  AdminOperationRecord,
  AdminOperationRecordAction,
  AdminOperationRecordCategory,
} from "@/lib/admin-operation-records";
import type { AppRole } from "@/lib/auth-routing";
import type { Locale } from "@/lib/locale";
import type { UserStatus } from "@/lib/user-self-service";
import { normalizeSearchText } from "@/lib/value-normalizers";

export type OperationCategoryLabels = Record<AdminOperationRecordCategory, string>;
export type OperationActionLabels = Record<AdminOperationRecordAction, string>;
export type OperationRoleLabels = Record<AppRole, string>;
export type OperationStatusLabels = Record<UserStatus, string>;

export function formatOperationDate(
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

export function getOperationUserLabel(
  user: AdminOperationRecord["actor"],
  fallback: string,
) {
  return user.name ?? user.email ?? fallback;
}

export function getOperationUserContact(
  user: AdminOperationRecord["actor"],
  fallback: string,
) {
  return user.email ?? fallback;
}

export function getRoleChangeLabel(
  role: AppRole | null,
  labels: OperationRoleLabels,
  fallback: string,
) {
  return role ? labels[role] : fallback;
}

export function getStatusChangeLabel(
  status: UserStatus | null,
  statusLabels: OperationStatusLabels,
  fallback: string,
) {
  if (!status) {
    return fallback;
  }

  if (status in statusLabels) {
    return statusLabels[status as UserStatus];
  }

  return fallback;
}

export function operationRecordMatchesSearch(
  record: AdminOperationRecord,
  searchText: string,
  categoryLabels: OperationCategoryLabels,
  actionLabels: OperationActionLabels,
) {
  const normalizedSearch = normalizeSearchText(searchText);

  if (!normalizedSearch) {
    return true;
  }

  return [
    categoryLabels[record.category],
    actionLabels[record.action],
    record.actor.name,
    record.actor.email,
    record.subject.name,
    record.subject.email,
    record.note,
    record.nameChange?.from,
    record.nameChange?.to,
    record.cityChange?.from,
    record.cityChange?.to,
    record.roleChange?.from,
    record.roleChange?.to,
    record.statusChange?.from,
    record.statusChange?.to,
  ].some((value) => normalizeSearchText(value).includes(normalizedSearch));
}
