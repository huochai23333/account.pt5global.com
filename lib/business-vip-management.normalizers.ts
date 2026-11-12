import type {
  BusinessVipAdjustment,
  BusinessVipAdjustmentAction,
  BusinessVipMembershipAction,
  BusinessVipRechargeRecord,
  BusinessVipRequest,
  BusinessVipRequestStatus,
  BusinessVipRow,
  BusinessVipStatus,
} from "./business-vip-management.types";

export type TourismVipRpcRow = {
  customer_user_id?: unknown;
  customer_name?: unknown;
  customer_email?: unknown;
  customer_phone?: unknown;
  customer_city?: unknown;
  membership_status?: unknown;
  started_at?: unknown;
  expires_at?: unknown;
  latest_paid_order_number?: unknown;
  latest_paid_order_completed_at?: unknown;
  requests?: unknown;
  recharge_orders?: unknown;
  adjustments?: unknown;
};

export type WholesaleVipRpcRow = {
  customer_id?: unknown;
  unique_name?: unknown;
  contact_details?: unknown;
  source?: unknown;
  notes?: unknown;
  membership_status?: unknown;
  level_name?: unknown;
  started_at?: unknown;
  expires_at?: unknown;
  requests?: unknown;
  recharge_records?: unknown;
  adjustments?: unknown;
};

// RPC payloads are normalized at the boundary so components never receive partial rows.
export function normalizeTourismVipRow(row: TourismVipRpcRow): BusinessVipRow[] {
  const targetId = normalizeString(row.customer_user_id);

  if (!targetId) {
    return [];
  }

  const name = normalizeString(row.customer_name);
  const email = normalizeString(row.customer_email);
  const phone = normalizeString(row.customer_phone);
  const city = normalizeString(row.customer_city);
  const orderNumber = normalizeString(row.latest_paid_order_number);

  return [
    {
      adjustments: normalizeAdjustments(row.adjustments),
      business: "tourism",
      contactLabel: phone ?? email,
      customerLabel: name ?? email ?? phone ?? "未命名客户",
      expiresAt: normalizeString(row.expires_at),
      latestPaidAt: normalizeString(row.latest_paid_order_completed_at),
      requests: normalizeRequests(row.requests),
      rechargeRecords: normalizeRechargeRecords(row.recharge_orders, orderNumber),
      secondaryLabel: city,
      startedAt: normalizeString(row.started_at),
      status: normalizeVipStatus(row.membership_status),
      targetId,
    },
  ];
}

export function normalizeWholesaleVipRow(row: WholesaleVipRpcRow): BusinessVipRow[] {
  const targetId = normalizeString(row.customer_id);

  if (!targetId) {
    return [];
  }

  const name = normalizeString(row.unique_name);
  const contact = normalizeString(row.contact_details);
  const source = normalizeString(row.source);

  return [
    {
      adjustments: normalizeAdjustments(row.adjustments),
      business: "wholesale",
      // 空值保留给页面翻译，数据层不提前选定界面语言。
      contactLabel: contact,
      customerLabel: name ?? "未命名批发客户",
      expiresAt: normalizeString(row.expires_at),
      latestPaidAt: getLatestRechargeAt(row.recharge_records),
      requests: normalizeRequests(row.requests),
      rechargeRecords: normalizeRechargeRecords(row.recharge_records),
      secondaryLabel: source,
      startedAt: normalizeString(row.started_at),
      status: normalizeVipStatus(row.membership_status),
      targetId,
    },
  ];
}

export function normalizeAdjustmentAction(
  value: unknown,
): BusinessVipAdjustmentAction {
  const action = normalizeMaybeAdjustmentAction(value);

  if (!action) {
    throw new Error("business_vip_adjustment_invalid_input");
  }

  return action;
}

export function normalizeDateTimeInput(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function normalizeNote(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, 500)
    : null;
}

export function normalizeRequiredId(value: unknown) {
  const id = normalizeString(value);

  if (!id) {
    throw new Error("business_vip_invalid_input");
  }

  return id;
}

function normalizeRequests(value: unknown): BusinessVipRequest[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    const id = normalizeString(item.id);

    if (!id) {
      return [];
    }

    return [
      {
        createdAt: normalizeString(item.created_at),
        id,
        note: normalizeString(item.note),
        processedAt: normalizeString(item.processed_at),
        requestedByEmail: normalizeString(item.requested_by_email),
        requestedByName: normalizeString(item.requested_by_name),
        reviewNote: normalizeString(item.review_note),
        status: normalizeRequestStatus(item.status),
      },
    ];
  });
}

function normalizeRechargeRecords(
  value: unknown,
  fallbackOrderNumber: string | null = null,
): BusinessVipRechargeRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    const id = normalizeString(item.id);

    if (!id) {
      return [];
    }

    return [
      {
        amount: normalizeNumber(item.amount),
        confirmedByName: normalizeString(item.confirmed_by_name),
        confirmedAt:
          normalizeString(item.confirmed_at) ??
          normalizeString(item.completed_at) ??
          normalizeString(item.created_at),
        currency: normalizeString(item.currency),
        id,
        nextExpiresAt: normalizeString(item.next_expires_at),
        note: normalizeString(item.note),
        operationType: normalizeMaybeMembershipAction(item.operation_type),
        orderNumber: normalizeString(item.order_number) ?? fallbackOrderNumber,
        previousExpiresAt: normalizeString(item.previous_expires_at),
      },
    ];
  });
}

function normalizeAdjustments(value: unknown): BusinessVipAdjustment[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    const id = normalizeString(item.id);
    const action = normalizeMaybeAdjustmentAction(item.action);

    if (!id || !action) {
      return [];
    }

    return [
      {
        action,
        createdAt: normalizeString(item.created_at),
        createdByName: normalizeString(item.created_by_name),
        id,
        nextExpiresAt: normalizeString(item.next_expires_at),
        nextStatus: normalizeVipStatus(item.next_status),
        note: normalizeString(item.note),
        previousExpiresAt: normalizeString(item.previous_expires_at),
        previousStatus: normalizeMaybeVipStatus(item.previous_status),
      },
    ];
  });
}

function getLatestRechargeAt(value: unknown) {
  const [latest] = normalizeRechargeRecords(value);
  return latest?.confirmedAt ?? null;
}

function normalizeVipStatus(value: unknown): BusinessVipStatus {
  return normalizeMaybeVipStatus(value) ?? "none";
}

function normalizeMaybeVipStatus(value: unknown): BusinessVipStatus | null {
  if (value === "active" || value === "expired" || value === "cancelled") {
    return value;
  }

  return null;
}

function normalizeRequestStatus(value: unknown): BusinessVipRequestStatus {
  if (value === "approved" || value === "rejected") {
    return value;
  }

  return "pending";
}

function normalizeMaybeAdjustmentAction(
  value: unknown,
): BusinessVipAdjustmentAction | null {
  return value === "set_expires_at" || value === "cancel" ? value : null;
}

function normalizeMaybeMembershipAction(
  value: unknown,
): BusinessVipMembershipAction | null {
  return value === "open" || value === "renew" ? value : null;
}

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const numberValue = Number(value);

    return Number.isFinite(numberValue) ? numberValue : null;
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
