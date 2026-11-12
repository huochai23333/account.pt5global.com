"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { getBrowserSupabaseClient } from "@/lib/supabase";
import type { FeedbackTone } from "../dashboard-shared-ui";
import type { OrderDiscountTypeOption, ServiceOrderPriceOption } from "@/lib/admin-orders";
import { updateOrderDiscountType, updateServiceOrderPriceOption } from "@/lib/service-order-settings";
import { formatRatioForInput, parseServiceFeeInput } from "./admin-orders-service-fee-settings-utils";
import type { ServiceOrderPriceDraft, ServiceOrderSettingsEditingTarget } from "./admin-orders-service-order-settings-shared";

type PageFeedback = { tone: FeedbackTone; message: string } | null;

// 价格与折扣共用正在编辑的目标；保存后的行来自数据库回执，再同步到上层。
export function useAdminOrderServiceSettings({
  initialDiscounts,
  initialPrices,
  onDiscountsChange,
  onPricesChange,
}: {
  initialDiscounts: OrderDiscountTypeOption[];
  initialPrices: ServiceOrderPriceOption[];
  onDiscountsChange?: (rows: OrderDiscountTypeOption[]) => void;
  onPricesChange?: (rows: ServiceOrderPriceOption[]) => void;
}) {
  const supabase = getBrowserSupabaseClient();
  const t = useTranslations("Orders");
  const [prices, setPrices] = useState<ServiceOrderPriceOption[]>(() =>
    sortServicePrices(initialPrices),
  );
  const [discounts, setDiscounts] = useState<OrderDiscountTypeOption[]>(() =>
    sortOrderDiscounts(initialDiscounts),
  );
  const [editingTarget, setEditingTarget] =
    useState<ServiceOrderSettingsEditingTarget>(null);
  const [editValue, setEditValue] = useState("");
  const [priceDraft, setPriceDraft] = useState<ServiceOrderPriceDraft>({
    amountUsd: "",
    costAmountRmb: "",
  });
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<PageFeedback>(null);
  const regularDiscountId = useMemo(() => {
    const exactRegularDiscount = discounts.find(
      (row) => Number(row.discount_ratio) === 1,
    );

    return (exactRegularDiscount ?? discounts[0] ?? null)?.id ?? null;
  }, [discounts]);

  async function handleSavePrice(row: ServiceOrderPriceOption) {
    if (!supabase || pendingAction !== null) {
      return;
    }

    const parsedAmountUsd = parsePositiveAmount(priceDraft.amountUsd);
    const parsedCostAmountRmb = parseNonNegativeAmount(
      priceDraft.costAmountRmb,
    );

    if (parsedAmountUsd === null) {
      setFeedback({
        tone: "error",
        message: t("settings.serviceOrders.validation.price"),
      });
      return;
    }

    if (parsedCostAmountRmb === null) {
      setFeedback({
        tone: "error",
        message: t("settings.serviceOrders.validation.cost"),
      });
      return;
    }

    setPendingAction(`price:${row.id}`);
    setFeedback(null);

    try {
      const updated = await updateServiceOrderPriceOption(supabase, row.id, {
        amountUsd: parsedAmountUsd,
        costAmountRmb: parsedCostAmountRmb,
      });
      const nextRows = sortServicePrices(
        prices.map((item) => (item.id === updated.id ? updated : item)),
      );
      setPrices(nextRows);
      onPricesChange?.(nextRows);
      clearEditing();
      setFeedback({
        tone: "success",
        message: t("settings.serviceOrders.updateSuccess"),
      });
    } catch {
      setFeedback({
        tone: "error",
        message: t("settings.serviceOrders.errors.unknown"),
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleSaveDiscount(row: OrderDiscountTypeOption) {
    if (!supabase || pendingAction !== null) {
      return;
    }

    const parsed = parseServiceFeeInput(editValue);

    if (!parsed.ok) {
      setFeedback({
        tone: "error",
        message: t("settings.serviceOrders.validation.discount"),
      });
      return;
    }

    setPendingAction(`discount:${row.id}`);
    setFeedback(null);

    try {
      const updated = await updateOrderDiscountType(
        supabase,
        row.id,
        parsed.value,
      );
      const nextRows = sortOrderDiscounts(
        discounts.map((item) => (item.id === updated.id ? updated : item)),
      );
      setDiscounts(nextRows);
      onDiscountsChange?.(nextRows);
      clearEditing();
      setFeedback({
        tone: "success",
        message: t("settings.serviceOrders.updateSuccess"),
      });
    } catch {
      setFeedback({
        tone: "error",
        message: t("settings.serviceOrders.errors.unknown"),
      });
    } finally {
      setPendingAction(null);
    }
  }

  function startPriceEditing(row: ServiceOrderPriceOption) {
    setEditingTarget({ kind: "price", id: row.id });
    setPriceDraft({
      amountUsd: formatAmountForInput(row.amount_usd),
      costAmountRmb: formatAmountForInput(row.cost_amount_rmb),
    });
    setFeedback(null);
  }

  function startDiscountEditing(row: OrderDiscountTypeOption) {
    setEditingTarget({ kind: "discount", id: row.id });
    setEditValue(formatRatioForInput(row.discount_ratio));
    setFeedback(null);
  }

  function clearEditing() {
    setEditingTarget(null);
    setEditValue("");
    setPriceDraft({ amountUsd: "", costAmountRmb: "" });
  }

  return {
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
  };
}

function sortServicePrices(rows: ServiceOrderPriceOption[]) {
  return [...rows].sort((left, right) => left.sort_order - right.sort_order);
}

function sortOrderDiscounts(rows: OrderDiscountTypeOption[]) {
  return [...rows].sort((left, right) => {
    const leftRatio = Number(left.discount_ratio);
    const rightRatio = Number(right.discount_ratio);
    return rightRatio - leftRatio;
  });
}

function parsePositiveAmount(value: string) {
  const parsed = Number(value.trim());

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.round(parsed * 100) / 100;
}

function parseNonNegativeAmount(value: string) {
  const parsed = Number(value.trim());

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.round(parsed * 100) / 100;
}

function formatAmountForInput(value: number | string) {
  const parsed = Number(String(value).trim());

  if (!Number.isFinite(parsed)) {
    return "";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format(parsed);
}
