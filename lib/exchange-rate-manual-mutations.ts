import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeCurrencyCode } from "./exchange-rate-display";
import { verifyExchangeRateReceipts } from "./exchange-rate-receipts";
import { EXCHANGE_RATE_SELECT, type ExchangeRateFormInput, type ExchangeRateRow } from "./exchange-rate-types";
import { withRequestTimeout } from "./request-timeout";

export async function createExchangeRate(
  supabase: SupabaseClient,
  input: ExchangeRateFormInput,
) {
  const payload = toExchangeRatePayload(input);
  const { data, error } = await withRequestTimeout(
    supabase
      .from("exchange_rate")
      .insert(payload)
      .select(EXCHANGE_RATE_SELECT)
      .maybeSingle<ExchangeRateRow>(),
  );
  if (error) throw error;
  if (!data) throw new Error("创建汇率记录失败，请稍后重试。");
  return verifySavedManualRate(supabase, data.id, payload);
}

export async function updateExchangeRate(
  supabase: SupabaseClient,
  rateId: string,
  input: ExchangeRateFormInput,
) {
  const payload = toExchangeRatePayload(input);
  const { data, error } = await withRequestTimeout(
    supabase
      .from("exchange_rate")
      .update(payload)
      .eq("id", rateId)
      .select(EXCHANGE_RATE_SELECT)
      .maybeSingle<ExchangeRateRow>(),
  );
  if (error) throw error;
  if (!data) throw new Error("未找到需要更新的汇率记录。");
  if (data.id !== rateId) throw new Error("汇率结果与本次修改不一致，请刷新后核对。");
  return verifySavedManualRate(supabase, rateId, payload);
}

export async function deleteExchangeRate(
  supabase: SupabaseClient,
  rateId: string,
) {
  const { data, error } = await withRequestTimeout(
    supabase.from("exchange_rate").delete().eq("id", rateId).select("id").maybeSingle<{ id: string }>(),
  );
  if (error) throw error;
  if (data?.id !== rateId) throw new Error("没有找到需要删除的汇率记录。");
}

function toExchangeRatePayload(input: ExchangeRateFormInput) {
  return {
    original_currency: normalizeCurrencyCode(input.originalCurrency),
    target_currency: normalizeCurrencyCode(input.targetCurrency),
    daily_exchange_rate: input.dailyExchangeRate,
    bank_quote: input.dailyExchangeRate * 100,
    source: "manual",
    rate_date: input.quotedAt.slice(0, 10),
    provider_updated_at: new Date(`${input.quotedAt}+08:00`).toISOString(),
    provider_rate_date: input.quotedAt.slice(0, 10),
  };
}

/** 按本次提交的值独立读回。旧报价本身有效，也不能证明这次修改已保存。 */
async function verifySavedManualRate(
  supabase: SupabaseClient,
  rateId: string,
  expected: ReturnType<typeof toExchangeRatePayload>,
) {
  const [stored] = await verifyExchangeRateReceipts(supabase, [{
    baseCurrency: expected.original_currency,
    targetCurrency: "CNY",
    rateDate: expected.rate_date,
    rate: expected.daily_exchange_rate,
    rateRecordId: rateId,
    quotedAt: expected.provider_updated_at,
    source: expected.source,
  }]);
  // 页面使用独立读取的版本，避免回填代理层缓存的旧响应。
  if (!stored) throw new Error("没有找到已保存的汇率记录。");
  return stored;
}
