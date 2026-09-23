import { ResponsiveDataView } from "@/components/ui/responsive-data-view";
import {
  CircleDollarSign,
  PackageCheck,
  Percent,
  TrendingUp,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { WholesaleOrderFilters, WholesaleOrderPageSummary } from "@/lib/wholesale-order-page";
import { formatCurrency, formatPercent } from "./wholesale-display";
import { WholesaleStatGrid } from "./wholesale-ui";
export function WholesaleOrderSummary({
  appliedFilters,
  canViewInternalFields,
  summary,
}: {
  appliedFilters: WholesaleOrderFilters;
  canViewInternalFields: boolean;
  summary: WholesaleOrderPageSummary;
}) {
  const t = useTranslations("WholesaleBusiness.ordersUi");
  const rangeLabel = appliedFilters.searchMode === "exact_all_time"
    ? t("summary.allTime")
    : t("summary.currentRange", {
      from: appliedFilters.orderedFromDate.replaceAll("-", "/"),
      to: appliedFilters.orderedToDate.replaceAll("-", "/"),
    });
  const stats = [
    {
      icon: <PackageCheck className="size-4" />,
      label: t("summary.orderCount"),
      tone: "info" as const,
      value: `${summary.orderCount}`,
    },
    ...(canViewInternalFields ? [{
      icon: <CircleDollarSign className="size-4" />,
      label: t("summary.customerPaymentRmb"),
      tone: "success" as const,
      value: formatCurrency(summary.customerPaymentRmbAmount),
    }] : []),
    ...(canViewInternalFields ? [{
      icon: <TrendingUp className="size-4" />,
      label: t("summary.grossProfit"),
      tone: "success" as const,
      value: formatCurrency(summary.grossProfitAmount),
    },
    {
      icon: <Percent className="size-4" />,
      label: t("summary.averageMargin"),
      tone: "warning" as const,
      value: formatPercent(summary.averageMargin, t("fallbacks.notGenerated")),
    }] : []),
  ];
  return (
    <ResponsiveDataView
      desktop={<WholesaleStatGrid stats={stats} />}
      mobile={
        <details className="group rounded-control-large border border-border-subtle bg-surface-panel">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-primary [&::-webkit-details-marker]:hidden">
            {rangeLabel}<span className="ml-2 group-open:hidden">{t("summary.expand")}</span><span className="ml-2 hidden group-open:inline">{t("summary.collapse")}</span>
          </summary>
          <div className="border-t border-border-subtle p-4">
            <WholesaleStatGrid stats={stats} />
          </div>
        </details>
      }
    />
  );
}
