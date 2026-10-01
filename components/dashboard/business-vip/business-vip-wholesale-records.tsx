"use client";

import { DashboardPagedRecords } from "@/components/dashboard/dashboard-paged-records";

import { FileClock } from "lucide-react";
import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { DashboardTableFrame } from "@/components/dashboard/dashboard-section-panel";
import { EmptyState } from "@/components/dashboard/dashboard-shared-ui";
import { RecordCard } from "@/components/ui/data-display";
import { ResponsiveDataView } from "@/components/ui/responsive-data-view";
import type { BusinessVipRow } from "@/lib/business-vip-management";
import type { Locale } from "@/lib/locale";

import {
  formatBusinessVipAmount,
  formatBusinessVipDate,
  getBusinessVipOperationRecords,
  type BusinessVipOperationRecord,
} from "./business-vip-display";

export function BusinessVipWholesaleRecordTable({
  locale,
  rows,
  paginationKey,
}: {
  locale: Locale;
  rows: BusinessVipRow[];
  paginationKey: string;
}) {
  const t = useTranslations("BusinessVip");
  const records = useMemo(() => getBusinessVipOperationRecords(rows), [rows]);

  if (records.length === 0) {
    return (
      <DashboardPagedRecords items={records} queryKey={paginationKey}>{() =>
      <EmptyState
        description={t("operationRecords.emptyDescription")}
        icon={<FileClock className="size-5" />}
        title={t("operationRecords.emptyTitle")}
      />
      }</DashboardPagedRecords>
    );
  }

  return (
    <DashboardPagedRecords items={records}
      queryKey={paginationKey}>
      {(pageRows) => (
        <>
        <ResponsiveDataView
          breakpoint="lg"
          desktop={
            <DashboardTableFrame innerClassName="overflow-x-visible">
              <table className="w-full table-fixed text-left text-sm">
                <colgroup>
                  <col className="w-[28%]" />
                  <col className="w-[30%]" />
                  <col className="w-[22%]" />
                  <col className="w-[20%]" />
                </colgroup>
                <thead className="bg-surface-inset text-xs font-semibold text-content-muted">
                  <tr>
                    <th className="px-4 py-3">
                      {t("operationRecords.columns.customer")}
                    </th>
                    <th className="px-4 py-3">
                      {t("operationRecords.columns.action")}
                    </th>
                    <th className="px-4 py-3">
                      {t("operationRecords.columns.time")}
                    </th>
                    <th className="px-4 py-3">
                      {t("operationRecords.columns.actor")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {pageRows.map((record) => (
                    <tr className="align-top" key={record.id}>
                      <td className="px-4 py-4">
                        <p className="break-words font-semibold text-content-strong [overflow-wrap:anywhere]">
                          {record.customerLabel}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <OperationRecordSummary locale={locale} record={record} />
                      </td>
                      <td className="px-4 py-4 text-sm text-content-muted">
                        {formatBusinessVipDate(
                          record.createdAt,
                          locale,
                          t("fallback.noRecord"),
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-content-muted">
                        {record.actorName ?? t("operationRecords.actorFallback")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DashboardTableFrame>
          }
          mobile={
            <>
              {pageRows.map((record) => (
                <RecordCard key={record.id}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <p className="break-words font-semibold text-content-strong [overflow-wrap:anywhere]">
                      {record.customerLabel}
                    </p>
                    <span className="text-xs text-content-muted">
                      {formatBusinessVipDate(
                        record.createdAt,
                        locale,
                        t("fallback.noRecord"),
                      )}
                    </span>
                  </div>
                  <div className="mt-3">
                    <OperationRecordSummary locale={locale} record={record} />
                  </div>
                  <p className="mt-3 text-sm text-content-muted">
                    {record.actorName ?? t("operationRecords.actorFallback")}
                  </p>
                </RecordCard>
              ))}
            </>
          }
        />
        </>
      )}
    </DashboardPagedRecords>
  );
}

function OperationRecordSummary({
  locale,
  record,
}: {
  locale: Locale;
  record: BusinessVipOperationRecord;
}) {
  const t = useTranslations("BusinessVip");
  const fallback = t("fallback.noRecord");

  return (
    <div className="min-w-0">
      <p className="font-semibold text-primary">
        {t(`operationRecords.types.${record.kind}`)}
      </p>
      <p className="mt-1 break-words text-xs leading-5 text-content-muted [overflow-wrap:anywhere]">
        {t("operationRecords.expiresChange", {
          next: formatBusinessVipDate(record.nextExpiresAt, locale, fallback),
          previous: formatBusinessVipDate(
            record.previousExpiresAt,
            locale,
            fallback,
          ),
        })}
      </p>
      {record.amount !== null ? (
        <p className="mt-1 break-words text-xs leading-5 text-content-muted [overflow-wrap:anywhere]">
          {t("operationRecords.annualFee", {
            amount: formatBusinessVipAmount(
              record.amount,
              record.currency,
              fallback,
            ),
          })}
        </p>
      ) : null}
      {record.note ? (
        <p className="mt-1 break-words text-xs leading-5 text-content-subtle [overflow-wrap:anywhere]">
          {record.note}
        </p>
      ) : null}
    </div>
  );
}
