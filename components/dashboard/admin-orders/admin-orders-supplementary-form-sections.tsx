"use client";

import { Select } from "@/components/ui/select";

import { useMemo } from "react";

import { LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  type OrderDiscountTypeOption,
  type PurchaseOrderTypeOption,
  type ServiceOrderPriceOption,
  type ServiceOrderTypeOption,
} from "@/lib/admin-orders";
import { useLocale } from "@/components/i18n/locale-provider";

import {
  OrderField,
  OrderSupplementaryFormSection,
} from "./admin-orders-dialog-ui";
import { OrderDetailPairsInput } from "./admin-orders-detail-pairs-input";
import { isPurchaseDetailsCategory } from "./admin-orders-form-validation";
import {
  createOrdersUiCopy,
  formatDiscountRatioValue,
  formatPurchaseOrderSubtype,
  formatServiceOrderSubtype,
  formatVipScope,
  type OrderFormState,
} from "./admin-orders-utils";
import { formatServicePriceOptionLabel } from "./admin-orders-service-pricing";

const VISIBLE_VIP_SCOPE_VALUES = ["retail"] as const;

type OrderSupplementaryFormSectionsProps = {
  formState: OrderFormState;
  isFormBusy: boolean;
  mode: "create" | "edit";
  orderDiscountOptions: OrderDiscountTypeOption[];
  purchaseOrderTypeOptions: PurchaseOrderTypeOption[];
  selectedOrderCategory: string | null;
  serviceOrderPriceOptions: ServiceOrderPriceOption[];
  serviceOrderTypeOptions: ServiceOrderTypeOption[];
  supplementaryLoading: boolean;
  onFieldChange: <Key extends keyof OrderFormState>(
    key: Key,
    value: OrderFormState[Key],
  ) => void;
};

export function OrderSupplementaryFormSections({
  formState,
  isFormBusy,
  mode,
  orderDiscountOptions,
  purchaseOrderTypeOptions,
  selectedOrderCategory,
  serviceOrderPriceOptions,
  serviceOrderTypeOptions,
  supplementaryLoading,
  onFieldChange,
}: OrderSupplementaryFormSectionsProps) {
  if (isPurchaseDetailsCategory(selectedOrderCategory)) {
    return (
      <div>
        <PurchaseSupplementaryFormSection
          formState={formState}
          isFormBusy={isFormBusy}
          mode={mode}
          purchaseOrderTypeOptions={purchaseOrderTypeOptions}
          supplementaryLoading={supplementaryLoading}
          onFieldChange={onFieldChange}
        />
      </div>
    );
  }

  if (selectedOrderCategory === "service") {
    return (
      <div>
        <ServiceSupplementaryFormSection
          formState={formState}
          isFormBusy={isFormBusy}
          mode={mode}
          orderDiscountOptions={orderDiscountOptions}
          serviceOrderPriceOptions={serviceOrderPriceOptions}
          serviceOrderTypeOptions={serviceOrderTypeOptions}
          supplementaryLoading={supplementaryLoading}
          onFieldChange={onFieldChange}
        />
      </div>
    );
  }

  if (selectedOrderCategory === "vip_recharge") {
    return (
      <div>
        <VipRechargeSupplementaryFormSection
          formState={formState}
          isFormBusy={isFormBusy}
          mode={mode}
          supplementaryLoading={supplementaryLoading}
          onFieldChange={onFieldChange}
        />
      </div>
    );
  }

  return null;
}

function PurchaseSupplementaryFormSection({
  formState,
  isFormBusy,
  mode,
  purchaseOrderTypeOptions,
  supplementaryLoading,
  onFieldChange,
}: Pick<
  OrderSupplementaryFormSectionsProps,
  | "formState"
  | "isFormBusy"
  | "mode"
  | "purchaseOrderTypeOptions"
  | "supplementaryLoading"
  | "onFieldChange"
>) {
  const t = useTranslations("OrdersUI");
  const orderUiCopy = useMemo(() => createOrdersUiCopy(t), [t]);

  return (
    <OrderSupplementaryFormSection
      description={
        mode === "create"
          ? t("purchaseSection.createDescription")
          : t("purchaseSection.editDescription")
      }
      title={t("purchaseSection.title")}
    >
      {supplementaryLoading ? (
        <SupplementaryLoading message={t("purchaseSection.loading")} />
      ) : null}

      <div className="grid gap-5 md:grid-cols-2">
        <OrderField label={t("fields.purchaseSubtype")} required>
          <Select
            disabled={isFormBusy}
            onValueChange={(value) => onFieldChange("purchaseSubtype", value)}
            options={[
              { label: t("select.purchaseSubtype"), value: "" },
              ...purchaseOrderTypeOptions.map((option) => ({
                label: formatPurchaseOrderSubtype(
                  option.business_subcategory,
                  orderUiCopy,
                ),
                value: option.id,
              })),
            ]}
            value={formState.purchaseSubtype}
          />
        </OrderField>
      </div>

      <OrderField label={t("fields.purchaseDetails")}>
        <OrderDetailPairsInput
          copy={{
            addLabel: t("detailPairs.add"),
            namePlaceholder: t("detailPairs.namePlaceholder"),
            removeLabel: t("detailPairs.remove"),
            valuePlaceholder: t("detailPairs.valuePlaceholder"),
          }}
          disabled={isFormBusy}
          onChange={(nextValue) => onFieldChange("purchaseDetails", nextValue)}
          value={formState.purchaseDetails}
        />
      </OrderField>
    </OrderSupplementaryFormSection>
  );
}

