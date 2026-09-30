"use client";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { DashboardListSection } from "../dashboard-section-panel";
import { useExchangeRateRecalculation } from "./use-exchange-rate-recalculation";
import { ExchangeRateRecalculationItems } from "./exchange-rate-recalculation-items";

/** 页面区块只负责组装按钮、状态和逐笔预览，查询与计算均在独立模块。 */
export function ExchangeRateRecalculationSection() {
  const t = useTranslations("ExchangeRates.recalculation");
  const state = useExchangeRateRecalculation();
  const ready = state.preview?.items.some(item => item.status === "ready") ?? false;
  return <DashboardListSection title={t("title")} eyebrow={t("eyebrow")} bodyClassName="flex flex-col gap-4">
    <p className="text-sm leading-6 text-content-muted">{t("description")}</p>
    {!state.verified ? <p role="status" className="text-sm text-content-muted">{t("verificationRequired")}</p> : null}
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" disabled={state.pending || !state.verified} loading={state.pendingAction === "preview"} onClick={() => void state.prepare()}>{t("preview")}</Button>
      <Button type="button" variant="primary" disabled={state.pending || !state.verified || !ready || state.preview?.run.status !== "preview"} loading={state.pendingAction === "execute"} onClick={() => void state.execute()}>{t("execute")}</Button>
      <Button type="button" variant="outline" disabled={state.pending} loading={state.pendingAction === "refresh"} onClick={() => void state.reload()}>{t("refresh")}</Button>
    </div>
    {state.message ? <p role="alert">{state.message}</p> : null}
    {state.preview ? <div className="min-w-0">
      <p role="status" className="text-sm">{t(`status.${state.preview.run.status}`)}</p>
      <p className="mt-2 break-all text-xs text-content-muted">{t("receipt", { id: state.preview.run.id })}</p>
      <p className="mt-2 text-sm">{t("scope", { ordinary: state.preview.run.scope_counts.ordinary, wholesale: state.preview.run.scope_counts.wholesale, settlements: state.preview.run.scope_counts.settlements, commissions: state.preview.run.scope_counts.wholesaleCommissions })}</p>
      {state.preview.run.status !== "preview" ? <p className="mt-2 text-sm">{t("result", { succeeded: state.preview.run.proof.succeededCount ?? 0, failed: state.preview.run.proof.failedCount ?? 0, rows: state.preview.run.proof.affectedRows ?? 0 })}</p> : null}
      <ExchangeRateRecalculationItems items={state.preview.items} />
    </div> : null}
  </DashboardListSection>;
}
