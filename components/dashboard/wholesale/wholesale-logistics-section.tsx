"use client";

import { InteractiveButton as DesignButton } from "@/components/ui/button";

import { Settings2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import {
  DashboardOrderListSection,
  DashboardOrderPaginationActions,
} from "@/components/dashboard/dashboard-order-list-section";
import { FeedbackNotice } from "@/components/dashboard/dashboard-shared-ui";
import { Button } from "@/components/ui/button";
import type { AppRole } from "@/lib/auth-routing";
import type { WholesaleCustomer, WholesaleProfile } from "@/lib/wholesale";
import type {
  WholesaleLogisticsFilters,
  WholesaleLogisticsPage,
  WholesaleLogisticsStoreAssignment,
  WholesaleLogisticsStoreOption,
} from "@/lib/wholesale-logistics-page";
import { getWholesaleRoleCapabilities } from "@/lib/wholesale-role-permissions";

import { WholesaleLogisticsAssignmentDialog } from "./wholesale-logistics-assignment-dialog";
import { WholesaleLogisticsFiltersPanel } from "./wholesale-logistics-filters";
import { WholesaleLogisticsRecords } from "./wholesale-logistics-records";
import { WholesaleLogisticsSummary } from "./wholesale-logistics-summary";
import { WholesalePageShell } from "./wholesale-ui";
import { useWholesaleLogisticsPage } from "./use-wholesale-logistics-page";

type WholesaleLogisticsSectionProps = {
  currentRole: AppRole | null;
  customers: WholesaleCustomer[];
  initialAssignments: WholesaleLogisticsStoreAssignment[];
  initialFilters: WholesaleLogisticsFilters;
  initialPage: WholesaleLogisticsPage;
  initialStoreOptions: WholesaleLogisticsStoreOption[];
  profiles: WholesaleProfile[];
};

/**
 * 页面协调组件只负责组装标题、汇总、筛选、记录列表和设置弹窗。
 * 查询、同步、mutation、表单状态及桌面/移动渲染均由同层模块分别承担。
 */
export function WholesaleLogisticsSection({
  currentRole,
  customers,
  initialAssignments,
  initialFilters,
  initialPage,
  initialStoreOptions,
  profiles,
}: WholesaleLogisticsSectionProps) {
  const t = useTranslations("WholesaleBusiness.logisticsArchive");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const logistics = useWholesaleLogisticsPage({
    initialAssignments,
    initialFilters,
    initialPage,
    initialStoreOptions,
  });
  const canManage =
    getWholesaleRoleCapabilities(currentRole).canManageLogistics;
  const profilesById = useMemo(
    () => new Map(profiles.map((profile) => [profile.user_id, profile])),
    [profiles],
  );
  const customersById = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers],
  );

  return (
    <WholesalePageShell
      actions={
        canManage ? (
          <Button
            variant="primary"
            size="default"
            onClick={() => setSettingsOpen(true)}
            type="button"
            wrap
          >
            <Settings2 className="size-4 shrink-0" />
            {t("actions.settings")}
          </Button>
        ) : null
      }
      title={t("title")}
    >
      {logistics.feedback?.scope === "page" ? (
        <FeedbackNotice tone={logistics.feedback.tone}>
          <div className="flex min-w-0 items-start justify-between gap-3">
            <span className="min-w-0 break-words">
              {logistics.feedback.message}
            </span>
            <DesignButton
              className="shrink-0 text-xs font-semibold underline underline-offset-2"
              onClick={logistics.dismissFeedback}
              type="button"
            >
              {t("actions.dismiss")}
            </DesignButton>
          </div>
        </FeedbackNotice>
      ) : null}

      {logistics.updatingSource ? (
        <p className="rounded-record-card border border-border-subtle bg-surface-inset px-4 py-3 text-sm text-content-muted">
          {t("updating")}
        </p>
      ) : null}

      {logistics.hasPage ? <WholesaleLogisticsSummary page={logistics.page} /> : null}

      <WholesaleLogisticsFiltersPanel
        filters={logistics.filters}
        onChange={logistics.setFilters}
        onClear={logistics.clearFilters}
        onExactSearch={logistics.activateExactSearch}
        onExitExactSearch={logistics.exitExactSearch}
        onSelectDatePreset={logistics.applyDatePreset}
        profiles={profiles}
        storeOptions={logistics.storeOptions}
      />

      <DashboardOrderListSection
        ariaLabel={t("list.title")}
        controls={
          <DashboardOrderPaginationActions {...logistics.pagination} pending={logistics.loading}
            onNextPage={() => void logistics.goToPage(logistics.pagination.page + 1)}
            onPreviousPage={() => void logistics.goToPage(logistics.pagination.page - 1)} />
        }
        progress={
          logistics.hasPage && logistics.page.rows.length > 0
            ? {
                kind: "range",
                start: logistics.pagination.startIndex,
                end: logistics.pagination.endIndex,
                total: logistics.page.totalCount,
                unit: "logisticsOrders",
              }
            : null
        }
      >
        {logistics.loading ? (
          <p className="mb-3 text-sm text-content-muted">{t("list.loading")}</p>
        ) : null}
        {logistics.loadError ? (
          <FeedbackNotice tone="error">{logistics.loadError}<Button disabled={logistics.loading} onClick={() => void logistics.goToPage(logistics.pagination.page)} type="button" variant="outline">{t("actions.retry")}</Button></FeedbackNotice>
        ) : null}

        {logistics.hasPage && !logistics.loading ? <WholesaleLogisticsRecords
          customersById={customersById}
          page={logistics.page}
          profilesById={profilesById}
        /> : null}
      </DashboardOrderListSection>

      {canManage ? (
        <WholesaleLogisticsAssignmentDialog
          assignments={logistics.assignments}
          customers={customers}
          feedback={
            logistics.feedback?.scope === "assignment"
              ? logistics.feedback
              : null
          }
          onAssign={logistics.assignStores}
          onChange={logistics.changeAssignment}
          onDismissFeedback={logistics.dismissFeedback}
          onEnd={logistics.endAssignment}
          onOpenChange={setSettingsOpen}
          open={settingsOpen}
          pendingKey={logistics.pendingKey}
          profiles={profiles}
          storeOptions={logistics.storeOptions}
        />
      ) : null}
    </WholesalePageShell>
  );
}
