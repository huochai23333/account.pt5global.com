"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  type BusinessCategoryOption,
  createAdminOrder,
  type OrderDiscountTypeOption,
  type ServiceOrderPriceOption,
} from "@/lib/admin-orders";
import {
  findTodayCnyExchangeRate,
  type ExchangeRateRow,
} from "@/lib/exchange-rates";
import { previewOrderServiceFeeType } from "@/lib/service-fee-types";
import { getBrowserSupabaseClient } from "@/lib/supabase";

import {
  createOrderFormState,
  applyOrderExchangeRateToOrderForm,
  parseCreateOrderForm,
  getDefaultOrderCurrency,
  type OrderFormState,
  type OrdersUiCopy,
} from "./admin-orders-utils";
import {
  getNextOrderFormState,
} from "./admin-orders-client-config";
import {
  type OrdersTranslator,
  type PageFeedback,
  type PageFeedbackSetter,
} from "./admin-orders-view-model-shared";
import { toOrderErrorMessage } from "./admin-orders-errors";
import { parseNumericValue } from "./admin-orders-display";
import { type OrderServiceFeePreviewState } from "./admin-orders-service-fee-preview";
import { applyServicePricingToOrderForm } from "./admin-orders-service-pricing";
import { type DashboardSharedCopy } from "../dashboard-shared-ui";

