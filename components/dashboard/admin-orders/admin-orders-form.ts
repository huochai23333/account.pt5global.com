import {
  type AdminOrderRow,
  type AdminOrderSupplementaryDetail,
} from "@/lib/admin-orders";

import { normalizeOptionalString } from "../dashboard-shared-ui";

import {
  deriveTransactionRateValue,
} from "./admin-orders-currency";
import {
  formatCurrencyCode,
  formatEditableNumericValue,
} from "./admin-orders-display";
import {
  stringifyOrderDetailsForTextarea,
} from "./admin-orders-form-parsing";

export type OrderFormState = {
  originalCurrency: string;
  amount: string;
  dailyExchangeRate: string;
  transactionRate: string;
  rmbAmount: string;
  costAmount: string;
  orderEntryUser: string;
  orderingUser: string;
  orderStatus: string;
  orderType: string;
  purchaseSubtype: string;
  purchaseDetails: string;
  serviceSubtype: string;
  serviceDiscount: string;
  servicePriceOption: string;
  serviceDetails: string;
  vipScope: string;
  vipDetails: string;
};

export function createOrderFormState(defaults?: {
  originalCurrency?: string;
  orderEntryUser?: string;
  orderType?: string;
}): OrderFormState {
  return {
    originalCurrency: defaults?.originalCurrency ?? "",
    amount: "",
    dailyExchangeRate: "",
    transactionRate: "",
    rmbAmount: "",
    costAmount: "",
    orderEntryUser: defaults?.orderEntryUser ?? "",
    orderingUser: "",
    orderStatus: "pending",
    orderType: defaults?.orderType ?? "",
    purchaseSubtype: "",
    purchaseDetails: "",
    serviceSubtype: "",
    serviceDiscount: "",
    servicePriceOption: "",
    serviceDetails: "",
    vipScope: "retail",
    vipDetails: "",
  };
}

// 编辑时先用总单填充基本字段，再按补充资料类型恢复该单的扩展字段。
export function createOrderFormStateFromOrder(
  order: AdminOrderRow,
  supplementaryDetail?: AdminOrderSupplementaryDetail | null,
): OrderFormState {
  return {
    originalCurrency: formatCurrencyCode(order.original_currency),
    amount: formatEditableNumericValue(order.amount),
    dailyExchangeRate: formatEditableNumericValue(order.daily_exchange_rate),
    transactionRate:
      formatEditableNumericValue(order.transaction_rate) ||
      deriveTransactionRateValue(order.daily_exchange_rate, order.original_currency ?? ""),
    rmbAmount: formatEditableNumericValue(order.rmb_amount),
    costAmount: formatEditableNumericValue(order.cost_amount),
    orderEntryUser: normalizeOptionalString(order.order_entry_user) ?? "",
    orderingUser: normalizeOptionalString(order.ordering_user) ?? "",
    orderStatus: normalizeOptionalString(order.order_status) ?? "pending",
    orderType: normalizeOptionalString(order.order_type) ?? "",
    purchaseSubtype:
      supplementaryDetail?.kind === "purchase" ? supplementaryDetail.subtypeId : "",
    purchaseDetails:
      supplementaryDetail?.kind === "purchase"
        ? stringifyOrderDetailsForTextarea(supplementaryDetail.details)
        : "",
    serviceSubtype:
      supplementaryDetail?.kind === "service" ? supplementaryDetail.subtypeId : "",
    serviceDiscount:
      supplementaryDetail?.kind === "service" ? supplementaryDetail.discountId : "",
    servicePriceOption:
      supplementaryDetail?.kind === "service" ? supplementaryDetail.priceOptionId : "",
    serviceDetails:
      supplementaryDetail?.kind === "service"
        ? stringifyOrderDetailsForTextarea(supplementaryDetail.details)
        : "",
    vipScope:
      supplementaryDetail?.kind === "vip_recharge" ? supplementaryDetail.vipScope : "retail",
    vipDetails:
      supplementaryDetail?.kind === "vip_recharge"
        ? stringifyOrderDetailsForTextarea(supplementaryDetail.details)
        : "",
  };
}

export function applyOrderFormDefaults(
  formState: OrderFormState,
  defaults: {
    orderEntryUser: string;
    orderType: string;
  },
) {
  return {
    ...formState,
    orderEntryUser: formState.orderEntryUser || defaults.orderEntryUser,
    orderType: formState.orderType || defaults.orderType,
  };
}
