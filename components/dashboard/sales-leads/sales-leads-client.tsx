"use client";

import { BriefcaseBusiness, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { DashboardPageShell, DashboardAccessState } from "@/components/dashboard/dashboard-page-shell";
import { DashboardSectionHeader } from "@/components/dashboard/dashboard-section-header";
import { DashboardSegmentedTabs } from "@/components/dashboard/dashboard-segmented-tabs";
import { Button } from "@/components/ui/button";
import type { SalesLeadPageData } from "@/lib/sales-leads-types";
import { SalesLeadActionDialog } from "./sales-lead-action-dialog";
import { SalesLeadDetailDialog } from "./sales-lead-detail-dialog";
import { SalesLeadRules } from "./sales-lead-rules";
import { SalesLeadsResultsSection } from "./sales-leads-results-section";
import { SalesLeadsSyncStatus } from "./sales-leads-sync-status";
import { useSalesLeadsPage } from "./use-sales-leads-page";
import { useSalesLeadsDisplay } from "./use-sales-leads-display";
import { SalesLeadCustomerDialog } from "./sales-lead-customer-dialog";
import { useSalesLeadCustomer } from "./use-sales-lead-customer";
import { FeedbackNotice } from "@/components/ui/feedback-notice";

// 页面只组装各区块；业务请求、展示状态与行内容分别由独立模块负责。
export function SalesLeadsClient({ initialData }: { initialData: SalesLeadPageData }) {
  const t = useTranslations("SalesLeads");
  const view = useSalesLeadsPage(initialData);
  const display = useSalesLeadsDisplay(view.data);
  const { setDetail, setBoard, refresh } = view;
  const afterCustomerSaved = useCallback(async () => {
    setDetail(null);
    setBoard("converted");
    await refresh("converted");
  }, [setDetail, setBoard, refresh]);
  const customer = useSalesLeadCustomer(afterCustomerSaved);
  if (!initialData.hasPermission) {
    return <DashboardPageShell><DashboardAccessState description={t("states.noPermissionDescription")} kind="permission" title={t("states.noPermissionTitle")} /></DashboardPageShell>;
  }
  return <DashboardPageShell header={<DashboardSectionHeader
    actions={view.data.canManage ? <Button disabled={view.pending === "sync"} onClick={() => void view.syncNow()} variant="outline" wrap><RefreshCw className="size-4" />{t("actions.syncNow")}</Button> : undefined}
    badge={t("header.badge")} badgeIcon={<BriefcaseBusiness className="size-3.5" />}
    description={t("header.description")} presentation="overview" title={t("header.title")}
  />}>
    <SalesLeadRules />
    <DashboardSegmentedTabs onChange={view.setBoard} options={display.boardOptions} pendingValue={view.pending === "refresh" ? view.board : null} value={view.board} />
    <SalesLeadsSyncStatus data={view.data} syncNotice={view.syncNotice} />
    {customer.notice ? <FeedbackNotice tone={customer.notice === "saved" ? "success" : "info"}>{t(`customer.${customer.notice}`)}</FeedbackNotice> : null}
    <SalesLeadsResultsSection display={display} onConvert={(lead) => void customer.open(lead)} view={view} />
    <SalesLeadDetailDialog canManage={view.data.canManage} detail={view.action || customer.detail ? null : view.detail} now={display.now} onAction={view.setAction} onConvert={(lead) => void customer.open(lead)} onOpenChange={(open) => { if (!open) view.setDetail(null); }} />
    <SalesLeadActionDialog action={view.action} errorCode={view.error} leadId={view.detail?.lead.id ?? null} onClose={() => view.setAction(null)} onSubmit={view.submitAction} pending={Boolean(view.detail && view.pending === view.detail.lead.id)} salespeople={view.data.salespeople} />
    {customer.detail ? <SalesLeadCustomerDialog detail={customer.detail} errorCode={customer.errorCode} key={`${customer.detail.lead.id}-${customer.detail.lead.current_assignment_id}`} onClose={customer.close} onSubmit={customer.submit} pending={customer.pending} /> : null}
  </DashboardPageShell>;
}
