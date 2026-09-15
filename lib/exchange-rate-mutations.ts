import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeCurrencyCode, normalizeCurrencyList } from "./exchange-rate-display";
import { toExchangeRateFunctionError } from "./exchange-rate-errors";
import {
  EXCHANGE_RATE_SELECT,
  type ExchangeRateFormInput,
  type ExchangeRateRow,
  type ExchangeRateSyncPairRow,
  type ExchangeRateSyncSettingsRow,
  type HistoricalExchangeRateFetchInput,
  type HistoricalExchangeRateFetchResult,
  type ManualExchangeRateFetchResult,
} from "./exchange-rate-types";
import { withRequestTimeout } from "./request-timeout";

const EXCHANGE_RATE_SYNC_TIMEOUT_MS = 30_000;

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

  const payload = data as (Partial<ManualExchangeRateFetchResult> & { operationId?: unknown; operationStatus?: unknown }) | null;
  if (typeof payload?.operationId !== "string" || payload.operationStatus !== "succeeded") {
    throw new Error("汇率结果仍未确认，请稍后到系统运行页查看。");
  }
  return {
    results: Array.isArray(payload?.results) ? payload.results : [],
    successCount:
      typeof payload?.successCount === "number"
        ? payload.successCount
        : Array.isArray(payload?.results)
          ? payload.results.filter((item) => item.ok).length
          : 0,
  };
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

  const payload = data as (Partial<HistoricalExchangeRateFetchResult> & { operationId?: unknown; operationStatus?: unknown }) | null;
  const hasVerifiedTerminalOrRetry = payload?.operationStatus === "succeeded"
    || (payload?.operationStatus === "queued" && Number(payload?.failedCount) > 0);
  if (typeof payload?.operationId !== "string" || !hasVerifiedTerminalOrRetry) {
    throw new Error("历史汇率结果仍未确认，请稍后到系统运行页查看。");
  }
  const results = Array.isArray(payload?.results) ? payload.results : [];

  return {
    results,
    insertedCount:
      typeof payload?.insertedCount === "number"
        ? payload.insertedCount
        : results.filter((item) => item.status === "inserted").length,
    skippedCount:
      typeof payload?.skippedCount === "number"
        ? payload.skippedCount
        : results.filter((item) => item.status === "skipped").length,
    failedCount:
      typeof payload?.failedCount === "number"
        ? payload.failedCount
        : results.filter((item) => item.status === "failed").length,
  };
}

export async function createExchangeRate(
  supabase: SupabaseClient,
  input: ExchangeRateFormInput,
) {
  const { data, error } = await withRequestTimeout(
    supabase
      .from("exchange_rate")
      .insert(toExchangeRatePayload(input))
      .select(EXCHANGE_RATE_SELECT)
      .maybeSingle<ExchangeRateRow>(),
  );
  if (error) throw error;
  if (!data) throw new Error("创建汇率记录失败，请稍后重试。");
  return data;
}

export async function updateExchangeRate(
  supabase: SupabaseClient,
  rateId: string,
  input: ExchangeRateFormInput,
) {
  const { data, error } = await withRequestTimeout(
    supabase
      .from("exchange_rate")
      .update(toExchangeRatePayload(input))
      .eq("id", rateId)
      .select(EXCHANGE_RATE_SELECT)
      .maybeSingle<ExchangeRateRow>(),
  );
  if (error) throw error;
  if (!data) throw new Error("未找到需要更新的汇率记录。");
  return data;
}

export async function deleteExchangeRate(
  supabase: SupabaseClient,
  rateId: string,
) {
  const { data, error } = await withRequestTimeout(
    supabase.from("exchange_rate").delete().eq("id", rateId).select("id").maybeSingle<{ id: string }>(),
  );
  if (error) throw error;
  if (!data) throw new Error("没有找到需要删除的汇率记录。");
}

function toExchangeRatePayload(input: ExchangeRateFormInput) {
  return {
    original_currency: normalizeCurrencyCode(input.originalCurrency),
    target_currency: normalizeCurrencyCode(input.targetCurrency),
    daily_exchange_rate: input.dailyExchangeRate,
  };
}
