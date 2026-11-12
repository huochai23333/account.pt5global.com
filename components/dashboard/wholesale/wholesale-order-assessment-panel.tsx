"use client";
import { UiMessage } from "@/components/i18n/ui-message";
import { LoaderCircle, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import type { WholesaleOrderAssessmentFilters } from "@/lib/wholesale-order-assessment-types";
import { useWholesaleOrderAssessment } from "./use-wholesale-order-assessment";
type WholesaleOrderAssessmentPanelProps = {
  filters: WholesaleOrderAssessmentFilters;
  matchedOrderCount: number;
};
export function WholesaleOrderAssessmentPanel({
  filters,
  matchedOrderCount,
}: WholesaleOrderAssessmentPanelProps) {
  const t = useTranslations("WholesaleBusiness.ordersUi");
  const {
    assessment,
    failed,
    generateAssessment,
    hasStaleAssessment,
    pending,
  } = useWholesaleOrderAssessment(filters);
  return (
    <div>
      {/* 闲置时只显示真正可执行的操作，不再用说明面板重复解释筛选结果。 */}
      <div className="flex justify-end">
        <Button
          variant="primary"
          size="compact"
          className="disabled:opacity-60"
          disabled={pending || matchedOrderCount === 0}
          onClick={() => void generateAssessment()}
          type="button"
        >
          {pending ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          {pending ? t("assessment.pending") : t("assessment.generate")}
        </Button>
      </div>

      {/* 只有没有可评估订单、请求失败或已经生成结果时，才增加必要反馈。 */}
      {matchedOrderCount === 0 ? (
        <p className="mt-3 rounded-control-default bg-surface-inset px-4 py-3 text-sm leading-6 text-content-muted">
          <UiMessage id="components_dashboard_wholesale_wholesale_order_assessment_panel.text004" />
        </p>
      ) : null}

      {failed ? (
        <p role="alert" className="mt-3 rounded-control-default border border-border-subtle bg-surface-inset px-4 py-3 text-sm leading-6 text-content-muted">
          {t("assessment.failed")}
        </p>
      ) : null}

      {assessment ? (
        <Surface
          as="div"
          className="mt-3 text-sm leading-7 text-content-strong"
          data-testid="wholesale-order-assessment-output"
          padding="regular"
          variant="interactive"
        >
          {hasStaleAssessment ? (
            <p className="mb-3 rounded-control-compact bg-surface-inset px-3 py-2 text-xs leading-5 text-content-muted">
              <UiMessage id="components_dashboard_wholesale_wholesale_order_assessment_panel.text005" />
            </p>
          ) : null}
          <p className="whitespace-pre-wrap break-words">{assessment.trim()}</p>
        </Surface>
      ) : null}
    </div>
  );
}