export function useAdminOrderCreateDialog({
  canCreateOrders,
  canOpenCreateDialog,
  currentViewerId,
  orderCategoryByTypeId,
  orderDiscountOptions,
  orderTypeOptions,
  ordersUiCopy,
  refreshOrdersRoute,
  setPageFeedback,
  sharedCopy,
  supabase,
  t,
  orderCurrencyRates,
  serviceOrderPriceOptions,
}: {
  canCreateOrders: boolean;
  canOpenCreateDialog: boolean;
  currentViewerId: string | null;
  orderCategoryByTypeId: Map<string, string | null>;
  orderDiscountOptions: OrderDiscountTypeOption[];
  orderTypeOptions: BusinessCategoryOption[];
  ordersUiCopy: OrdersUiCopy;
  refreshOrdersRoute: () => void;
  setPageFeedback: PageFeedbackSetter;
  sharedCopy: DashboardSharedCopy;
  supabase: ReturnType<typeof getBrowserSupabaseClient>;
  t: OrdersTranslator;
  orderCurrencyRates: ExchangeRateRow[];
  serviceOrderPriceOptions: ServiceOrderPriceOption[];
}) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createPending, setCreatePending] = useState(false);
  const [createDialogFeedback, setCreateDialogFeedback] =
    useState<PageFeedback>(null);
  const [createServiceFeePreview, setCreateServiceFeePreview] =
    useState<OrderServiceFeePreviewState>({ feeType: null, status: "idle" });
  const [createFormState, setCreateFormState] = useState<OrderFormState>(() =>
    createOrderFormState(),
  );
  const serviceFeePreviewTokenRef = useRef(0);
  const defaultOriginalCurrency = useMemo(
    () => getDefaultOrderCurrency(orderCurrencyRates),
    [orderCurrencyRates],
  );

  useEffect(() => {
    if (createDialogOpen) {
      return;
    }

    setCreateFormState((current) =>
      applyOrderExchangeRateToOrderForm(
        {
          ...current,
          originalCurrency: current.originalCurrency || defaultOriginalCurrency,
          orderEntryUser: current.orderEntryUser || (currentViewerId ?? ""),
          orderType: current.orderType || (orderTypeOptions[0]?.id ?? ""),
        },
        orderCurrencyRates,
      ),
    );
  }, [
    createDialogOpen,
    currentViewerId,
    defaultOriginalCurrency,
    orderTypeOptions,
    orderCurrencyRates,
  ]);

  const openCreateDialog = useCallback(() => {
    if (!canOpenCreateDialog) {
      return;
    }

    setPageFeedback(null);
    setCreateDialogFeedback(null);
    setCreateFormState(
      applyOrderExchangeRateToOrderForm(
        createOrderFormState({
          originalCurrency: defaultOriginalCurrency,
          orderEntryUser: currentViewerId ?? "",
          orderType: orderTypeOptions[0]?.id ?? "",
        }),
        orderCurrencyRates,
      ),
    );
    setCreateDialogOpen(true);
  }, [
    canOpenCreateDialog,
    currentViewerId,
    defaultOriginalCurrency,
    orderTypeOptions,
    setPageFeedback,
    orderCurrencyRates,
  ]);

  const handleCreateDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open && createPending) {
        return;
      }

      if (!open) {
        setCreateDialogFeedback(null);
      }

      setCreateDialogOpen(open);
    },
    [createPending],
  );

  const updateCreateFormField = useCallback(
    <Key extends keyof OrderFormState>(key: Key, value: OrderFormState[Key]) => {
      setCreateDialogFeedback(null);
      setCreateFormState((current) => {
        let nextState = getNextOrderFormState(current, key, value);
        const selectedCategory =
          key === "orderType"
            ? orderCategoryByTypeId.get(String(value))
            : orderCategoryByTypeId.get(nextState.orderType);

        if (selectedCategory === "vip_recharge") {
          nextState = {
            ...nextState,
            originalCurrency: "USD",
            amount: "200",
            costAmount: "",
            orderStatus: "completed",
          };
        }

        if (selectedCategory === "service") {
          nextState = {
            ...nextState,
            originalCurrency: "USD",
          };
        }

        if (
          key === "originalCurrency" ||
          selectedCategory === "vip_recharge" ||
          selectedCategory === "service"
        ) {
          nextState = applyOrderExchangeRateToOrderForm(nextState, orderCurrencyRates);
        }

        if (selectedCategory === "service") {
          return applyServicePricingToOrderForm(nextState, {
            orderCategory: selectedCategory,
            orderDiscountOptions,
            serviceOrderPriceOptions,
            syncCostAmount:
              key === "serviceSubtype" ||
              key === "servicePriceOption" ||
              !nextState.costAmount.trim(),
          });
        }

        return nextState;
      });
    },
    [
      orderCategoryByTypeId,
      orderCurrencyRates,
      orderDiscountOptions,
      serviceOrderPriceOptions,
    ],
  );

  useEffect(() => {
    if (
      !createDialogOpen ||
      !supabase ||
      !createFormState.orderType ||
      !createFormState.orderingUser ||
      orderCategoryByTypeId.get(createFormState.orderType) !== "purchase"
    ) {
      serviceFeePreviewTokenRef.current += 1;
      setCreateServiceFeePreview({ feeType: null, status: "idle" });
      return;
    }

    const previewToken = serviceFeePreviewTokenRef.current + 1;
    serviceFeePreviewTokenRef.current = previewToken;
    const rmbAmount = parseNumericValue(createFormState.rmbAmount) ?? 0;

    setCreateServiceFeePreview({ feeType: null, status: "loading" });

    void previewOrderServiceFeeType(supabase, {
      orderType: createFormState.orderType,
      orderingUser: createFormState.orderingUser,
      rmbAmount,
    })
      .then((feeType) => {
        if (serviceFeePreviewTokenRef.current !== previewToken) {
          return;
        }

        setCreateServiceFeePreview({ feeType, status: "ready" });
      })
      .catch(() => {
        if (serviceFeePreviewTokenRef.current !== previewToken) {
          return;
        }

        setCreateServiceFeePreview({ feeType: null, status: "error" });
      });
  }, [
    createDialogOpen,
    createFormState.orderType,
    createFormState.orderingUser,
    createFormState.rmbAmount,
    orderCategoryByTypeId,
    supabase,
  ]);

  const handleCreateOrder = useCallback(async () => {
    if (!supabase || createPending || !canCreateOrders) {
      return;
    }

    const currentRate = findTodayCnyExchangeRate(
      orderCurrencyRates,
      createFormState.originalCurrency,
    );

    if (!currentRate) {
      setCreateDialogFeedback({
        tone: "error",
        message: ordersUiCopy.errors.exchangeRateMissing,
      });
      return;
    }

    const parsed = parseCreateOrderForm(
      createFormState,
      orderCategoryByTypeId,
      ordersUiCopy,
    );

    if (!parsed.ok) {
      setCreateDialogFeedback({ tone: "error", message: parsed.message });
      return;
    }

    setCreatePending(true);
    setCreateDialogFeedback(null);
    setPageFeedback(null);

    try {
      const createdOrder = await createAdminOrder(supabase, parsed.payload);
      setCreateDialogOpen(false);
      setCreateDialogFeedback(null);
      setCreateFormState(
        applyOrderExchangeRateToOrderForm(
          createOrderFormState({
            originalCurrency: defaultOriginalCurrency,
            orderEntryUser: currentViewerId ?? "",
            orderType: orderTypeOptions[0]?.id ?? "",
          }),
          orderCurrencyRates,
        ),
      );
      setPageFeedback({
        tone: "success",
        message: t("feedback.createSuccess", {
          orderNumber: createdOrder.order_number,
        }),
      });
      refreshOrdersRoute();
    } catch (error) {
      setCreateDialogFeedback({
        tone: "error",
        message: toOrderErrorMessage(error, ordersUiCopy, sharedCopy),
      });
    } finally {
      setCreatePending(false);
    }
  }, [
    canCreateOrders,
    createFormState,
    createPending,
    currentViewerId,
    defaultOriginalCurrency,
    orderCategoryByTypeId,
    orderTypeOptions,
    ordersUiCopy,
    refreshOrdersRoute,
    setPageFeedback,
    sharedCopy,
    supabase,
    t,
    orderCurrencyRates,
  ]);

  return {
    createDialogFeedback,
    createDialogOpen,
    createFormState,
    createPending,
    createServiceFeePreview,
    handleCreateDialogOpenChange,
    handleCreateOrder,
    openCreateDialog,
    updateCreateFormField,
  };
}
