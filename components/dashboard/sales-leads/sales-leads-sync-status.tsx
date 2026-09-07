import { useLocale, useTranslations } from "next-intl";
import type { SalesLeadPageData } from "@/lib/sales-leads-types";
import { formatLeadDate } from "./sales-leads-display";

// 只从内部错误中提取固定格式日期；原始异常文本不直接显示给业务人员。
export function SalesLeadsSyncStatus({ data }: { data: SalesLeadPageData }) {
  const t = useTranslations("SalesLeads");
  const locale = useLocale();
  if (!data.canManage) return null;
  const error = data.syncState?.last_error;
  const dates = [...new Set(Array.from(error?.matchAll(/source_json_missing:(\d{4}-\d{2}-\d{2})/g) ?? [], (match) => match[1]))];
  return <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2 rounded-record-card border border-border-subtle bg-surface-inset px-4 py-3 text-sm text-content-muted">
    <span>{t("sync.lastSuccess")}: {formatLeadDate(data.syncState?.last_successful_at ?? null, locale)}</span>
    <span>{t("sync.recentRuns")}: {data.recentImportRuns.length}</span>
    {error ? <span className="min-w-0 break-words text-status-danger [overflow-wrap:anywhere]">{dates.length ? t("sync.missingSource", { dates: dates.join(", ") }) : t("sync.failed")}</span> : null}
  </div>;
}
