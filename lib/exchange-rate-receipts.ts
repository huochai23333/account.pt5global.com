import type { SupabaseClient } from "@supabase/supabase-js";
import { EXCHANGE_RATE_SELECT, type ExchangeRateRow } from "./exchange-rate-types";
import { withRequestTimeout } from "./request-timeout";

type QuoteReceipt = {
  baseCurrency: string;
  targetCurrency: "CNY";
  rateDate?: string;
  rate?: number;
  rateRecordId?: string;
  quotedAt?: string;
  source?: string;
  dayFinal?: boolean;
};

// 一批历史补充最多包含 310 条报价。分段读取，避免把所有 UUID 放进同一个请求地址。
const IDS_PER_REQUEST = 80;

/** 获取结果中的每个成功记录，都必须与独立读取的买入价、日期、币种和报价时间一致。 */
export async function verifyExchangeRateReceipts(supabase: SupabaseClient, receipts: QuoteReceipt[]) {
  if (!receipts.length) return [];
  if (receipts.some(row => !row.rateRecordId || !row.quotedAt || !row.rateDate || !Number.isFinite(row.rate))) {
    throw new Error("汇率保存凭证不完整，请刷新后核对。");
  }
  const rows = new Map<string, ExchangeRateRow>();
  for (let start = 0; start < receipts.length; start += IDS_PER_REQUEST) {
    const ids = receipts.slice(start, start + IDS_PER_REQUEST).map(row => row.rateRecordId!);
    const { data, error } = await withRequestTimeout(supabase.from("exchange_rate")
      .select(EXCHANGE_RATE_SELECT)
      .in("id", ids)
      .returns<ExchangeRateRow[]>());
    if (error) throw error;
    for (const row of data ?? []) rows.set(row.id, row);
  }
  if (receipts.some(receipt => {
    const row = rows.get(receipt.rateRecordId!);
    return !row || row.original_currency !== receipt.baseCurrency || row.target_currency !== receipt.targetCurrency
      || (receipt.source !== undefined && row.source !== receipt.source)
      || (receipt.dayFinal !== undefined && row.is_day_final !== receipt.dayFinal)
      || row.rate_date !== receipt.rateDate || Number(row.daily_exchange_rate) !== receipt.rate
      || Date.parse(row.provider_updated_at ?? "") !== Date.parse(receipt.quotedAt!)
      || (receipt.baseCurrency === "CNY"
        ? row.bank_code !== null || row.quote_type !== "fixed" || Number(row.daily_exchange_rate) !== 1
        : row.bank_code !== "BOC" || row.quote_type !== "spot_buy");
  })) throw new Error("汇率结果与保存记录不一致，请刷新后核对。");

  return [...rows.values()];
}
