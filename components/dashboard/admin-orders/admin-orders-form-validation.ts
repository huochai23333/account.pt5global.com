import type { CreateAdminOrderInput } from "@/lib/admin-orders";
import { isVipMembershipScope } from "@/lib/vip-memberships";

import type { OrdersUiCopy } from "./admin-orders-copy";
import { deriveRmbAmountValue, deriveTransactionRateValue } from "./admin-orders-currency";
import type { OrderFormState } from "./admin-orders-form";
import { parseFlexibleOrderDetails, parseOptionalNumber, parseRequiredNumber } from "./admin-orders-form-parsing";

// 先核对总单字段，再按订单类别组装补充资料，创建和编辑共用这个提交合同。
export function parseCreateOrderForm(
  formState: OrderFormState,
  orderCategoryByTypeId: Map<string, string | null>,
  copy: OrdersUiCopy,
):
  | { ok: true; payload: CreateAdminOrderInput }
  | { ok: false; message: string } {
  const baseParsed = parseBaseOrderForm(formState, copy);

  if (!baseParsed.ok) {
    return baseParsed;
  }

  const orderCategory = orderCategoryByTypeId.get(formState.orderType.trim()) ?? null;

  if (isPurchaseDetailsCategory(orderCategory)) {
    const purchaseSubtype = formState.purchaseSubtype.trim();

    if (!purchaseSubtype) {
      return {
        ok: false,
        message: copy.validation.selectPrompt(copy.fields.purchaseSubtype),
      };
    }

    const purchaseDetails = parseFlexibleOrderDetails(
      formState.purchaseDetails,
      copy.fields.purchaseDetails,
      copy,
    );

    if (typeof purchaseDetails === "string") {
      return { ok: false, message: purchaseDetails };
    }

    return {
      ok: true,
      payload: {
        ...baseParsed.payload,
        supplementary: {
          kind: "purchase",
          subtypeId: purchaseSubtype,
          details: purchaseDetails,
        },
      },
    };
  }

  if (orderCategory === "service") {
    const serviceSubtype = formState.serviceSubtype.trim();
    const serviceDiscount = formState.serviceDiscount.trim();
    const servicePriceOption = formState.servicePriceOption.trim();

    if (!serviceSubtype) {
      return {
        ok: false,
        message: copy.validation.selectPrompt(copy.fields.serviceSubtype),
      };
    }

    if (!serviceDiscount) {
      return {
        ok: false,
        message: copy.validation.selectPrompt(copy.fields.serviceDiscount),
      };
    }

    if (!servicePriceOption) {
      return {
        ok: false,
        message: copy.validation.selectPrompt(copy.fields.servicePrice),
      };
    }

    const serviceDetails = parseFlexibleOrderDetails(
      formState.serviceDetails,
      copy.fields.serviceDetails,
      copy,
    );

    if (typeof serviceDetails === "string") {
      return { ok: false, message: serviceDetails };
    }

    return {
      ok: true,
      payload: {
        ...baseParsed.payload,
        supplementary: {
          kind: "service",
          subtypeId: serviceSubtype,
          discountId: serviceDiscount,
          priceOptionId: servicePriceOption,
          details: serviceDetails,
        },
      },
    };
  }

  if (orderCategory === "vip_recharge") {
    const vipScope = formState.vipScope.trim();

    if (!isVipMembershipScope(vipScope)) {
      return {
        ok: false,
        message: copy.validation.selectPrompt(copy.fields.vipScope),
      };
    }

    const vipDetails = parseFlexibleOrderDetails(
      formState.vipDetails,
      copy.fields.vipDetails,
      copy,
    );

    if (typeof vipDetails === "string") {
      return { ok: false, message: vipDetails };
    }

    return {
      ok: true,
      payload: {
        ...baseParsed.payload,
        supplementary: {
          kind: "vip_recharge",
          vipScope,
          details: vipDetails,
        },
      },
    };
  }

  return baseParsed;
}

function parseBaseOrderForm(
  formState: OrderFormState,
  copy: OrdersUiCopy,
):
  | { ok: true; payload: CreateAdminOrderInput }
  | { ok: false; message: string } {
  const originalCurrency = formState.originalCurrency.trim().toUpperCase();
  const orderEntryUser = formState.orderEntryUser.trim();
  const orderingUser = formState.orderingUser.trim();
  const orderStatus = formState.orderStatus.trim();
  const orderType = formState.orderType.trim();

  if (!originalCurrency) {
    return {
      ok: false,
      message: copy.validation.selectPrompt(copy.fields.originalCurrency),
    };
  }

  if (!orderEntryUser) {
    return {
      ok: false,
      message: copy.validation.selectPrompt(copy.fields.orderEntryUser),
    };
  }

  if (!orderingUser) {
    return {
      ok: false,
      message: copy.validation.selectPrompt(copy.fields.orderingUser),
    };
  }

  if (!orderStatus) {
    return {
      ok: false,
      message: copy.validation.selectPrompt(copy.fields.orderStatus),
    };
  }

  if (!orderType) {
    return {
      ok: false,
      message: copy.validation.selectPrompt(copy.fields.orderType),
    };
  }

  const amount = parseRequiredNumber(formState.amount, copy.fields.amount, copy);
  const dailyExchangeRate = parseRequiredNumber(
    formState.dailyExchangeRate,
    copy.fields.dailyExchangeRate,
    copy,
  );
  const transactionRate = parseRequiredNumber(
    deriveTransactionRateValue(formState.dailyExchangeRate, formState.originalCurrency) || formState.transactionRate,
    copy.fields.transactionRate,
    copy,
  );
  const costAmount = parseOptionalNumber(formState.costAmount, copy.fields.costAmount, copy);

  if (typeof amount === "string") {
    return { ok: false, message: amount };
  }

  if (typeof dailyExchangeRate === "string") {
    return { ok: false, message: dailyExchangeRate };
  }

  if (typeof transactionRate === "string") {
    return { ok: false, message: transactionRate };
  }

  if (typeof costAmount === "string") {
    return { ok: false, message: costAmount };
  }

  const rmbAmount = parseRequiredNumber(
    deriveRmbAmountValue(amount, transactionRate),
    copy.fields.rmbAmount,
    copy,
  );

  if (typeof rmbAmount === "string") {
    return { ok: false, message: rmbAmount };
  }

  return {
    ok: true,
    payload: {
      originalCurrency,
      amount,
      dailyExchangeRate,
      transactionRate,
      rmbAmount,
      costAmount,
      orderEntryUser,
      orderingUser,
      orderStatus,
      orderType,
    },
  };
}

export function isPurchaseDetailsCategory(category: string | null | undefined) {
  return category === "purchase";
}
