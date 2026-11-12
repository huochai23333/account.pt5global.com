import type { SupabaseClient } from "@supabase/supabase-js";

import { getBeijingDateString, normalizeCurrencyCode, normalizeCurrencyList } from "./exchange-rate-display";
import { toExchangeRateFunctionError } from "./exchange-rate-errors";
import { readHistoricalExchangeRateBatch, readManualExchangeRateBatch } from "./exchange-rate-sync-results";
import {
  type ExchangeRateSyncPairRow,
  type ExchangeRateSyncSettingsRow,
  type HistoricalExchangeRateFetchInput,
  type HistoricalExchangeRateFetchResult,
  type ManualExchangeRateFetchResult,
} from "./exchange-rate-types";
import { withRequestTimeout } from "./request-timeout";
import { verifyExchangeRateReceipts } from "./exchange-rate-receipts";

const EXCHANGE_RATE_SYNC_TIMEOUT_MS = 120_000;

/** 本模块只负责会改变数据库或触发 Edge Function 的操作。 */
export async function setExchangeRateAutoSyncEnabled(
  supabase: SupabaseClient,
  enabled: boolean,
) {
  const { data, error } = await withRequestTimeout(
    supabase
      .from("exchange_rate_sync_settings")
      .upsert({ id: true, is_enabled: enabled }, { onConflict: "id" })
      .select("id,is_enabled,updated_at,updated_by")
      .maybeSingle<ExchangeRateSyncSettingsRow>(),
  );
  if (error) throw error;
  if (!data || data.is_enabled !== enabled) throw new Error("自动获取设置没有保存成功。");
  return data;
}

export async function addExchangeRateSyncPair(
  supabase: SupabaseClient,
  baseCurrency: string,
) {
  const normalizedBaseCurrency = normalizeCurrencyCode(baseCurrency);
  if (!/^[A-Z]{3}$/.test(normalizedBaseCurrency)) {
    throw new Error("请输入 3 位货币代码，例如 USD。");
  }

  const { data, error } = await withRequestTimeout(
    supabase
      .from("exchange_rate_sync_pairs")
      .upsert(
        {
          base_currency: normalizedBaseCurrency,
          target_currency: "CNY",
          is_enabled: true,
        },
        { onConflict: "base_currency,target_currency" },
      )
      .select(
        "id,base_currency,target_currency,is_enabled,created_at,updated_at,created_by",
      )
      .maybeSingle<ExchangeRateSyncPairRow>(),
  );
  if (error) throw error;
  if (!data || data.base_currency !== normalizedBaseCurrency) {
    throw new Error("自动获取币种没有保存成功。");
  }
  return data;
}

export async function removeExchangeRateSyncPair(
  supabase: SupabaseClient,
  pairId: string,
) {
  const { data, error } = await withRequestTimeout(
    supabase.from("exchange_rate_sync_pairs").delete().eq("id", pairId).select("id").maybeSingle<{ id: string }>(),
  );
  if (error) throw error;
  if (!data) throw new Error("没有找到需要移除的自动获取币种。");
}

export async function triggerManualExchangeRateFetch(
  supabase: SupabaseClient,
  baseCurrencies: string[],
): Promise<ManualExchangeRateFetchResult> {
  const normalizedBaseCurrencies = normalizeCurrencyList(baseCurrencies);
  if (normalizedBaseCurrencies.length === 0) {
    throw new Error("请至少填写一个要获取的币种。");
  }

  const requestedDate = getBeijingDateString();
  const { data, error } = await withRequestTimeout(
    supabase.functions.invoke("exchange-rate-sync", {
      body: { trigger: "manual", baseCurrencies: normalizedBaseCurrencies },
    }),
    {
      timeoutMs: EXCHANGE_RATE_SYNC_TIMEOUT_MS,
      message: "今天的汇率暂时获取失败，请稍后重试或联系管理员。",
    },
  );
  if (error) throw await toExchangeRateFunctionError(error);

  // 跨北京时间零点时，后端开始处理请求的日期可能已进入第二天。
  const dates = [requestedDate, getBeijingDateString()];
  const result = readManualExchangeRateBatch(data, normalizedBaseCurrencies, dates);
  await verifyExchangeRateReceipts(supabase, result.results.filter(item => item.ok).map(item => ({
    ...item,
    source: item.baseCurrency === "CNY" ? "system" : "nowapi",
  })));
  return result;
}

/**
 * 历史补充始终把日期和币种一起交给服务端重新校验。
 * 浏览器只负责改善填写体验，不能成为日期上限或管理员权限的唯一防线。
 */
export async function triggerHistoricalExchangeRateFetch(
  supabase: SupabaseClient,
  input: HistoricalExchangeRateFetchInput,
): Promise<HistoricalExchangeRateFetchResult> {
  const normalizedBaseCurrencies = normalizeCurrencyList(input.baseCurrencies);
  if (normalizedBaseCurrencies.length === 0) {
    throw new Error("请至少填写一个要补充的币种。");
  }

  const { data, error } = await withRequestTimeout(
    supabase.functions.invoke("exchange-rate-sync", {
      body: {
        trigger: "historical",
        baseCurrencies: normalizedBaseCurrencies,
        fromDate: input.fromDate,
        toDate: input.toDate,
      },
    }),
    {
      timeoutMs: EXCHANGE_RATE_SYNC_TIMEOUT_MS,
      message: "历史汇率暂时获取失败，请稍后重试。",
    },
  );
  if (error) throw await toExchangeRateFunctionError(error);

  const result = readHistoricalExchangeRateBatch(data, { ...input, baseCurrencies: normalizedBaseCurrencies });
  // 已有记录和新增记录同样要核对日末标记，盘中报价不能充当历史凭证。
  await verifyExchangeRateReceipts(supabase, result.results.filter(item => item.status !== "failed").map(item => ({
    ...item,
    source: item.baseCurrency === "CNY" ? "system" : "nowapi",
    dayFinal: true,
  })));
  return result;
}
