import { type AdminOrdersFilters } from "@/lib/admin-orders";
import { getDefaultOrderDateRange } from "@/lib/order-date-range";

import {
  deriveRmbAmountValue,
  deriveTransactionRateValue,
  type OrderFormState,
} from "./admin-orders-utils";

type OrdersTranslator = (
  key: string,
  values?: Record<string, string | number | Date>,
) => string;

export type OrdersClientMode = "admin" | "salesman" | "client";

export function createDefaultAdminOrderFilters(): AdminOrdersFilters {
  const dateRange = getDefaultOrderDateRange();

  return {
    createdFromDate: dateRange.fromDate,
    createdToDate: dateRange.toDate,
    orderEntryUser: "",
    orderNumber: "",
    orderingUser: "",
    searchMode: "date_range",
  };
}

export type OrdersViewConfig = {
  title: string;
  createTitle: string;
  createDescription: string;
  noPermissionDescription: string;
  noCreateTargetHint: string | null;
  allowCreate: boolean;
  allowEdit: boolean;
  allowDelete: boolean;
  allowCost: boolean;
  showOrderEntryFilter: boolean;
  showOrderingFilter: boolean;
  showOrderEntryColumn: boolean;
  showOrderingColumn: boolean;
  showCreatedAtColumn: boolean;
  showOrderEntryDetail: boolean;
  showOrderingDetail: boolean;
  lockOrderEntryToCurrentViewer: boolean;
  limitOrderingUsersToClients: boolean;
};

export function getOrdersViewConfig(
  mode: OrdersClientMode,
  t: OrdersTranslator,
): OrdersViewConfig {
  if (mode === "salesman") {
    return {
      title: t("modes.salesman.title"),
      createTitle: t("modes.salesman.createTitle"),
      createDescription: t("modes.salesman.createDescription"),
      noPermissionDescription: t("modes.salesman.noPermissionDescription"),
      noCreateTargetHint: t("modes.salesman.noCreateTargetHint"),
      allowCreate: true,
      allowEdit: false,
      allowDelete: false,
      allowCost: false,
      showOrderEntryFilter: false,
      showOrderingFilter: true,
      showOrderEntryColumn: false,
      showOrderingColumn: true,
      showCreatedAtColumn: true,
      showOrderEntryDetail: false,
      showOrderingDetail: true,
      lockOrderEntryToCurrentViewer: true,
      limitOrderingUsersToClients: true,
    };
  }

  if (mode === "client") {
    return {
      title: t("modes.client.title"),
      createTitle: t("modes.client.createTitle"),
      createDescription: "",
      noPermissionDescription: t("modes.client.noPermissionDescription"),
      noCreateTargetHint: null,
      allowCreate: false,
      allowEdit: false,
      allowDelete: false,
      allowCost: false,
      showOrderEntryFilter: false,
      showOrderingFilter: false,
      showOrderEntryColumn: false,
      showOrderingColumn: false,
      showCreatedAtColumn: true,
      showOrderEntryDetail: false,
      showOrderingDetail: false,
      lockOrderEntryToCurrentViewer: false,
      limitOrderingUsersToClients: false,
    };
  }

  return {
    title: t("modes.admin.title"),
    createTitle: t("modes.admin.createTitle"),
    createDescription: t("modes.admin.createDescription"),
    noPermissionDescription: t("modes.admin.noPermissionDescription"),
    noCreateTargetHint: null,
    allowCreate: true,
    allowEdit: true,
    allowDelete: true,
    allowCost: true,
    showOrderEntryFilter: true,
    showOrderingFilter: true,
    showOrderEntryColumn: true,
    showOrderingColumn: true,
    showCreatedAtColumn: false,
    showOrderEntryDetail: true,
    showOrderingDetail: true,
    lockOrderEntryToCurrentViewer: false,
    limitOrderingUsersToClients: false,
  };
}

export function getNextOrderFormState<Key extends keyof OrderFormState>(
  current: OrderFormState,
  key: Key,
  value: OrderFormState[Key],
) {
  const nextState = {
    ...current,
    [key]: value,
  };

  if (key === "dailyExchangeRate") {
    nextState.transactionRate = deriveTransactionRateValue(String(value), nextState.originalCurrency);
    nextState.rmbAmount = deriveRmbAmountValue(
      nextState.amount,
      nextState.transactionRate,
    );
  }

  if (key === "amount") {
    nextState.rmbAmount = deriveRmbAmountValue(
      nextState.amount,
      nextState.transactionRate,
    );
  }

  if (key === "orderType") {
    nextState.purchaseSubtype = "";
    nextState.purchaseDetails = "";
    nextState.serviceSubtype = "";
    nextState.serviceDiscount = "";
    nextState.servicePriceOption = "";
    nextState.serviceDetails = "";
    nextState.vipScope = "retail";
    nextState.vipDetails = "";
  }

  return nextState;
}

export function areOrderFiltersEqual(
  left: AdminOrdersFilters,
  right: AdminOrdersFilters,
) {
  return (
    left.createdFromDate === right.createdFromDate &&
    left.createdToDate === right.createdToDate &&
    left.orderEntryUser === right.orderEntryUser &&
    left.orderNumber === right.orderNumber &&
    left.orderingUser === right.orderingUser &&
    left.searchMode === right.searchMode
  );
}
