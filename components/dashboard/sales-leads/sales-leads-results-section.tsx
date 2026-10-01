import { UsersRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { DashboardListSection } from "@/components/dashboard/dashboard-section-panel";
import { Button } from "@/components/ui/button";
import { DashboardPaginationFooter } from "../dashboard-collection-section";
import { getDashboardPaginationState } from "@/lib/dashboard-pagination";
import type { SalesLead } from "@/lib/sales-leads-types";
import { SalesLeadCards } from "./sales-lead-cards";
import { SalesLeadList } from "./sales-lead-list";
import { SalesLeadsToolbar } from "./sales-leads-toolbar";
import type { useSalesLeadsPage } from "./use-sales-leads-page";
import type { useSalesLeadsDisplay } from "./use-sales-leads-display";

// 两种布局共用错误、空结果、筛选和分页，切换仅改变同一批数据的呈现方式。
export function SalesLeadsResultsSection({ view, display, onConvert }: {
  view: ReturnType<typeof useSalesLeadsPage>; display: ReturnType<typeof useSalesLeadsDisplay>;
  onConvert: (lead: SalesLead) => void;
}) {
  const t = useTranslations("SalesLeads");
  const Presentation = display.mode === "card" ? SalesLeadCards : SalesLeadList;
  const firstUse = view.board === "mine" && view.data.totalCount === 0 && !view.search.trim() && !view.assigneeUserId;
  const filteredEmpty = Boolean(view.search.trim() || view.assigneeUserId);
  // 线索原本按偏移量查询；显示层统一转换为每页二十条的页码和范围。
  const pagination = getDashboardPaginationState(view.data.totalCount, Math.floor(view.data.offset / 20) + 1);
  return <DashboardListSection ariaLabel={t("list.title")} actions={<SalesLeadsToolbar
    search={view.search} onSearch={view.setSearch} showAssignee={view.data.canManage && view.board === "all_claimed"}
    assignee={view.assigneeUserId} onAssignee={view.setAssigneeUserId} people={view.data.salespeople}
    mode={display.mode} onMode={display.setMode}
  />}>
    {view.error && !view.action ? <p className="mb-4 rounded-record-card border border-status-danger-border bg-status-danger-soft px-4 py-3 text-sm text-status-danger">{t(`errors.${view.error}`)}</p> : null}
    <div className="min-w-0" data-testid="sales-lead-list">
      {view.data.items.length ? <Presentation canManage={view.data.canManage} items={view.data.items} now={display.now} onClaim={(id) => void view.claim(id)} onConvert={onConvert} onOpen={(lead) => void view.openDetail(lead)} pending={view.pending} /> : !view.error ? <div className="flex min-h-48 flex-col items-center justify-center text-center"><UsersRound className="size-8 text-content-subtle" /><p className="mt-3 font-semibold text-content-strong">{t(firstUse ? "states.firstUseTitle" : "states.emptyTitle")}</p><p className="mt-1 text-sm text-content-muted">{t(firstUse ? "states.firstUseDescription" : "states.emptyDescription")}</p>{firstUse ? <Button className="mt-4" onClick={() => view.setBoard("hall")} type="button">{t("states.openHall")}</Button> : filteredEmpty ? <Button className="mt-4" onClick={() => { view.setSearch(""); view.setAssigneeUserId(null); }} type="button" variant="outline">{t("states.clearSearch")}</Button> : null}</div> : null}
    </div>
    <DashboardPaginationFooter {...pagination} pending={view.pending !== null}
      onPreviousPage={() => void view.refresh(view.board, Math.max(0, view.data.offset - 20))}
      onNextPage={() => void view.refresh(view.board, view.data.offset + 20)} />
  </DashboardListSection>;
}
