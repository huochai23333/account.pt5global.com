import type {
  WholesaleOrderPageSummary,
  WholesaleOrderPageWarning,
} from "./wholesale-order-page";
import type { WholesaleRelatedQueryResult } from "./wholesale-related-query";

export function readWholesaleRelatedRows<T>(
  result: WholesaleRelatedQueryResult,
  warnings: WholesaleOrderPageWarning[],
  area: WholesaleOrderPageWarning["area"],
  message: string,
) {
  if (result.error) {
    warnings.push({ area, message });
    return [] as T[];
  }
  return (result.data ?? []) as T[];
}

export function readWholesaleOrderSummary(
  value: unknown,
): WholesaleOrderPageSummary {
  const summary = readRecord(value);
  return {
    averageMargin:
      summary?.averageMargin === null || summary?.averageMargin === undefined
        ? null
        : readNumber(summary.averageMargin),
    customerPaymentRmbAmount: readNumber(summary?.customerPaymentRmbAmount),
    grossProfitAmount: readNumber(summary?.grossProfitAmount),
    orderCount: readNumber(summary?.orderCount),
    packingFeeAmount: readNumber(summary?.packingFeeAmount),
    partialSettledCount: readNumber(summary?.partialSettledCount),
    ...(summary?.internationalShippingFeeAmount === undefined
      ? {}
      : {
          internationalShippingFeeAmount: readNumber(
            summary.internationalShippingFeeAmount,
          ),
        }),
    ...(summary?.otherFeeAmount === undefined
      ? {}
      : { otherFeeAmount: readNumber(summary.otherFeeAmount) }),
    ...(summary?.productPurchaseAmount === undefined
      ? {}
      : { productPurchaseAmount: readNumber(summary.productPurchaseAmount) }),
    ...(summary?.referralCommissionFeeAmount === undefined
      ? {}
      : {
          referralCommissionFeeAmount: readNumber(
            summary.referralCommissionFeeAmount,
          ),
        }),
    settledCount: readNumber(summary?.settledCount),
    unsettledCount: readNumber(summary?.unsettledCount),
  };
}


export function readWholesaleOrderArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function readWholesaleOrderNumber(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function readWholesaleOrderRecord(
  value: unknown,
): Record<string, unknown> | null {
  return readRecord(value);
}

export function deduplicateWholesaleOrderWarnings(
  warnings: WholesaleOrderPageWarning[],
) {
  return Array.from(
    new Map(
      warnings.map((warning) => [`${warning.area}:${warning.message}`, warning]),
    ).values(),
  );
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function readNumber(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}
