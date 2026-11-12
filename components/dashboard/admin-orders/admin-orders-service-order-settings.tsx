"use client";

import { useMemo } from "react";

import { useTranslations } from "next-intl";

import type {
  OrderDiscountTypeOption,
  ServiceOrderPriceOption,
  ServiceOrderTypeOption,
} from "@/lib/admin-orders";
import { useLocale } from "@/components/i18n/locale-provider";

import { DashboardListSection } from "../dashboard-section-panel";
import { FeedbackNotice } from "../dashboard-shared-ui";
import { createOrdersUiCopy } from "./admin-orders-utils";
import { ServiceOrderPricesTable } from "./admin-orders-service-order-settings-tables";
import {
  ServiceOrderSettingsSectionTitle,
} from "./admin-orders-service-order-settings-shared";
import { ServiceOrderDiscountsTable } from "./admin-orders-service-order-discounts-table";

import { useAdminOrderServiceSettings } from "./use-admin-order-service-settings";

export function AdminOrdersServiceOrderSettings({
  initialDiscounts,
  initialPrices,
  serviceOrderTypes,
  onDiscountsChange,
  onPricesChange,
}: {
  initialDiscounts: OrderDiscountTypeOption[];
  initialPrices: ServiceOrderPriceOption[];
  serviceOrderTypes: ServiceOrderTypeOption[];
  onDiscountsChange?: (rows: OrderDiscountTypeOption[]) => void;
  onPricesChange?: (rows: ServiceOrderPriceOption[]) => void;
}) {
  const { locale } = useLocale();
  const t = useTranslations("Orders");
  const ordersUiT = useTranslations("OrdersUI");
  const orderUiCopy = useMemo(() => createOrdersUiCopy(ordersUiT), [ordersUiT]);
  const serviceTypeById = useMemo(
    () =>
      new Map(
        serviceOrderTypes.map((item) => [item.id, item.business_subcategory]),
      ),
    [serviceOrderTypes],
  );
  const {
    prices,
    discounts,
    editingTarget,
    editValue,
    priceDraft,
    pendingAction,
    feedback,
    regularDiscountId,
    handleSavePrice,
    handleSaveDiscount,
    startPriceEditing,
    startDiscountEditing,
    clearEditing,
    setPriceDraft,
    setEditValue,
  } = useAdminOrderServiceSettings({ initialDiscounts, initialPrices, onDiscountsChange, onPricesChange });

  return (
    <DashboardListSection bodyClassName="flex flex-col gap-5">
      {feedback ? (
        <FeedbackNotice tone={feedback.tone}>{feedback.message}</FeedbackNotice>
      ) : null}

      <section className="flex flex-col gap-3">
        <ServiceOrderSettingsSectionTitle
          description={t("settings.serviceOrders.prices.description")}
          title={t("settings.serviceOrders.prices.title")}
        />
        <ServiceOrderPricesTable
          editingTarget={editingTarget}
          locale={locale}
          orderUiCopy={orderUiCopy}
          pendingAction={pendingAction}
          priceDraft={priceDraft}
          prices={prices}
          serviceTypeById={serviceTypeById}
          onCancel={clearEditing}
          onEdit={startPriceEditing}
          onPriceDraftChange={setPriceDraft}
          onSave={(row) => void handleSavePrice(row)}
        />
      </section>

      <section className="flex flex-col gap-3">
        <ServiceOrderSettingsSectionTitle
          description={t("settings.serviceOrders.discounts.description")}
          title={t("settings.serviceOrders.discounts.title")}
        />
        <ServiceOrderDiscountsTable
          discounts={discounts}
          editValue={editValue}
          editingTarget={editingTarget}
          locale={locale}
          pendingAction={pendingAction}
          regularDiscountId={regularDiscountId}
          onCancel={clearEditing}
          onDiscountDraftChange={setEditValue}
          onEdit={startDiscountEditing}
          onSave={(row) => void handleSaveDiscount(row)}
        />
      </section>
    </DashboardListSection>
  );
}
