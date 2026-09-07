import { UsersRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { DashboardListSection } from "@/components/dashboard/dashboard-section-panel";
import { Button } from "@/components/ui/button";
import { SalesLeadCards } from "./sales-lead-cards";
import { SalesLeadList } from "./sales-lead-list";
import { SalesLeadsToolbar } from "./sales-leads-toolbar";
import type { useSalesLeadsPage } from "./use-sales-leads-page";
import type { useSalesLeadsDisplay } from "./use-sales-leads-display";

// 两种布局共用错误、空结果、筛选和分页，切换仅改变同一批数据的呈现方式。
export function SalesLeadsResultsSection({ view, display }: {
  view: ReturnType<typeof useSalesLeadsPage>; display: ReturnType<typeof useSalesLeadsDisplay>;
}) {
  const t = useTranslations("SalesLeads");
  const Presentation = display.mode === "card" ? SalesLeadCards : SalesLeadList;
  return <DashboardListSection ariaLabel={t("list.title")} actions={<SalesLeadsToolbar
    search={view.search} onSearch={view.setSearch} showAssignee={view.data.canManage && view.board === "all_claimed"}
    assignee={view.assigneeUserId} onAssignee={view.setAssigneeUserId} people={view.data.salespeople}
    mode={display.mode} onMode={display.setMode}
  />}>
    {view.error && !view.action ? <p className="mb-4 rounded-record-card border border-status-danger-border bg-status-danger-soft px-4 py-3 text-sm text-status-danger">{t(`errors.${view.error}`)}</p> : null}
    <div className="min-w-0" data-testid="sales-lead-list">
      {view.data.items.length ? <Presentation canManage={view.data.canManage} items={view.data.items} now={display.now} onClaim={(id) => void view.claim(id)} onOpen={(lead) => void view.openDetail(lead)} pending={view.pending} /> : <div className="flex min-h-48 flex-col items-center justify-center text-center"><UsersRound className="size-8 text-content-subtle" /><p className="mt-3 font-semibold text-content-strong">{t("states.emptyTitle")}</p><p className="mt-1 text-sm text-content-muted">{t("states.emptyDescription")}</p></div>}
    </div>
    {view.data.totalCount > view.data.limit ? <div className="mt-5 flex flex-wrap justify-end gap-2">
      <Button disabled={view.data.offset === 0} onClick={() => void view.refresh(view.board, Math.max(0, view.data.offset - view.data.limit))} variant="outline">{t("pagination.previous")}</Button>
      <Button disabled={view.data.offset + view.data.limit >= view.data.totalCount} onClick={() => void view.refresh(view.board, view.data.offset + view.data.limit)} variant="outline">{t("pagination.next")}</Button>
    </div> : null}
  </DashboardListSection>;
}
