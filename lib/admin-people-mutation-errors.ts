export type AdminPeopleUpdateErrorCode =
  | "forbidden"
  | "invalidInput"
  | "lastAdmin"
  | "noChange"
  | "conflict"
  | "notFound"
  | "selfChange"
  | "serviceUnavailable"
  | "unknown";

export class AdminPeopleMutationError extends Error {
  readonly code: AdminPeopleUpdateErrorCode;

  constructor(code: AdminPeopleUpdateErrorCode) {
    super(code);
    this.code = code;
  }
}

export function getAdminPeopleUpdateErrorCode(
  error: unknown,
): AdminPeopleUpdateErrorCode {
  if (error instanceof AdminPeopleMutationError) return error.code;
  const message = getRawErrorMessage(error).toLowerCase();

  if (
    message.includes("admin_people_forbidden") ||
    message.includes("permission") ||
    message.includes("forbidden") ||
    message.includes("unauthorized")
  ) {
    return "forbidden";
  }
  if (message.includes("admin_people_self_change_not_allowed")) {
    return "selfChange";
  }
  if (message.includes("admin_people_last_admin_not_allowed")) {
    return "lastAdmin";
  }
  if (message.includes("admin_people_target_not_found")) return "notFound";
  if (message.includes("admin_people_no_change")) return "noChange";
  if (message.includes("admin_people_conflict")) return "conflict";
  if (
    message.includes("admin_people_invalid_input") ||
    message.includes("admin_people_invalid_business_access") ||
    message.includes("admin_people_invalid_workspace_business_access") ||
    message.includes("admin_people_business_access_requires_salesman") ||
    message.includes("admin_people_customer_type_requires_client") ||
    message.includes("admin_people_role_not_found") ||
    message.includes("invalid input")
  ) {
    return "invalidInput";
  }
  if (
    message.includes("supabase_service_role_key") ||
    message.includes("failed to fetch") ||
    message.includes("fetch failed") ||
    message.includes("timed out") ||
    message.includes("timeout")
  ) {
    return "serviceUnavailable";
  }
  return "unknown";
}

function getRawErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "message" in error) {
    return String(error.message).trim();
  }
  return error instanceof Error ? error.message : "";
}
