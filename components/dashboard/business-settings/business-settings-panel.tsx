"use client";

import { AdminOrdersServiceFeeSettings } from "@/components/dashboard/admin-orders/admin-orders-service-fee-settings";
import { AdminOrdersServiceOrderSettings } from "@/components/dashboard/admin-orders/admin-orders-service-order-settings";
import { AdminCommissionSettingsSection } from "@/components/dashboard/commission/admin-commission-settings-section";
import type { BusinessSettingsPageData } from "@/lib/business-settings";
import type { WorkspaceBusinessSettingsModule } from "@/lib/workspace-business-modules";

export function BusinessSettingsPanel({
  canManageCommissionSettings,
  businessParameterSettings,
  onBusinessParameterRowsChange,
  onOrderDiscountRowsChange,
  onServiceFeeRowsChange,
  onServiceOrderPriceRowsChange,
  orderDiscountOptions,
  settingsModule,
  serviceFeeTypeOptions,
  serviceOrderPriceOptions,
  serviceOrderTypeOptions,
}: {
  canManageCommissionSettings: BusinessSettingsPageData["canManageCommissionSettings"];
  businessParameterSettings: BusinessSettingsPageData["businessParameterSettings"];
  onBusinessParameterRowsChange: (
    rows: BusinessSettingsPageData["businessParameterSettings"],
  ) => void;
  onOrderDiscountRowsChange: (
    rows: BusinessSettingsPageData["orderDiscountOptions"],
  ) => void;
  onServiceFeeRowsChange: (
    rows: BusinessSettingsPageData["serviceFeeTypeOptions"],
  ) => void;
  onServiceOrderPriceRowsChange: (
    rows: BusinessSettingsPageData["serviceOrderPriceOptions"],
  ) => void;
  orderDiscountOptions: BusinessSettingsPageData["orderDiscountOptions"];
  settingsModule: WorkspaceBusinessSettingsModule | undefined;
  serviceFeeTypeOptions: BusinessSettingsPageData["serviceFeeTypeOptions"];
  serviceOrderPriceOptions: BusinessSettingsPageData["serviceOrderPriceOptions"];
  serviceOrderTypeOptions: BusinessSettingsPageData["serviceOrderTypeOptions"];
}) {
  if (!settingsModule) {
    return null;
  }

  return (
    <div className="flex flex-col gap-8">
      {settingsModule.sections.map((section) => {
        if (section.kind === "tourismServiceFees") {
          return (
            <AdminOrdersServiceFeeSettings
              initialRows={serviceFeeTypeOptions}
              key={section.kind}
              onRowsChange={onServiceFeeRowsChange}
            />
          );
        }

        if (section.kind === "tourismServiceOrders") {
          return (
            <AdminOrdersServiceOrderSettings
              initialDiscounts={orderDiscountOptions}
              initialPrices={serviceOrderPriceOptions}
              key={section.kind}
              serviceOrderTypes={serviceOrderTypeOptions}
              onDiscountsChange={onOrderDiscountRowsChange}
              onPricesChange={onServiceOrderPriceRowsChange}
            />
          );
        }

        return (
          <AdminCommissionSettingsSection
            canManageSettings={canManageCommissionSettings}
            key={`${section.kind}-${section.ruleCodes.join("-")}`}
            onRowsChange={onBusinessParameterRowsChange}
            rows={businessParameterSettings}
            ruleCodes={section.ruleCodes}
          />
        );
      })}
    </div>
  );
}