function ServiceSupplementaryFormSection({
  formState,
  isFormBusy,
  mode,
  orderDiscountOptions,
  serviceOrderTypeOptions,
  serviceOrderPriceOptions,
  supplementaryLoading,
  onFieldChange,
}: Pick<
  OrderSupplementaryFormSectionsProps,
  | "formState"
  | "isFormBusy"
  | "mode"
  | "orderDiscountOptions"
  | "serviceOrderPriceOptions"
  | "serviceOrderTypeOptions"
  | "supplementaryLoading"
  | "onFieldChange"
>) {
  const { locale } = useLocale();
  const t = useTranslations("OrdersUI");
  const orderUiCopy = useMemo(() => createOrdersUiCopy(t), [t]);
  const visiblePriceOptions = useMemo(
    () =>
      serviceOrderPriceOptions.filter(
        (option) => option.service_order_type_id === formState.serviceSubtype,
      ),
    [formState.serviceSubtype, serviceOrderPriceOptions],
  );

  return (
    <OrderSupplementaryFormSection
      description={
        mode === "create"
          ? t("serviceSection.createDescription")
          : t("serviceSection.editDescription")
      }
      title={t("serviceSection.title")}
    >
      {supplementaryLoading ? (
        <SupplementaryLoading message={t("serviceSection.loading")} />
      ) : null}

      <div className="grid gap-5 md:grid-cols-2">
        <OrderField label={t("fields.serviceSubtype")} required>
          <Select
            disabled={isFormBusy}
            onValueChange={(value) => onFieldChange("serviceSubtype", value)}
            options={[
              { label: t("select.serviceSubtype"), value: "" },
              ...serviceOrderTypeOptions.map((option) => ({
                label: formatServiceOrderSubtype(
                  option.business_subcategory,
                  orderUiCopy,
                ),
                value: option.id,
              })),
            ]}
            value={formState.serviceSubtype}
          />
        </OrderField>

        <OrderField label={t("fields.serviceDiscount")} required>
          <Select
            disabled={isFormBusy}
            onValueChange={(value) => onFieldChange("serviceDiscount", value)}
            options={[
              { label: t("select.serviceDiscount"), value: "" },
              ...orderDiscountOptions.map((option) => ({
                label: formatDiscountRatioValue(
                  option.discount_ratio,
                  locale,
                  orderUiCopy,
                ),
                value: option.id,
              })),
            ]}
            value={formState.serviceDiscount}
          />
        </OrderField>

        <OrderField label={t("fields.servicePrice")} required>
          <Select
            disabled={isFormBusy || !formState.serviceSubtype}
            onValueChange={(value) =>
              onFieldChange("servicePriceOption", value)
            }
            options={[
              { label: t("select.servicePrice"), value: "" },
              ...visiblePriceOptions.map((option) => ({
                label: formatServicePriceOptionLabel(option),
                value: option.id,
              })),
            ]}
            value={formState.servicePriceOption}
          />
        </OrderField>
      </div>

      <OrderField label={t("fields.serviceDetails")}>
        <OrderDetailPairsInput
          copy={{
            addLabel: t("detailPairs.add"),
            namePlaceholder: t("detailPairs.namePlaceholder"),
            removeLabel: t("detailPairs.remove"),
            valuePlaceholder: t("detailPairs.valuePlaceholder"),
          }}
          disabled={isFormBusy}
          onChange={(nextValue) => onFieldChange("serviceDetails", nextValue)}
          value={formState.serviceDetails}
        />
      </OrderField>
    </OrderSupplementaryFormSection>
  );
}

function VipRechargeSupplementaryFormSection({
  formState,
  isFormBusy,
  mode,
  supplementaryLoading,
  onFieldChange,
}: Pick<
  OrderSupplementaryFormSectionsProps,
  "formState" | "isFormBusy" | "mode" | "supplementaryLoading" | "onFieldChange"
>) {
  const t = useTranslations("OrdersUI");
  const orderUiCopy = useMemo(() => createOrdersUiCopy(t), [t]);

  return (
    <OrderSupplementaryFormSection
      description={
        mode === "create"
          ? t("vipSection.createDescription")
          : t("vipSection.editDescription")
      }
      title={t("vipSection.title")}
    >
      {supplementaryLoading ? (
        <SupplementaryLoading message={t("vipSection.loading")} />
      ) : null}

      <div className="grid gap-5 md:grid-cols-2">
        <OrderField label={t("fields.vipScope")} required>
          <Select
            disabled={isFormBusy}
            onValueChange={(value) => onFieldChange("vipScope", value)}
            options={VISIBLE_VIP_SCOPE_VALUES.map((scope) => ({
              label: formatVipScope(scope, orderUiCopy),
              value: scope,
            }))}
            value={formState.vipScope}
          />
        </OrderField>
      </div>

      <OrderField label={t("fields.vipDetails")}>
        <OrderDetailPairsInput
          copy={{
            addLabel: t("detailPairs.add"),
            namePlaceholder: t("detailPairs.namePlaceholder"),
            removeLabel: t("detailPairs.remove"),
            valuePlaceholder: t("detailPairs.valuePlaceholder"),
          }}
          disabled={isFormBusy}
          onChange={(nextValue) => onFieldChange("vipDetails", nextValue)}
          value={formState.vipDetails}
        />
      </OrderField>
    </OrderSupplementaryFormSection>
  );
}

function SupplementaryLoading({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 rounded-record-card border border-border-subtle bg-surface-interactive px-4 py-3 text-sm text-content-muted">
      <LoaderCircle className="size-4 animate-spin" />
      {message}
    </div>
  );
}
