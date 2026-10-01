import type {
  BusinessVipAdjustmentAction,
  BusinessVipMembershipAction,
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

export type BusinessVipOperationRecord = {
  actorName: string | null;
  amount: number | null;
  createdAt: string | null;
  currency: string | null;
  customerLabel: string;
  id: string;
  kind: BusinessVipAdjustmentAction | BusinessVipMembershipAction;
  nextExpiresAt: string | null;
  note: string | null;
  previousExpiresAt: string | null;
};

export type BusinessVipMembershipRecord = {
  actorName: string | null;
  amount: number | null;
  createdAt: string | null;
  currency: string | null;
  id: string;
  kind: BusinessVipMembershipAction;
  nextExpiresAt: string | null;
  note: string | null;
  previousExpiresAt: string | null;
};

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

export function getBusinessVipOperationRecords(
  rows: readonly BusinessVipRow[],
): BusinessVipOperationRecord[] {
  return rows
    .flatMap((row) => [
      ...row.rechargeRecords.flatMap((record) =>
        record.operationType
          ? [
              {
                actorName: record.confirmedByName,
                amount: record.amount,
                createdAt: record.confirmedAt,
                currency: record.currency,
                customerLabel: row.customerLabel,
                id: `recharge:${record.id}`,
                kind: record.operationType,
                nextExpiresAt: record.nextExpiresAt,
                note: record.note,
                previousExpiresAt: record.previousExpiresAt,
              } satisfies BusinessVipOperationRecord,
            ]
          : [],
      ),
      ...row.adjustments.map(
        (adjustment) =>
          ({
            actorName: adjustment.createdByName,
            // 手动调整没有收费动作，金额字段保持为空，便于记录列表统一渲染。
            amount: null,
            createdAt: adjustment.createdAt,
            currency: null,
            customerLabel: row.customerLabel,
            id: `adjustment:${adjustment.id}`,
            kind: adjustment.action,
            nextExpiresAt: adjustment.nextExpiresAt,
            note: adjustment.note,
            previousExpiresAt: adjustment.previousExpiresAt,
          }) satisfies BusinessVipOperationRecord,
      ),
    ])
    .sort((left, right) => {
      const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
      const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;

      // 同一时刻的记录用唯一编号固定次序，翻页和刷新后不会交换位置。
      return rightTime - leftTime || right.id.localeCompare(left.id);
    });
}

export function getBusinessVipMembershipRecords(
  row: BusinessVipRow,
): BusinessVipMembershipRecord[] {
  // 客户弹窗只展示开通和续费，取消或手动调整仍保留在页面下方的总操作记录里。
  return row.rechargeRecords
    .flatMap((record) =>
      record.operationType
        ? [
            {
              actorName: record.confirmedByName,
              amount: record.amount,
              createdAt: record.confirmedAt,
              currency: record.currency,
              id: record.id,
              kind: record.operationType,
              nextExpiresAt: record.nextExpiresAt,
              note: record.note,
              previousExpiresAt: record.previousExpiresAt,
            } satisfies BusinessVipMembershipRecord,
          ]
        : [],
    )
    .sort((left, right) => {
      const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
      const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;

      return rightTime - leftTime;
    });
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
