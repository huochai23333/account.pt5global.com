import { queryCompleteDashboardRows } from "./dashboard-complete-query";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getDashboardQueryRange,
  MAX_DASHBOARD_QUERY_ROWS,
} from "./dashboard-pagination";
import {
  getBeijingDateString,
  normalizeCurrencyCode,
  sortExchangeRateRows,
} from "./exchange-rate-display";
import {
  canViewExchangeRatesPage,
  getCurrentExchangeRateViewerContext,
} from "./exchange-rate-permissions";
import {
  EXCHANGE_RATE_SELECT,
  type ExchangeRateRow,
  type ExchangeRatesPageData,
  type ExchangeRatesPageMode,
  type ExchangeRateViewerContext,
  type ExchangeRateSyncPairRow,
  type ExchangeRateSyncSettingsRow,
  type ExchangeRateSyncState,
} from "./exchange-rate-types";
import { withRequestTimeout } from "./request-timeout";


/** 页面查询先校验身份，再并行读取汇率和管理员专用的自动同步设置。 */
export async function getExchangeRatesPageData(
  supabase: SupabaseClient,
  mode: ExchangeRatesPageMode,
  viewerContext?: ExchangeRateViewerContext,
): Promise<ExchangeRatesPageData> {
  const viewer =
    viewerContext ?? (await getCurrentExchangeRateViewerContext(supabase));

  if (!viewer || !canViewExchangeRatesPage(mode, viewer.role, viewer.status)) {
    return { hasPermission: false, rates: [], syncState: null };
  }

  const [rates, syncState] = await Promise.all([
    getExchangeRates(supabase),
    mode === "manage"
      ? getExchangeRateSyncState(supabase)
      : Promise.resolve(null),
  ]);

  return { hasPermission: true, rates, syncState };
}

export async function getExchangeRates(
  supabase: SupabaseClient,
): Promise<ExchangeRateRow[]> {
  const { data, error } = await queryCompleteDashboardRows(
    supabase
      .from("exchange_rate")
      .select(EXCHANGE_RATE_SELECT)
      .order("rate_date", { ascending: false })
      .order("fetched_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .returns<ExchangeRateRow[]>(),
  );
  if (error) throw error;
  return data ?? [];
}

export async function getTodayCnyExchangeRates(supabase: SupabaseClient) {
  const { data, error } = await withRequestTimeout(
    supabase
      .from("exchange_rate")
      .select(EXCHANGE_RATE_SELECT)
      .eq("target_currency", "CNY")
      .eq("rate_date", getBeijingDateString())
      .order("fetched_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .returns<ExchangeRateRow[]>(),
  );
  if (error) throw error;
  return data ?? [];
}

export async function getLatestCnyExchangeRates(
  supabase: SupabaseClient,
  limit = MAX_DASHBOARD_QUERY_ROWS,
) {
  const { from, to } = getDashboardQueryRange(limit);
  const { data, error } = await withRequestTimeout(
    supabase
      .from("exchange_rate")
      .select(EXCHANGE_RATE_SELECT)
      .eq("target_currency", "CNY")
      .eq("rate_date", getBeijingDateString())
      .order("rate_date", { ascending: false })
      .order("fetched_at", { ascending: false, nullsFirst: false })
      .order("provider_updated_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(from, to)
      .returns<ExchangeRateRow[]>(),
  );
  if (error) throw error;

  const latestRows = new Map<string, ExchangeRateRow>();
  for (const row of sortExchangeRateRows(data ?? [])) {
    const currency = normalizeCurrencyCode(row.original_currency);
    if (currency && !latestRows.has(currency)) latestRows.set(currency, row);
  }
  return Array.from(latestRows.values());
}

export async function getExchangeRateSyncState(
  supabase: SupabaseClient,
): Promise<ExchangeRateSyncState> {
  const [settingsResult, pairsResult] = await Promise.all([
    withRequestTimeout(
      supabase
        .from("exchange_rate_sync_settings")
        .select("id,is_enabled,updated_at,updated_by")
        .eq("id", true)
        .maybeSingle<ExchangeRateSyncSettingsRow>(),
    ),
    withRequestTimeout(
      supabase
        .from("exchange_rate_sync_pairs")
        .select(
          "id,base_currency,target_currency,is_enabled,created_at,updated_at,created_by",
        )
        .order("created_at", { ascending: true })
        .returns<ExchangeRateSyncPairRow[]>(),
    ),
  ]);
  if (settingsResult.error) throw settingsResult.error;
  if (pairsResult.error) throw pairsResult.error;

  return {
    settings: settingsResult.data ?? {
      id: true,
      is_enabled: false,
      updated_at: null,
      updated_by: null,
    },
    pairs: pairsResult.data ?? [],
  };
}
