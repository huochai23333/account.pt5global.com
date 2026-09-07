"use client";

import { useTranslations } from "next-intl";
import type { SalesLead } from "@/lib/sales-leads-types";
import { SalesLeadListRow, type SalesLeadPresentationProps } from "./sales-lead-list-row";

// 宽屏共享列头，窄屏各行带字段标签；表格始终受父容器约束。
export function SalesLeadList({ items, ...actions }: SalesLeadPresentationProps & { items: SalesLead[] }) {
  const t = useTranslations("SalesLeads");
  return <table aria-label={t("list.title")} className="block w-full min-w-0 table-fixed text-left text-sm xl:table" data-testid="sales-lead-table">
    <colgroup className="hidden xl:table-column-group">
      <col className="w-[22%]" /><col className="w-[13%]" /><col className="w-[12%]" />
      <col className="w-[22%]" /><col className="w-[16%]" /><col className="w-[15%]" />
    </colgroup>
    <thead className="sr-only xl:not-sr-only xl:table-header-group"><tr>
      {["name", "location", "priorityStatus", "contacts", "followUp", "actions"].map((key) => <th className="px-3 py-3 font-semibold text-content-muted" key={key} scope="col">{t(`list.${key}`)}</th>)}
    </tr></thead>
    <tbody className="block min-w-0 xl:table-row-group">{items.map((lead) => <SalesLeadListRow key={lead.id} lead={lead} {...actions} />)}</tbody>
  </table>;
}
