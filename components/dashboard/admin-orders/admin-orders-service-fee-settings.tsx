"use client";

import { useTranslations } from "next-intl";

import type { ServiceFeeTypeOption } from "@/lib/service-fee-types";
import { useLocale } from "@/components/i18n/locale-provider";

import { DashboardListSection } from "../dashboard-section-panel";
import { FeedbackNotice } from "../dashboard-shared-ui";
import { formatDiscountRatioValue } from "./admin-orders-utils";
import {
  AdminOrdersServiceFeeTierSection,
  type ServiceFeeRuleLine,
} from "./admin-orders-service-fee-tier-section";

import { useAdminOrderServiceFeeSettings } from "./use-admin-order-service-fee-settings";
type DiscountLocale = Parameters<typeof formatDiscountRatioValue>[1];

export function AdminOrdersServiceFeeSettings({
  initialRows,
  onRowsChange,
}: {
  initialRows: ServiceFeeTypeOption[];
  onRowsChange?: (rows: ServiceFeeTypeOption[]) => void;
}) {
  const { locale } = useLocale();
  const t = useTranslations("Orders");
  const {
    retailRows,
    editValue,
    editingId,
    pendingAction,
    feedback,
    handleSave,
    startEditing,
    cancelEditing,
    setEditValue,
  } = useAdminOrderServiceFeeSettings({ initialRows, onRowsChange });

  const tierCopy = {
    actions: t("settings.serviceFees.table.actions"),
    cancel: t("settings.serviceFees.cancel"),
    edit: t("settings.serviceFees.edit"),
    empty: t("settings.serviceFees.emptyDescription"),
    rate: t("settings.serviceFees.table.rate"),
    rule: t("settings.serviceFees.table.rule"),
    save: t("settings.serviceFees.save"),
    tier: t("settings.serviceFees.table.tier"),
  };

  return (
    <DashboardListSection bodyClassName="flex flex-col gap-5">
      {feedback ? (
        <FeedbackNotice tone={feedback.tone}>{feedback.message}</FeedbackNotice>
      ) : null}

      <AdminOrdersServiceFeeTierSection
        copy={tierCopy}
        description={t("settings.serviceFees.retail.description")}
        editValue={editValue}
        editingId={editingId}
        locale={locale}
        pendingAction={pendingAction}
        rows={retailRows}
        title={t("settings.serviceFees.retail.title")}
        getRuleLines={(row) =>
          getServiceFeeRuleLines({
            locale,
            row,
            t,
          })
        }
        onCancelEditing={cancelEditing}
        onEditValueChange={setEditValue}
        onSave={(row) => void handleSave(row)}
        onStartEditing={startEditing}
      />
    </DashboardListSection>
  );
}

function getServiceFeeRuleLines({
  locale,
  row,
  t,
}: {
  locale: DiscountLocale;
  row: ServiceFeeTypeOption;
  t: ReturnType<typeof useTranslations<"Orders">>;
}): ServiceFeeRuleLine[] {
  return [
    {
      text: t("settings.serviceFees.calculations.serviceFeeShort", {
        rate: formatDiscountRatioValue(row.fee_ratio, locale),
      }),
      tone: "primary",
    },
  ];
}
