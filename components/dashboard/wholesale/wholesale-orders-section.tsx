"use client";
import { UiMessage } from "@/components/i18n/ui-message";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { hasWholesaleOrderInternalFields } from "@/lib/wholesale";
import type { WholesaleOrderListItem } from "@/lib/wholesale";
import { useWholesaleOrderFilters } from "./use-wholesale-order-filters";
import { useWholesaleOrderPage } from "./use-wholesale-order-page";
import { useWholesaleOrderListHandlers } from "./use-wholesale-order-list-handlers";
import { WholesaleOrderAssessmentPanel } from "./wholesale-order-assessment-panel";
import { WholesaleOrderChangeSections } from "./wholesale-order-change-sections";
import { WholesaleOrderEditDialog } from "./wholesale-order-edit-dialog";
import { canCurrentUserManageWholesaleOrder } from "./wholesale-order-permissions";
import { WholesaleOrderFiltersPanel } from "./wholesale-order-filters";
import { WholesaleOrderFormDialog } from "./wholesale-order-form-dialog";
import { WholesaleOrderSettlementDialog } from "./wholesale-order-rate-dialogs";
import { WholesaleOrderSummary } from "./wholesale-order-summary";
import { useWholesaleOrderViewData } from "./wholesale-order-view-data";
import { WholesaleOrdersListSection } from "./wholesale-orders-list-section";
import type { WholesaleOrderEditAction } from "./wholesale-orders-table";
import type { WholesaleOrdersSectionProps } from "./wholesale-orders-section-types";
import { WholesalePageShell } from "./wholesale-ui";
export function WholesaleOrdersSection({
  canEdit,
  canManageEveryOrder,
  canReassignOrder,
  currentRole,
  currentUserId,
  customers,
  customersById,
  exchangeRates,
  initialPage,
  onCreateOrder,
  onDeleteOrderListAttachment,
  onMarkOrderSettled,
  onUpdateOrder,
  onUploadOrderListAttachments,
  pendingKey,
  profilesById,
  salesAccounts,
}: WholesaleOrdersSectionProps) {
  const uiText = useTranslations(
    "UiText.components_dashboard_wholesale_wholesale_orders_section",
  );
  const t = useTranslations("WholesaleBusiness.ordersUi");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedEditOrder, setSelectedEditOrder] =
    useState<WholesaleOrderListItem | null>(null);
  const [selectedSettlementOrder, setSelectedSettlementOrder] =
    useState<WholesaleOrderListItem | null>(null);
  const filterState = useWholesaleOrderFilters();
  const pageState = useWholesaleOrderPage({
    filters: filterState.queryFilters,
    initialPage,
  });
  const page = pageState.page;
  const viewData = useWholesaleOrderViewData(page);
  const assessmentFilters = useMemo(
    () => ({
      customerId: filterState.queryFilters.customerId,
      orderMonth: filterState.queryFilters.orderMonth,
      orderedFromDate: filterState.queryFilters.orderedFromDate,
      orderedToDate: filterState.queryFilters.orderedToDate,
      salesUserId: filterState.queryFilters.salesUserId,
      searchText: filterState.queryFilters.searchText,
      status: filterState.queryFilters.status,
    }),
    [filterState.queryFilters],
  );
  const canMarkOrderSettled = useCallback(
    (order: WholesaleOrderListItem) =>
      order.status !== "settled" &&
      canCurrentUserManageWholesaleOrder({
        canEdit,
        canManageEveryOrder,
        currentUserId,
        customer: customersById.get(order.customer_id),
        order,
      }),
    [canEdit, canManageEveryOrder, currentUserId, customersById],
  );
  const getOrderEditAction = useCallback(
    (order: WholesaleOrderListItem): WholesaleOrderEditAction | null => {
      if (
        !hasWholesaleOrderInternalFields(order) ||
        !canCurrentUserManageWholesaleOrder({
          canEdit,
          canManageEveryOrder,
          currentUserId,
          customer: customersById.get(order.customer_id),
          order,
        })
      ) {
        return null;
      }
      return { label: t("actions.edit") };
    },
    [
      canEdit,
      canManageEveryOrder,
      currentUserId,
      customersById,
      t,
    ],
  );
  const refreshAfter = useCallback(
    async (action: () => boolean | Promise<boolean>) => {
      const succeeded = await action();
      // 请求失败时页面数据没有变化，也不能用旧的服务端结果覆盖用户正在处理的内容。
      if (!succeeded) return false;
      await pageState.refreshFirstPage();
      return true;
    },
    [pageState],
  );
  const orderListHandlers = useWholesaleOrderListHandlers({
    attachmentsByOrderId: viewData.orderListAttachmentsByOrderId,
    canEdit,
    canManageEveryOrder,
    currentRole,
    currentUserId,
    customersById,
    onDelete: onDeleteOrderListAttachment,
    onDeleted: pageState.removeOrderListAttachment,
    onUpload: onUploadOrderListAttachments,
    refreshAfter,
  });
  return (
    <WholesalePageShell
      actions={
        canEdit ? (
          <Button
            variant="primary"
            size="default"
            onClick={() => setCreateDialogOpen(true)}
            type="button"
          >
            <Plus className="size-4" />
            <UiMessage id="components_dashboard_wholesale_wholesale_orders_section.text001" />
          </Button>
        ) : null
      }
      title={uiText("attribute003")}
    >
      <WholesaleOrderFiltersPanel
        customers={customers}
        filters={filterState.filters}
        hasActiveFilters={filterState.hasActiveFilters}
        // 客户的订单数据已经由数据库限制为本人范围，所以前端隐藏无意义的客户筛选框。
        hideCustomerFilter={currentRole === "client"}
        // 计入月份属于内部经营字段，客户响应会裁掉该字段，因此客户页面也不提供此筛选。
        hideOrderMonthFilter={currentRole === "client"}
        onClear={filterState.clearFilters}
        onExactSearch={filterState.activateExactSearch}
        onExitExactSearch={filterState.exitExactSearch}
        onSelectDatePreset={filterState.applyDatePreset}
        onUpdate={filterState.updateFilter}
        salesAccounts={salesAccounts}
      />

      {page ? <WholesaleOrderSummary appliedFilters={pageState.appliedFilters} canViewInternalFields={page.canViewInternalFields} summary={page.summary} /> : null}

      <WholesaleOrdersListSection
        assessmentPanel={
          page?.canViewInternalFields ? (
            <WholesaleOrderAssessmentPanel
              filters={assessmentFilters}
              matchedOrderCount={page.totalCount}
            />
          ) : undefined
        }
        loadError={pageState.loadError}
        loading={pageState.loading}
        loadingMore={pageState.loadingMore}
        onLoadMore={() => void pageState.loadMore()}
        onRetry={() => void pageState.refreshFirstPage()}
        page={page}
        renderProps={{
          canMarkOrderSettled,
          canManageOrderListAttachments:
            orderListHandlers.canManageOrderListAttachments,
          customersById,
          getOrderEditAction,
          onDeleteOrderListAttachment:
            orderListHandlers.deleteOrderListAttachment,
          onOpenOrderEdit: setSelectedEditOrder,
          onOpenOrderSettlement: setSelectedSettlementOrder,
          onUploadOrderListAttachments:
            orderListHandlers.uploadOrderListAttachments,
          orderListAttachmentsByOrderId: viewData.orderListAttachmentsByOrderId,
          orderSettlementsByOrderId: viewData.orderSettlementsByOrderId,
          pendingKey,
          profilesById,
          purchaseOrdersByOrderId: viewData.purchaseOrdersByOrderId,
        }}
      />

      {page?.canViewInternalFields ? (
        <WholesaleOrderChangeSections
          customersById={customersById}
          logs={page.orderChangeLogs}
          ordersById={viewData.ordersById}
          profilesById={profilesById}
        />
      ) : null}

      <WholesaleOrderFormDialog
        customers={customers}
        exchangeRates={exchangeRates}
        onCreateOrder={(formData) =>
          onCreateOrder(formData, pageState.refreshFirstPage)
        }
        onOpenChange={setCreateDialogOpen}
        open={createDialogOpen}
        pending={pendingKey === "order:create"}
        salesAccounts={salesAccounts}
      />

      {selectedEditOrder &&
      hasWholesaleOrderInternalFields(selectedEditOrder) ? (
        <WholesaleOrderEditDialog
          canReassignOrder={canReassignOrder}
          customers={customers}
          exchangeRates={exchangeRates}
          key={selectedEditOrder.id}
          onOpenChange={(open) => {
            if (!open) setSelectedEditOrder(null);
          }}
          onUpdateOrder={(formData) =>
            onUpdateOrder(formData, pageState.refreshFirstPage)
          }
          open
          order={selectedEditOrder}
          pending={pendingKey === `order:update:${selectedEditOrder.id}`}
          salesAccounts={salesAccounts}
        />
      ) : null}

      {selectedSettlementOrder && page ? (
        <WholesaleOrderSettlementDialog
          exchangeRates={exchangeRates}
          onOpenChange={(open) => {
            if (!open) setSelectedSettlementOrder(null);
          }}
          onSettleOrder={(formData) =>
            onMarkOrderSettled(formData, pageState.refreshFirstPage)
          }
          order={selectedSettlementOrder}
          settlements={
            viewData.orderSettlementsByOrderId.get(
              selectedSettlementOrder.id,
            ) ?? []
          }
          pending={pendingKey === `order:settle:${selectedSettlementOrder.id}`}
        />
      ) : null}
    </WholesalePageShell>
  );
}
