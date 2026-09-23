"use client";

import {
  FileSpreadsheet,
  PackageOpen,
  Plus,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { ResponsiveDataView } from "@/components/ui/responsive-data-view";
import type {
  CustomerInventoryOrder,
  CustomerInventoryPageData,
} from "@/lib/customer-inventory-types";

import {
  formatInventoryDateTime,
  getInventoryCustomerName,
  getInventoryProfileName,
  getPaymentStatusTone,
} from "./customer-inventory-display";
import { CustomerInventoryFilterEmptyState } from "./customer-inventory-filter-empty-state";
import {
  InventoryOrderActions,
  InventoryOrderAmountSummary,
  InventoryOrderItemsButton,
  InventoryOrderMobileField,
} from "./customer-inventory-order-card-parts";
import { CustomerInventoryOrderFilters } from "./customer-inventory-order-filters";
import type { InventoryOrderDialogState } from "./customer-inventory-order-dialogs";
import { useCustomerInventoryOrderFilters } from "./use-customer-inventory-order-filters";
import {
  WholesaleEmptyState,
  WholesalePanel,
  WholesaleTable,
  WholesaleTd,
  WholesaleTh,
} from "../wholesale/wholesale-ui";

export function CustomerInventoryOrdersSection({
  canManageOrders,
  data,
  onApplyCredit,
  onAttachments,
  onItems,
  onManageCredit,
  onOrderDialog,
}: {
  canManageOrders: boolean;
  data: CustomerInventoryPageData;
  onApplyCredit: (order: CustomerInventoryOrder) => void;
  onAttachments: (order: CustomerInventoryOrder) => void;
  onItems: (order: CustomerInventoryOrder) => void;
  onManageCredit: (order: CustomerInventoryOrder) => void;
  onOrderDialog: (dialog: InventoryOrderDialogState) => void;
}) {
  const t = useTranslations("CustomerInventory");
  const customerNames = new Map(
    data.customers.map((customer) => [customer.id, customer.unique_name]),
  );
  const profileNames = new Map(
    data.profiles.map((profile) => [
      profile.user_id,
      profile.name ?? profile.email ?? profile.user_id,
    ]),
  );
  const {
    activeFilterCount,
    applyDatePreset,
    clearFilters,
    filteredOrders,
    filters,
    setFilter,
  } = useCustomerInventoryOrderFilters(data);
  const hasReusableFixedCredit =
    data.currentRole === "client" &&
    data.credits.some(
      (credit) =>
        credit.tier === "fixed_200_usd" && credit.status === "repaid",
    ) &&
    !data.credits.some(
      (credit) =>
        credit.tier === "fixed_200_usd" &&
        ["pending", "active"].includes(credit.status),
    );

  return (
    <WholesalePanel
      description={t("orders.description")}
      title={t("orders.title")}
    >
      {canManageOrders ? (
        <div className="mb-4 flex justify-end">
          <Button
            onClick={() => onOrderDialog({ kind: "create" })}
            type="button"
          >
            <Plus className="size-4" />
            {t("orders.create")}
          </Button>
        </div>
      ) : null}

      {hasReusableFixedCredit ? (
        <div className="mb-4 rounded-record-card border border-status-success-border bg-status-success-soft px-4 py-3 text-sm leading-6 text-status-success">
          {t("creditDialogs.fixedQualification")}
        </div>
      ) : null}

      {data.orders.length > 0 ? (
        <CustomerInventoryOrderFilters
          activeFilterCount={activeFilterCount}
          data={data}
          filters={filters}
          isClient={data.currentRole === "client"}
          onClear={clearFilters}
          onFilterChange={setFilter}
          onSelectDatePreset={applyDatePreset}
          visibleCount={filteredOrders.length}
        />
      ) : null}

      {data.orders.length === 0 ? (
        <WholesaleEmptyState
          description={t("orders.emptyDescription")}
          icon={<PackageOpen className="size-5" />}
          title={t("orders.emptyTitle")}
        />
      ) : filteredOrders.length === 0 ? (
        <CustomerInventoryFilterEmptyState
          description={t("filters.noOrderResultsDescription")}
        />
      ) : (
        <ResponsiveDataView
          desktop={
            <WholesaleTable minWidth={1240}>
              <thead>
                <tr>
                  <WholesaleTh>{t("fields.orderNumber")}</WholesaleTh>
                  <WholesaleTh>{t("fields.customer")}</WholesaleTh>
                  <WholesaleTh>{t("fields.salesman")}</WholesaleTh>
                  <WholesaleTh>{t("fields.amounts")}</WholesaleTh>
                  <WholesaleTh>{t("fields.status")}</WholesaleTh>
                  <WholesaleTh>{t("fields.products")}</WholesaleTh>
                  <WholesaleTh>{t("fields.createdAt")}</WholesaleTh>
                  <WholesaleTh>{t("fields.attachments")}</WholesaleTh>
                  <WholesaleTh>{t("fields.actions")}</WholesaleTh>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr className="group" key={order.id}>
                    <WholesaleTd className="font-semibold">
                      {order.order_number}
                    </WholesaleTd>
                    <WholesaleTd className="max-w-48 whitespace-normal">
                      {getInventoryCustomerName(order, customerNames)}
                    </WholesaleTd>
                    <WholesaleTd className="max-w-40 whitespace-normal">
                      {getInventoryProfileName(
                        order.sales_user_id,
                        profileNames,
                      )}
                    </WholesaleTd>
                    <WholesaleTd>
                      <InventoryOrderAmountSummary order={order} />
                    </WholesaleTd>
                    <WholesaleTd>
                      <StatusBadge
                        tone={getPaymentStatusTone(order.payment_status)}
                      >
                        {t(`paymentStatus.${order.payment_status}`)}
                      </StatusBadge>
                    </WholesaleTd>
                    <WholesaleTd>
                      {/* 行内顺序与表头保持一致，让视觉阅读和读屏关联到同一列。 */}
                      <InventoryOrderItemsButton
                        canManageOrders={canManageOrders}
                        count={
                          data.items.filter(
                            (item) => item.order_id === order.id,
                          ).length
                        }
                        onClick={() => onItems(order)}
                      />
                    </WholesaleTd>
                    <WholesaleTd>
                      {formatInventoryDateTime(order.created_at)}
                    </WholesaleTd>
                    <WholesaleTd>
                      <Button
                        onClick={() => onAttachments(order)}
                        size="compact"
                        type="button"
                        variant="outline"
                      >
                        <FileSpreadsheet className="size-4" />
                        {t("orders.attachmentCount", {
                          count: data.attachments.filter(
                            (attachment) => attachment.order_id === order.id,
                          ).length,
                        })}
                      </Button>
                    </WholesaleTd>
                    <WholesaleTd className="whitespace-normal">
                      <InventoryOrderActions
                        canManageOrders={canManageOrders}
                        credits={data.credits}
                        onApplyCredit={onApplyCredit}
                        onManageCredit={onManageCredit}
                        onOrderDialog={onOrderDialog}
                        order={order}
                      />
                    </WholesaleTd>
                  </tr>
                ))}
              </tbody>
            </WholesaleTable>
          }
          mobile={
            <>
              {filteredOrders.map((order) => (
                <article
                  className="min-w-0 rounded-record-card border border-border-subtle bg-surface-interactive p-4"
                  key={order.id}
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-all font-semibold text-content-strong">
                        {order.order_number}
                      </p>
                      <p className="mt-1 break-words text-sm text-content-muted">
                        {getInventoryCustomerName(order, customerNames)}
                      </p>
                    </div>
                    <StatusBadge
                      tone={getPaymentStatusTone(order.payment_status)}
                    >
                      {t(`paymentStatus.${order.payment_status}`)}
                    </StatusBadge>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4">
                    <InventoryOrderMobileField label={t("fields.salesman")}>
                      {getInventoryProfileName(
                        order.sales_user_id,
                        profileNames,
                      )}
                    </InventoryOrderMobileField>
                    <InventoryOrderMobileField label={t("fields.createdAt")}>
                      {formatInventoryDateTime(order.created_at)}
                    </InventoryOrderMobileField>
                    <div className="col-span-2">
                      <InventoryOrderAmountSummary order={order} />
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-border-subtle pt-4">
                    <Button
                      onClick={() => onAttachments(order)}
                      type="button"
                      variant="outline"
                    >
                      <FileSpreadsheet className="size-4" />
                      {t("orders.attachments")}
                    </Button>
                    <InventoryOrderItemsButton
                      canManageOrders={canManageOrders}
                      count={
                        data.items.filter(
                          (item) => item.order_id === order.id,
                        ).length
                      }
                      onClick={() => onItems(order)}
                    />
                    <InventoryOrderActions
                      canManageOrders={canManageOrders}
                      credits={data.credits}
                      onApplyCredit={onApplyCredit}
                      onManageCredit={onManageCredit}
                      onOrderDialog={onOrderDialog}
                      order={order}
                    />
                  </div>
                </article>
              ))}
            </>
          }
        />
      )}
    </WholesalePanel>
  );
}
