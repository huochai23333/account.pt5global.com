import type { AppRole } from "@/lib/auth-routing";
import type { UserStatus } from "@/lib/user-self-service";
import type { AdminPersonRow, CustomerTypeMark } from "@/lib/admin-people-contract";
import type { Locale } from "@/lib/locale";
import { normalizeSearchText } from "@/lib/value-normalizers";
import type {
  WorkspaceBusinessAccessLabels,
} from "@/lib/workspace-business-access";
import type { WorkspaceBusinessKey } from "@/lib/workspace-config";

export type AdminPeopleRoleLabels = Record<AppRole, string>;
export type AdminPeopleStatusLabels = Record<UserStatus, string>;
export type CustomerTypeLabels = Record<CustomerTypeMark, string>;

export function getPersonDisplayName(person: AdminPersonRow, fallback: string) {
  return person.name ?? person.email ?? person.phone ?? fallback;
}

export function getPersonContact(person: AdminPersonRow, fallback: string) {
  return person.email ?? person.phone ?? fallback;
}

export function getPersonRelationSummary(
  person: AdminPersonRow,
  fallback: {
    noReferrer: string;
    noTeam: string;
  },
) {
  const referrer = person.referrer_name ?? person.referrer_email ?? fallback.noReferrer;
  const team = person.team_name ?? fallback.noTeam;

  return {
    referrer,
    team,
  };
}

export function getRoleLabel(
  role: AppRole | null,
  labels: AdminPeopleRoleLabels,
  fallback: string,
) {
  return role ? labels[role] : fallback;
}

export function getStatusLabel(
  status: UserStatus | null,
  labels: AdminPeopleStatusLabels,
  fallback: string,
) {
  return status ? labels[status] : fallback;
}

export function getCustomerTypeLabel(
  value: CustomerTypeMark | null,
  labels: CustomerTypeLabels,
  fallback: string,
) {
  return value ? labels[value] : fallback;
}

export function getWorkspaceBusinessAccessLabel(
  businesses: readonly WorkspaceBusinessKey[],
  labels: WorkspaceBusinessAccessLabels,
  fallback: string,
) {
  if (businesses.length === 0) {
    return fallback;
  }

  return businesses.map((business) => labels[business]).join(" / ");
}

export function formatPeopleDate(
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

export function personMatchesSearch(person: AdminPersonRow, searchText: string) {
  const normalizedSearch = normalizeSearchText(searchText);

  if (!normalizedSearch) {
    return true;
  }

  return [
    person.name,
    person.email,
    person.phone,
    person.city,
    person.role,
    person.status,
    person.referral_code,
    person.referrer_name,
    person.referrer_email,
    person.team_name,
    person.customer_type,
    person.customer_type_marked_by_name,
    person.private_note,
    ...person.salesman_business_boards,
    ...person.workspace_business_access,
  ].some((value) => normalizeSearchText(value).includes(normalizedSearch));
}
