"use client";

import { DashboardPagedRecords } from "@/components/dashboard/dashboard-paged-records";

import {
  CalendarClock,
  CircleDollarSign,
  Clock3,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  getCustomerInventoryDueState,
  type CustomerInventoryCreditTier,
  type CustomerInventoryDueState,
  type CustomerInventoryPageData,
} from "@/lib/customer-inventory-types";

import { CustomerInventoryCreditCard } from "./customer-inventory-credit-card";
import { CustomerInventoryCreditFilters } from "./customer-inventory-credit-filters";
import type { InventoryCreditDialogState } from "./customer-inventory-credit-dialogs";
import { CustomerInventoryFilterEmptyState } from "./customer-inventory-filter-empty-state";
import { useCustomerInventoryCreditFilters } from "./use-customer-inventory-credit-filters";
import {
  WholesaleEmptyState,
  WholesalePanel,
  WholesaleStatGrid,
} from "../wholesale/wholesale-ui";

export function CustomerInventoryCreditSection({
  canManageCredit,
  data,
  isClient,
  onDialog,
}: {
  canManageCredit: boolean;
  data: CustomerInventoryPageData;
  isClient: boolean;
  onDialog: (dialog: InventoryCreditDialogState) => void;
}) {
  const t = useTranslations("CustomerInventory");
  const tierLabels = {
    all_orders_5: t("tiers.all_orders_5"),
    fixed_200_usd: t("tiers.fixed_200_usd"),
    single_order_50: t("tiers.single_order_50"),
  } satisfies Record<CustomerInventoryCreditTier, string>;
  const {
    activeFilterCount,
    clearFilters,
    filteredCredits,
    filters,
    setFilter,
  } = useCustomerInventoryCreditFilters({ data, tierLabels });
  const pendingOrders = data.orders.filter((order) =>
    data.credits.some(
      (credit) => credit.order_id === order.id && credit.status === "pending",
    ),
  );
  const pendingExtensions = data.extensions.filter(
    (extension) => extension.status === "pending",
  );
  // 信贷申请与延期申请合并为一份待审记录，每页合计最多二十项。
  const reviewItems = [
    ...pendingOrders.map((order) => ({ id: order.id, order, extension: null })),
    ...pendingExtensions.map((extension) => ({ id: extension.id, order: null, extension })),
  ];
  const activeCredits = data.credits.filter(
    (credit) => credit.status === "active",
  );
  const dueCounts = activeCredits.reduce((counts, credit) => {
    const state = getCustomerInventoryDueState(
      credit,
      data.currentBusinessDate,
    );
    counts[state] += 1;
    return counts;
  }, createDueCounts());

  return (
    <div className="grid min-w-0 gap-4 sm:gap-6">
      {canManageCredit ? (
        <WholesaleStatGrid
          stats={[
            {
              icon: <ShieldCheck className="size-5" />,
              label: t("creditStats.pendingCredit"),
              value: String(pendingOrders.length),
            },
            {
              icon: <CalendarClock className="size-5" />,
              label: t("creditStats.pendingExtension"),
              value: String(pendingExtensions.length),
            },
            {
              icon: <Clock3 className="size-5" />,
              label: t("creditStats.withinSevenDays"),
              tone: "warning",
              value: String(dueCounts.due_within_7_days),
            },
            {
              icon: <TriangleAlert className="size-5" />,
              label: t("creditStats.dueToday"),
              tone: "warning",
              value: String(dueCounts.due_today),
            },
            {
              icon: <TriangleAlert className="size-5" />,
              label: t("creditStats.overdue"),
              tone: "warning",
              value: String(dueCounts.overdue),
            },
          ]}
        />
      ) : null}

      {canManageCredit &&
      (pendingOrders.length > 0 || pendingExtensions.length > 0) ? (
        <WholesalePanel
          description={t("reviews.description")}
          title={t("reviews.title")}
        >
          <DashboardPagedRecords items={reviewItems}>{(pageRows) => (
          <div className="grid gap-3 lg:grid-cols-2">
            {pageRows.flatMap((item) => item.order ? [item.order] : []).map((order) => {
              const credits = data.credits.filter(
                (credit) =>
                  credit.order_id === order.id && credit.status === "pending",
              );
              return (
                <ReviewCard
                  actionLabel={t("reviews.reviewCredit")}
                  description={t("reviews.creditSummary", {
                    count: credits.length,
                    number: order.order_number,
                  })}
                  key={order.id}
                  onClick={() => onDialog({ credits, kind: "review", order })}
                  title={t("reviews.pendingCredit")}
                />
              );
            })}
            {pageRows.flatMap((item) => item.extension ? [item.extension] : []).map((extension) => {
              const credit = data.credits.find(
                (item) => item.id === extension.credit_application_id,
              );
              if (!credit) return null;
              return (
                <ReviewCard
                  actionLabel={t("reviews.reviewExtension")}
                  description={t("reviews.extensionSummary", {
                    count: extension.extension_months,
                    tier: t(`tiers.${credit.tier}`),
                  })}
                  key={extension.id}
                  onClick={() =>
                    onDialog({
                      credit,
                      extension,
                      kind: "reviewExtension",
                    })
                  }
                  title={t("reviews.pendingExtension")}
                />
              );
            })}
          </div>
          )}</DashboardPagedRecords>
        </WholesalePanel>
      ) : null}

      <WholesalePanel
        description={t("credits.description")}
        title={t("credits.title")}
      >
        {data.credits.length > 0 ? (
          <CustomerInventoryCreditFilters
            activeFilterCount={activeFilterCount}
            data={data}
            filters={filters}
            isClient={isClient}
            onClear={clearFilters}
            onFilterChange={setFilter}
            visibleCount={filteredCredits.length}
          />
        ) : null}

        <DashboardPagedRecords items={filteredCredits}
          queryKey={JSON.stringify(filters)}>
          {(pageRows) => (
            <>
            {data.credits.length === 0 ? (
              <WholesaleEmptyState
                description={t("credits.emptyDescription")}
                icon={<CircleDollarSign className="size-5" />}
                title={t("credits.emptyTitle")}
              />
            ) : filteredCredits.length === 0 ? (
              <CustomerInventoryFilterEmptyState
                description={t("filters.noCreditResultsDescription")}
              />
            ) : (
              <div className="mt-4 grid gap-3 xl:grid-cols-2">
                {pageRows.map((credit) => (
                  <CustomerInventoryCreditCard
                    canManageCredit={canManageCredit}
                    credit={credit}
                    data={data}
                    isClient={isClient}
                    key={credit.id}
                    onDialog={onDialog}
                  />
                ))}
              </div>
            )}
            </>
          )}
        </DashboardPagedRecords>
      </WholesalePanel>
    </div>
  );
}

function ReviewCard({
  actionLabel,
  description,
  onClick,
  title,
}: {
  actionLabel: string;
  description: string;
  onClick: () => void;
  title: string;
}) {
  return (
    <article className="rounded-record-card border border-border-subtle bg-surface-interactive p-4">
      <p className="font-semibold text-content-strong">{title}</p>
      <p className="mt-2 text-sm leading-6 text-content-muted">{description}</p>
      <Button className="mt-4" onClick={onClick} type="button">
        {actionLabel}
      </Button>
    </article>
  );
}

function createDueCounts(): Record<CustomerInventoryDueState, number> {
  return {
    due_today: 0,
    due_within_7_days: 0,
    more_than_7_days: 0,
    not_started: 0,
    overdue: 0,
    repaid: 0,
  };
}
