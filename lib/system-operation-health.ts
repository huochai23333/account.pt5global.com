import type { SupabaseClient } from "@supabase/supabase-js";

export type SystemOperationSummary = {
  operationKey: string;
  displayName: string;
  status: string;
  attemptCount: number;
  expectedCount: number | null;
  succeededCount: number;
  failedCount: number;
  lastErrorMessage: string | null;
  createdAt: string | null;
  completedAt: string | null;
  nextAttemptAt: string | null;
};

export type SystemHealthAlert = {
  id: string;
  operationKey: string;
  status: "open" | "acknowledged";
  severity: string;
  title: string;
  message: string;
  occurrenceCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
};

export type SystemOperationHealth = {
  attentionCount: number;
  operations: SystemOperationSummary[];
  alerts: SystemHealthAlert[];
};

export const EMPTY_SYSTEM_OPERATION_HEALTH: SystemOperationHealth = {
  attentionCount: 0,
  operations: [],
  alerts: [],
};

export async function getSystemOperationHealth(
  supabase: SupabaseClient,
): Promise<SystemOperationHealth> {
  const { data, error } = await supabase.rpc("get_system_operation_health");
  if (error) throw error;
  if (!isRecord(data)) throw new Error("system_operation_health_invalid");

  return {
    attentionCount: readNumber(data.attentionCount),
    operations: Array.isArray(data.operations)
      ? data.operations.map(parseOperationSummary)
      : [],
    alerts: Array.isArray(data.alerts) ? data.alerts.map(parseAlert) : [],
  };
}

export async function acknowledgeSystemHealthAlert(
  supabase: SupabaseClient,
  alertId: string,
) {
  const { data, error } = await supabase.rpc("acknowledge_system_health_alert", {
    p_alert_id: alertId,
  });
  if (error) throw error;
  if (!isRecord(data) || data.id !== alertId || data.status !== "acknowledged") {
    throw new Error("system_health_acknowledgement_invalid");
  }
}

function parseOperationSummary(value: unknown): SystemOperationSummary {
  if (!isRecord(value)) throw new Error("system_operation_summary_invalid");
  return {
    operationKey: readString(value.operationKey),
    displayName: readString(value.displayName),
    status: readString(value.status),
    attemptCount: readNumber(value.attemptCount),
    expectedCount: value.expectedCount === null ? null : readNumber(value.expectedCount),
    succeededCount: readNumber(value.succeededCount),
    failedCount: readNumber(value.failedCount),
    lastErrorMessage: readOptionalString(value.lastErrorMessage),
    createdAt: readOptionalString(value.createdAt),
    completedAt: readOptionalString(value.completedAt),
    nextAttemptAt: readOptionalString(value.nextAttemptAt),
  };
}

function parseAlert(value: unknown): SystemHealthAlert {
  if (!isRecord(value)) throw new Error("system_health_alert_invalid");
  const status = readString(value.status);
  if (status !== "open" && status !== "acknowledged") {
    throw new Error("system_health_alert_status_invalid");
  }
  return {
    id: readString(value.id),
    operationKey: readString(value.operationKey),
    status,
    severity: readString(value.severity),
    title: readString(value.title),
    message: readString(value.message),
    occurrenceCount: readNumber(value.occurrenceCount),
    firstSeenAt: readString(value.firstSeenAt),
    lastSeenAt: readString(value.lastSeenAt),
  };
}

function readString(value: unknown) {
  if (typeof value !== "string" || !value.trim()) throw new Error("system_health_value_invalid");
  return value;
}

function readOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function readNumber(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) throw new Error("system_health_number_invalid");
  return number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
