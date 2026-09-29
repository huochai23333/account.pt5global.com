"use client";
import { useTranslations } from "next-intl";
import type { RecalculationItem } from "@/lib/exchange-rate-recalculation";
import { recalculationFailureKey } from "@/lib/exchange-rate-recalculation-failures";
import { MetaGrid, MetaItem, RecordCard } from "@/components/ui/data-display";
import { useLocale } from "@/components/i18n/locale-provider";
import { formatExchangeRateQuoteTime } from "./exchange-rates-utils";

type SnapshotRow = Record<string, unknown>;
function rows(value: unknown): SnapshotRow[] { return Array.isArray(value) ? value as SnapshotRow[] : []; }
/** 同一组卡片适配桌面和手机；编号允许换行，逐笔展示引用报价和佣金差额。 */
export function ExchangeRateRecalculationItems({ items }: { items: RecalculationItem[] }) {
  const t = useTranslations("ExchangeRates.recalculation");
  const { locale } = useLocale();
  return <div className="mt-4 grid min-w-0 gap-3 lg:grid-cols-2">{items.map(item => {
    const before = rows(item.before_snapshot.commissions);
    const after = rows(item.after_snapshot?.commissions);
    const quotes = rows(item.after_snapshot?.quotes ?? item.before_snapshot.quotes);
    const order = item.before_snapshot.order as SnapshotRow;
    return <RecordCard key={item.id} surface="inset">
      <p className="break-all text-sm font-semibold">{String(order?.order_number ?? item.order_id)}</p>
      <p className="mt-1 text-xs">{t(`itemStatus.${item.status}`)}</p>
      <MetaGrid className="mt-3 grid-cols-2">
        <MetaItem label={t("oldAmount")}>{item.delta.oldRmb.toFixed(2)}</MetaItem>
        <MetaItem label={t("newAmount")}>{item.delta.newRmb?.toFixed(2) ?? "—"}</MetaItem>
        <MetaItem label={t("difference")}>{item.delta.difference?.toFixed(2) ?? "—"}</MetaItem>
      </MetaGrid>
      {quotes.map(quote => <p key={String(quote.id)} className="mt-2 break-all text-xs text-content-muted">
        {t("quote", { currency: String(quote.original_currency), date: String(quote.rate_date), rate: String(quote.daily_exchange_rate), id: String(quote.id), time: formatExchangeRateQuoteTime(String(quote.provider_updated_at), locale) })}
      </p>)}
      {after.map(commission => <p key={String(commission.id)} className="mt-2 break-all text-xs">
        {t("commission", { id: String(commission.id), old: String(before.find(row => row.id === commission.id)?.commission_amount_rmb ?? 0), next: String(commission.commission_amount_rmb) })}
      </p>)}
      {item.message ? <p role="alert" className="mt-2 text-sm">{t(`failure.${recalculationFailureKey(item.message)}`)}</p> : null}
    </RecordCard>;
  })}</div>;
}
