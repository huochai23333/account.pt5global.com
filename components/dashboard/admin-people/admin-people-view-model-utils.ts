import {
  isAdminPeopleRole,
  isAdminPeopleStatus,
  isCustomerTypeMark,
  type AdminPeopleChangeLogRow,
  type AdminPersonRow,
} from "@/lib/admin-people";

export type AdminPeopleFeedback = {
  tone: "error" | "success" | "info";
  message: string;
};

export type AdminPeopleUpdateResponse = {
  person?: AdminPersonRow;
  recentChanges?: AdminPeopleChangeLogRow[];
  outcome?: "success" | "partial_failed";
  error?: string;
};

export async function readAdminPeopleUpdateResponse(
  response: Response,
): Promise<AdminPeopleUpdateResponse> {
  try {
    const value: unknown = await response.json();

    if (!isRecord(value)) {
      return {};
    }

    return {
      error: typeof value.error === "string" ? value.error : undefined,
      person: isAdminPersonRow(value.person) ? value.person : undefined,
      recentChanges: normalizeChangeLogs(value.recentChanges),
      outcome: value.outcome === "success" || value.outcome === "partial_failed" ? value.outcome : undefined,
    };
  } catch {
    return {};
  }
}

export function normalizeAdminPeopleErrorCode(value: string | undefined) {
  switch (value) {
    case "forbidden":
    case "invalidInput":
    case "lastAdmin":
    case "noChange":
    case "conflict":
    case "notFound":
    case "processed":
    case "selfChange":
    case "serviceUnavailable":
      return value;
    default:
      return "unknown";
  }
}

function normalizeChangeLogs(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.filter(isAdminPeopleChangeLogRow);
}

function isAdminPersonRow(value: unknown): value is AdminPersonRow {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.user_id === "string" &&
    (value.role === null || isAdminPeopleRole(value.role)) &&
    isAdminPeopleStatus(value.status) &&
    typeof value.created_at === "string" &&
    (value.customer_type === null || isCustomerTypeMark(value.customer_type))
  );
}

function isAdminPeopleChangeLogRow(
  value: unknown,
): value is AdminPeopleChangeLogRow {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.target_user_id === "string" &&
    (value.next_role === null || isAdminPeopleRole(value.next_role)) &&
    isAdminPeopleStatus(value.next_status) &&
    typeof value.created_at === "string"
  );
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
