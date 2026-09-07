import { LayoutGrid, List } from "lucide-react";
import { useTranslations } from "next-intl";
import { DashboardSearchInput } from "@/components/dashboard/dashboard-section-panel";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { SalesLeadPerson } from "@/lib/sales-leads-types";
import type { SalesLeadViewMode } from "./use-sales-leads-display";

// 搜索、人员筛选和展示切换共用可换行工具栏，窄屏不为隐藏的筛选预留空列。
export function SalesLeadsToolbar({ search, onSearch, showAssignee, assignee, people, onAssignee, mode, onMode }: {
  search: string; onSearch: (value: string) => void; showAssignee: boolean;
  assignee: string | null; people: SalesLeadPerson[]; onAssignee: (value: string | null) => void;
  mode: SalesLeadViewMode; onMode: (mode: SalesLeadViewMode) => void;
}) {
  const t = useTranslations("SalesLeads");
  return <div className="flex w-full min-w-0 flex-wrap items-center gap-3">
    <div className="min-w-0 basis-full sm:min-w-56 sm:flex-1 sm:basis-auto">
      <DashboardSearchInput ariaLabel={t("filters.searchLabel")} onChange={onSearch} placeholder={t("filters.searchPlaceholder")} value={search} />
    </div>
    {showAssignee ? <div className="min-w-0 basis-full sm:w-52 sm:basis-auto"><Select aria-label={t("filters.assignee")} onValueChange={(value) => onAssignee(value || null)} options={[{ value: "", label: t("filters.allSalespeople") }, ...people.map((person) => ({ value: person.user_id, label: person.name }))]} value={assignee ?? ""} /></div> : null}
    <div aria-label={t("view.label")} className="flex shrink-0 gap-2" role="group">
      <Button aria-pressed={mode === "list"} onClick={() => onMode("list")} variant={mode === "list" ? "primary" : "outline"}><List className="size-4" />{t("view.list")}</Button>
      <Button aria-pressed={mode === "card"} onClick={() => onMode("card")} variant={mode === "card" ? "primary" : "outline"}><LayoutGrid className="size-4" />{t("view.card")}</Button>
    </div>
  </div>;
}
