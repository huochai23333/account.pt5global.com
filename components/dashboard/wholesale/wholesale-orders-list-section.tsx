"use client";

import { LoaderCircle, ReceiptText } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useState } from "react";

import {
  DashboardOrderListSection,
  DashboardOrderLoadMoreButton,
} from "@/components/dashboard/dashboard-order-list-section";
import { FeedbackNotice } from "@/components/dashboard/dashboard-shared-ui";
import { UiMessage } from "@/components/i18n/ui-message";
import { ResponsiveDataView } from "@/components/ui/responsive-data-view";
import { Button } from "@/components/ui/button";
import type { WholesaleOrderPage } from "@/lib/wholesale-order-page";

import { WholesaleOrdersMobileList } from "./wholesale-orders-mobile-list";
import { ClientWholesaleOrdersTable } from "./client-wholesale-orders-table";
import { WholesaleOrdersCompactTable } from "./wholesale-orders-compact-table";
import {
  WholesaleOrdersTable,
  type WholesaleOrdersTableProps,
} from "./wholesale-orders-table";
import { WholesaleEmptyState } from "./wholesale-ui";

type WholesaleOrderRenderProps = Omit<
  WholesaleOrdersTableProps,
  "canViewInternalFields" | "orders"
>;

/**
 * 批发订单列表独立处理加载、空状态、桌面表格、移动卡片和统一底栏。
 * 页面协调组件只负责准备权限与事件，不再直接承载完整列表渲染。
 */
export function WholesaleOrdersListSection({
  assessmentPanel,
  loadError,
  loading,
  loadingMore,
  onLoadMore,
  onRetry,
  page,
  renderProps,
}: {
  assessmentPanel?: ReactNode;
  loadError: string | null;
  loading: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onRetry: () => void;
  page: WholesaleOrderPage | null;
  renderProps: WholesaleOrderRenderProps;
}) {
  const uiText = useTranslations(
    "UiText.components_dashboard_wholesale_wholesale_orders_section",
  );
  const t = useTranslations("WholesaleBusiness.ordersUi");
  const [showAllColumns, setShowAllColumns] = useState(false);
  return (
    <DashboardOrderListSection
      ariaLabel={uiText("attribute004")}
      controls={
        page?.nextCursor ? (
          <DashboardOrderLoadMoreButton
            loading={loadingMore}
            onClick={onLoadMore}
          />
        ) : undefined
      }
      progress={
        page && page.orders.length > 0
          ? {
              kind: "loaded",
              shown: page.orders.length,
              total: page.totalCount,
              unit: "orders",
            }
          : null
      }
    >
      {loadError ? (
        <div className="mb-4 space-y-3">
          <FeedbackNotice tone="error">{loadError}</FeedbackNotice>
          <Button
            size="default"
            onClick={onRetry}
            type="button"
            variant="outline"
          >
            <UiMessage id="components_dashboard_wholesale_wholesale_orders_section.text002" />
          </Button>
        </div>
      ) : null}

      {page?.warnings.map((warning) => (
        <FeedbackNotice key={`${warning.area}:${warning.message}`} tone="info">
          {warning.message}
        </FeedbackNotice>
      ))}

      {loading ? (
        <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-content-muted">
          <LoaderCircle className="size-4 animate-spin" />
          <UiMessage id="components_dashboard_wholesale_wholesale_orders_section.text003" />
        </div>
      ) : page && page.orders.length === 0 ? (
        <>
          <WholesaleEmptyState
            description={uiText("attribute005")}
            icon={<ReceiptText className="size-5" />}
            title={uiText("attribute006")}
          />
          {/* 空结果仍给出评估入口的禁用原因，恢复筛选后同一入口可继续使用。 */}
          {assessmentPanel ? <div className="mt-3">{assessmentPanel}</div> : null}
        </>
      ) : page ? (
        <ResponsiveDataView
          desktop={
            page.canViewInternalFields ? <div>
              <div className="mb-3 flex flex-wrap items-start justify-end gap-2">
                {assessmentPanel ? <div className="min-w-0 flex-1">{assessmentPanel}</div> : null}
                <Button onClick={() => setShowAllColumns((current) => !current)} size="compact" type="button" variant="outline">
                  {showAllColumns ? t("compactColumns.showCommon") : t("compactColumns.showAll")}
                </Button>
              </div>
              {showAllColumns ? <WholesaleOrdersTable
                {...renderProps}
                canViewInternalFields
                orders={page.orders}
              /> : <WholesaleOrdersCompactTable
                {...renderProps}
                canViewInternalFields
                orders={page.orders}
              />}
            </div> : <ClientWholesaleOrdersTable
              orders={page.orders}
              clientContactsByOrderId={page.clientContactsByOrderId}
              orderListAttachmentsByOrderId={renderProps.orderListAttachmentsByOrderId}
            />
          }
          mobile={
            <WholesaleOrdersMobileList
              {...renderProps}
              canViewInternalFields={page.canViewInternalFields}
              clientContactsByOrderId={page.clientContactsByOrderId}
              orders={page.orders}
            />
          }
        />
      ) : null}
    </DashboardOrderListSection>
  );
}
