import type { SupabaseClient } from "@supabase/supabase-js";
import { withRequestTimeout } from "./request-timeout";

type QuoteReceipt = { baseCurrency: string; targetCurrency: "CNY"; rateDate?: string; rate?: number; rateRecordId?: string; quotedAt?: string };

/** 获取结果中的每个成功记录，都必须与独立读取的买入价、日期、币种和报价时间一致。 */
export async function verifyExchangeRateReceipts(supabase: SupabaseClient, receipts: QuoteReceipt[]) {
  if (!receipts.length) return;
  if (receipts.some(row => !row.rateRecordId || !row.quotedAt || !row.rateDate || !Number.isFinite(row.rate))) {
    throw new Error("汇率保存凭证不完整，请刷新后核对。");
  }
  const { data, error } = await withRequestTimeout(supabase.from("exchange_rate")
    .select("id,original_currency,target_currency,rate_date,daily_exchange_rate,provider_updated_at,bank_code,quote_type")
    .in("id", receipts.map(row => row.rateRecordId!)));
  if (error) throw error;
  if (receipts.some(receipt => {
    const row = data?.find(candidate => candidate.id === receipt.rateRecordId);
    return !row || row.original_currency !== receipt.baseCurrency || row.target_currency !== "CNY"
      || row.rate_date !== receipt.rateDate || Number(row.daily_exchange_rate) !== receipt.rate
      || Date.parse(row.provider_updated_at) !== Date.parse(receipt.quotedAt!)
      || (receipt.baseCurrency === "CNY"
        ? row.bank_code !== null || row.quote_type !== "fixed" || Number(row.daily_exchange_rate) !== 1
        : row.bank_code !== "BOC" || row.quote_type !== "spot_buy");
  })) throw new Error("汇率结果与保存记录不一致，请刷新后核对。");
}
