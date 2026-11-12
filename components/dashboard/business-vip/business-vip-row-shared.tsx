"use client";

import { useTranslations } from "next-intl";
import { StatusBadge } from "@/components/ui/status-badge";

import type { BusinessVipRow } from "@/lib/business-vip-management";
import type { Locale } from "@/lib/locale";

import {
  formatBusinessVipDate,
  getBusinessVipStatusTone,
} from "./business-vip-display";

export function BusinessVipCustomerCell({ row }: { row: BusinessVipRow }) {
  const t = useTranslations("BusinessVip");
  return (
    <div className="min-w-0">
      <p className="break-words font-semibold text-content-strong [overflow-wrap:anywhere]">
        {row.customerLabel}
      </p>
      <p className="mt-1 break-words text-xs leading-5 text-content-muted [overflow-wrap:anywhere]">
        {row.contactLabel ?? t("fallback.noContact")}
      </p>
      {row.secondaryLabel ? (
        <p className="mt-1 break-words text-xs leading-5 text-content-subtle [overflow-wrap:anywhere]">
          {row.secondaryLabel}
        </p>
      ) : null}
    </div>
  );
}

export function BusinessVipStatusBlock({
  locale,
  row,
}: {
  locale: Locale;
  row: BusinessVipRow;
}) {
  const t = useTranslations("BusinessVip");
  const fallback = t("fallback.noRecord");

  return (
    <div className="flex min-w-0 flex-col items-start gap-2">
      <BusinessVipStatusChip status={row.status} />
      {row.business === "wholesale" ? (
        <p className="text-xs leading-5 text-content-muted">
          {t("status.startedAt", {
            value: formatBusinessVipDate(row.startedAt, locale, fallback),
          })}
        </p>
      ) : null}
      <p className="text-xs leading-5 text-content-muted">
        {t("status.expiresAt", {
          value: formatBusinessVipDate(row.expiresAt, locale, fallback),
        })}
      </p>
      {row.business === "tourism" ? (
        <p className="text-xs leading-5 text-content-subtle">
          {t("status.latestPaidAt", {
            value: formatBusinessVipDate(row.latestPaidAt, locale, fallback),
          })}
        </p>
      ) : null}
    </div>
  );
}

export function BusinessVipStatusChip({
  status,
}: {
  status: BusinessVipRow["status"];
}) {
  const t = useTranslations("BusinessVip");

  return (
    <StatusBadge size="md" tone={getBusinessVipStatusTone(status)}>
      {t(`status.labels.${status}`)}
    </StatusBadge>
  );
}
