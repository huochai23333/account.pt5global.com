"use client";

import type { ReactNode } from "react";
import { memo } from "react";
import Link from "next/link";
import { History, LoaderCircle, PencilLine, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { companyExchangeRate } from "@/lib/company-exchange-rate";
import { useLocale } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { MetaGrid, MetaItem, RecordCard } from "@/components/ui/data-display";
import * as FormControls from "@/components/ui/form-controls";
import { ResponsiveDataView } from "@/components/ui/responsive-data-view";
import {
  getExchangeRateSourceKind,
  normalizeCurrencyCode,
  type ExchangeRateRow,
} from "@/lib/exchange-rates";
import { DashboardPaginationFooter } from "../dashboard-collection-section";
import { DashboardResourceFilterSection } from "../dashboard-resource-filter-section";
import {
  DashboardFilterField,
  DashboardListSection,
  DashboardTableFrame,
  dashboardFilterInputClassName,
} from "../dashboard-section-panel";
import { EmptyState } from "../dashboard-shared-ui";

import {
  formatExchangeRateDate,
  formatExchangeRateValue,
  formatExchangeRateQuoteTime,
} from "./exchange-rates-utils";

type PaginationState = {
  endIndex: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  onNextPage: () => void;
  onPreviousPage: () => void;
  page: number;
  pageCount: number;
  startIndex: number;
  totalItems: number;
};

type ExchangeRatesHistorySectionProps = {
  canManage: boolean;
  deletePendingId: string | null;
  filteredRowsCount: number;
  filters: { originalCurrency: string; targetCurrency: string };
  hasActiveFilters: boolean;
  homeHref: string;
  onClearFilters: () => void;
  onDeleteRow: (row: ExchangeRateRow) => void;
  onEditRow: (row: ExchangeRateRow) => void;
  onOriginalCurrencyChange: (value: string) => void;
  onTargetCurrencyChange: (value: string) => void;
  pagination: PaginationState;
  rows: ExchangeRateRow[];
  showBackLink?: boolean;
  totalRates: number;
};

export const ExchangeRatesHistorySection = memo(
  function ExchangeRatesHistorySection({
    canManage,
    deletePendingId,
    filteredRowsCount,
    filters,
    hasActiveFilters,
    homeHref,
    onClearFilters,
    onDeleteRow,
    onEditRow,
    onOriginalCurrencyChange,
    onTargetCurrencyChange,
    pagination,
    rows,
    showBackLink = true,
    totalRates,
  }: ExchangeRatesHistorySectionProps) {
    const t = useTranslations("ExchangeRates");
    const { locale } = useLocale();
    const footer = (
      <DashboardPaginationFooter
        endIndex={pagination.endIndex}
        hasNextPage={pagination.hasNextPage}
        hasPreviousPage={pagination.hasPreviousPage}
        onNextPage={pagination.onNextPage}
        onPreviousPage={pagination.onPreviousPage}
        page={pagination.page}
        pageCount={pagination.pageCount}
        startIndex={pagination.startIndex}
        totalItems={pagination.totalItems}
      />
    );

    return (
      <DashboardListSection
        actions={
          showBackLink ? (
            <Link
              className="inline-flex h-9 items-center justify-center rounded-full border border-border-subtle bg-surface-interactive px-4 text-sm font-medium text-content-muted transition-colors hover:bg-surface-inset"
              href={homeHref}
            >
              {t("history.backHome")}
            </Link>
          ) : null
        }
        bodyClassName="flex flex-col gap-5"
        eyebrow={t("history.eyebrow")}
        title={t("history.title")}
      >
        <DashboardResourceFilterSection
          activeFilterCount={[
            Boolean(filters.originalCurrency),
            Boolean(filters.targetCurrency),
          ].filter(Boolean).length}
          gridClassName="sm:grid-cols-2"
          onReset={onClearFilters}
          primary={
            <DashboardFilterField label={t("filters.originalCurrencyLabel")}>
              <FormControls.Input
                className={dashboardFilterInputClassName}
                onChange={(event) => onOriginalCurrencyChange(event.target.value)}
                placeholder={t("filters.originalCurrencyPlaceholder")}
                type="text"
                value={filters.originalCurrency}
              />
            </DashboardFilterField>
          }
          resetDisabled={!hasActiveFilters}
          resetLabel={t("filters.clear")}
          summary={t("filters.resultSummary", {
            matched: filteredRowsCount,
            total: totalRates,
          })}
        >
          <DashboardFilterField label={t("filters.targetCurrencyLabel")}>
            <FormControls.Input
              className={dashboardFilterInputClassName}
              onChange={(event) => onTargetCurrencyChange(event.target.value)}
              placeholder={t("filters.targetCurrencyPlaceholder")}
              type="text"
              value={filters.targetCurrency}
            />
          </DashboardFilterField>
        </DashboardResourceFilterSection>

        {filteredRowsCount === 0 ? (
          <EmptyState
            description={
              totalRates === 0
                ? t("history.emptyDescription")
                : t("history.noMatchDescription")
            }
            icon={<History className="size-6" />}
            title={
              totalRates === 0
                ? t("history.emptyTitle")
                : t("history.noMatchTitle")
            }
          />
        ) : (
          <ResponsiveDataView
            desktop={
              <HistoryDesktopTable
                canManage={canManage}
                deletePendingId={deletePendingId}
                locale={locale}
                onDeleteRow={onDeleteRow}
                onEditRow={onEditRow}
                rows={rows}
              />
            }
            footer={footer}
            mobile={rows.map((row) => (
              <HistoryMobileCard
                canManage={canManage}
                deleting={deletePendingId === row.id}
                key={row.id}
                locale={locale}
                onDeleteRow={onDeleteRow}
                onEditRow={onEditRow}
                row={row}
              />
            ))}
          />
        )}
      </DashboardListSection>
    );
  },
);

function HistoryDesktopTable({
  canManage,
  deletePendingId,
  locale,
  onDeleteRow,
  onEditRow,
  rows,
}: {
  canManage: boolean;
  deletePendingId: string | null;
  locale: "en" | "zh";
  onDeleteRow: (row: ExchangeRateRow) => void;
  onEditRow: (row: ExchangeRateRow) => void;
  rows: ExchangeRateRow[];
}) {
  const t = useTranslations("ExchangeRates");

  return (
    <DashboardTableFrame>
      {/* 固定按容器分配列宽，时间和操作可换行；新增成交价列不能把右侧内容挤出面板。 */}
      <table className="w-full table-fixed border-collapse">
        <thead className="bg-surface-inset">
          <tr className="border-b border-border-subtle">
            <HistoryHeaderCell>{t("history.columns.originalCurrency")}</HistoryHeaderCell>
            <HistoryHeaderCell>{t("history.columns.targetCurrency")}</HistoryHeaderCell>
            <HistoryHeaderCell>{t("history.columns.rate")}</HistoryHeaderCell>
            <HistoryHeaderCell>{t("companyRate")}</HistoryHeaderCell>
            <HistoryHeaderCell>{t("history.columns.rateDate")}</HistoryHeaderCell>
            <HistoryHeaderCell>{t("history.columns.source")}</HistoryHeaderCell>
            <HistoryHeaderCell>{t("history.columns.updatedAt")}</HistoryHeaderCell>
            {canManage ? (
              <HistoryHeaderCell>{t("history.columns.actions")}</HistoryHeaderCell>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              className="border-b border-border-subtle transition-colors hover:bg-surface-inset last:border-b-0"
              key={row.id}
            >
              <HistoryValueCell value={normalizeCurrencyCode(row.original_currency)} />
              <HistoryValueCell value={normalizeCurrencyCode(row.target_currency)} />
              <HistoryValueCell
                value={formatExchangeRateValue(
                  row.daily_exchange_rate,
                  locale,
                  t("summary.noRecord"),
                )}
              />
              <HistoryValueCell value={formatExchangeRateValue(companyExchangeRate(row.original_currency, row.daily_exchange_rate), locale)} />
              <HistoryValueCell
                value={formatExchangeRateDate(row.rate_date, locale, t("summary.noRecord"))}
              />
              <HistoryValueCell value={t(`history.sources.${getExchangeRateSourceKind(row.source)}`)} />
              <HistoryValueCell value={formatExchangeRateQuoteTime(row.provider_updated_at, locale)} />
              {canManage ? (
                <td className="px-3 py-4">
                  <HistoryActions
                    deleting={deletePendingId === row.id}
                    onDelete={() => onDeleteRow(row)}
                    onEdit={() => onEditRow(row)}
                  />
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </DashboardTableFrame>
  );
}

function HistoryMobileCard({
  canManage,
  deleting,
  locale,
  onDeleteRow,
  onEditRow,
  row,
}: {
  canManage: boolean;
  deleting: boolean;
  locale: "en" | "zh";
  onDeleteRow: (row: ExchangeRateRow) => void;
  onEditRow: (row: ExchangeRateRow) => void;
  row: ExchangeRateRow;
}) {
  const t = useTranslations("ExchangeRates");
  const pairLabel = `${normalizeCurrencyCode(row.original_currency)}/${normalizeCurrencyCode(row.target_currency)}`;

  return (
    <RecordCard surface="inset">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <h3 className="min-w-0 break-words text-base font-semibold text-content-strong">
          {pairLabel}
        </h3>
        <p className="shrink-0 text-lg font-bold text-content-strong">
          {formatExchangeRateValue(row.daily_exchange_rate, locale, t("summary.noRecord"))}
        </p>
      </div>
      <MetaGrid className="mt-4 grid-cols-2">
        <MetaItem label={t("companyRate")}>{formatExchangeRateValue(companyExchangeRate(row.original_currency, row.daily_exchange_rate), locale)}</MetaItem>
        <MetaItem label={t("history.columns.rateDate")}>
          {formatExchangeRateDate(row.rate_date, locale, t("summary.noRecord"))}
        </MetaItem>
        <MetaItem label={t("history.columns.source")}>
          {t(`history.sources.${getExchangeRateSourceKind(row.source)}`)}
        </MetaItem>
        <MetaItem className="col-span-2" label={t("history.columns.updatedAt")}>
          {formatExchangeRateQuoteTime(row.provider_updated_at, locale)}
        </MetaItem>
      </MetaGrid>
      {canManage ? (
        <div className="mt-4">
          <HistoryActions
            deleting={deleting}
            onDelete={() => onDeleteRow(row)}
            onEdit={() => onEditRow(row)}
          />
        </div>
      ) : null}
    </RecordCard>
  );
}

function HistoryActions({
  deleting,
  onDelete,
  onEdit,
}: {
  deleting: boolean;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const t = useTranslations("ExchangeRates");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={onEdit} size="compact" type="button" variant="outline">
        <PencilLine className="size-3.5" />
        {t("actions.edit")}
      </Button>
      <Button
        disabled={deleting}
        onClick={onDelete}
        size="compact"
        type="button"
        variant="danger"
      >
        {deleting ? (
          <LoaderCircle className="size-3.5 animate-spin" />
        ) : (
          <Trash2 className="size-3.5" />
        )}
        {t("actions.delete")}
      </Button>
    </div>
  );
}

function HistoryHeaderCell({ children }: { children: ReactNode }) {
  return (
    <th className="px-3 py-4 text-left text-xs font-semibold text-content-muted">
      {children}
    </th>
  );
}

function HistoryValueCell({ value }: { value: ReactNode }) {
  return <td className="break-words px-3 py-4 text-sm text-content-muted">{value}</td>;
}
