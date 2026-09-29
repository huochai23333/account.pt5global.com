import type {
  OrderDiscountTypeOption,
  ServiceOrderPriceOption,
} from "@/lib/admin-orders";

import {
  deriveRmbAmountValue,
  deriveTransactionRateValue,
} from "./admin-orders-currency";
import { parseNumericValue } from "./admin-orders-display";
import type { OrderFormState } from "./admin-orders-form";

export function applyServicePricingToOrderForm(
  formState: OrderFormState,
  options: {
    orderCategory: string | null;
    orderDiscountOptions: OrderDiscountTypeOption[];
    serviceOrderPriceOptions: ServiceOrderPriceOption[];
    syncCostAmount?: boolean;
  },
): OrderFormState {
  if (options.orderCategory !== "service") {
    return formState;
  }

  const serviceSubtype = formState.serviceSubtype.trim();
  const priceOptions = options.serviceOrderPriceOptions.filter(
    (option) => option.service_order_type_id === serviceSubtype,
  );
  const selectedPriceOption = resolveSelectedServicePriceOption(
    priceOptions,
    formState.servicePriceOption,
  );
  const selectedDiscount = resolveSelectedServiceDiscount(
    options.orderDiscountOptions,
    formState.serviceDiscount,
  );
  const amount = calculateServiceOrderAmount(
    selectedPriceOption?.amount_usd ?? null,
    selectedDiscount?.discount_ratio ?? null,
  );
  const amountValue = amount === null ? "" : formatServiceAmountForInput(amount);
  const costAmountValue =
    selectedPriceOption?.cost_amount_rmb === undefined
      ? ""
      : formatServiceAmountForInput(selectedPriceOption.cost_amount_rmb);
  const nextState = {
    ...formState,
    originalCurrency: "USD",
    servicePriceOption: selectedPriceOption?.id ?? "",
    serviceDiscount: selectedDiscount?.id ?? "",
    amount: amountValue,
    ...(options.syncCostAmount ? { costAmount: costAmountValue } : {}),
  };

  return {
    ...nextState,
    transactionRate: deriveTransactionRateValue(nextState.dailyExchangeRate, "USD"),
    rmbAmount: deriveRmbAmountValue(amountValue, deriveTransactionRateValue(nextState.dailyExchangeRate, "USD")),
  };
}

export function calculateServiceOrderAmount(
  amountUsd: number | string | null | undefined,
  discountRatio: number | string | null | undefined,
) {
  const amount = parseNumericValue(amountUsd);
  const discount = parseNumericValue(discountRatio);

  if (amount === null || discount === null) {
    return null;
  }

  return Math.round(amount * discount * 100) / 100;
}

export function formatServicePriceOptionLabel(
  option: ServiceOrderPriceOption,
) {
  return `${option.display_name} / $${formatServiceAmountForInput(option.amount_usd)}`;
}

function resolveSelectedServicePriceOption(
  priceOptions: ServiceOrderPriceOption[],
  currentId: string,
) {
  const normalizedCurrentId = currentId.trim();
  return (
    priceOptions.find((option) => option.id === normalizedCurrentId) ??
    priceOptions[0] ??
    null
  );
}

function resolveSelectedServiceDiscount(
  discountOptions: OrderDiscountTypeOption[],
  currentId: string,
) {
  const normalizedCurrentId = currentId.trim();
  return (
    discountOptions.find((option) => option.id === normalizedCurrentId) ??
    discountOptions.find((option) => parseNumericValue(option.discount_ratio) === 1) ??
    discountOptions[0] ??
    null
  );
}

function formatServiceAmountForInput(value: number | string) {
  const parsed = parseNumericValue(value);

  if (parsed === null) {
    return "";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(parsed) ? 0 : 2,
    useGrouping: false,
  }).format(parsed);
}
