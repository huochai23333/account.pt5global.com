"use client";

import { useTranslations } from "next-intl";
import * as FormControls from "@/components/ui/form-controls";
import { DashboardFilterField } from "@/components/dashboard/dashboard-section-panel";
import type { calculateWholesaleOrderFees } from "@/lib/wholesale-order-fees";

/** 只读字段有明确标签，方便键盘和读屏用户了解自动计算结果。 */
export function WholesaleOrderFeeFields({ fees }: {
  fees: ReturnType<typeof calculateWholesaleOrderFees>;
}) {
  const t = useTranslations("WholesaleBusiness.orderFees");
  return <>
    {([
      ["serviceFee", fees.serviceFee],
      ["cnTaxFee", fees.cnTaxFee],
      ["paymentProcessingFee", fees.paymentProcessingFee],
    ] as const).map(([key, amount]) => (
      <DashboardFilterField key={key} label={t(key)}>
        <FormControls.Input aria-label={t(key)} data-testid={`order-fee-${key}`} readOnly value={amount.toFixed(2)} />
        <p className="mt-1 text-xs leading-5 text-content-muted">{t(`${key}Formula`)}</p>
      </DashboardFilterField>
    ))}
    <p className="text-sm leading-6 text-content-muted md:col-span-2 xl:col-span-4">{t("displayOnly")}</p>
  </>;
}
