import type { User } from "@supabase/supabase-js";

import type { AppRole, UserStatus } from "./user-self-service";

/**
 * 汇率表的公共字段清单。
 * 查询和写入模块共用这段字符串，可以避免某个入口漏选字段后出现页面数据不完整。
 */
export const EXCHANGE_RATE_SELECT =
  "id,original_currency,target_currency,daily_exchange_rate,created_at,rate_date,source,fetched_at,provider_updated_at,provider_rate_date,bank_code,bank_quote,quote_type,is_day_final";

export type ExchangeRateRow = {
  id: string;
  original_currency: string | null;
  target_currency: string | null;
  daily_exchange_rate: number | string | null;
  created_at: string | null;
  rate_date: string | null;
  source: string | null;
  fetched_at: string | null;
  provider_updated_at: string | null;
  provider_rate_date: string | null;
  bank_code: "BOC" | null;
  bank_quote: number | string | null;
  quote_type: "spot_buy" | "fixed" | null;
  is_day_final: boolean;
};

export type ExchangeRateLatestRow = ExchangeRateRow & {
  historyCount: number;
  pairKey: string;
  pairLabel: string;
};

export type ExchangeRateFormInput = {
  originalCurrency: string;
  targetCurrency: string;
  dailyExchangeRate: number;
  quotedAt: string;
};

export type ExchangeRateViewerContext = {
  user: User;
  role: AppRole | null;
  status: UserStatus | null;
};

export type ExchangeRatesPageMode = "manage" | "readonly";

export type ExchangeRateSyncSettingsRow = {
  id: boolean;
  is_enabled: boolean;
  updated_at: string | null;
  updated_by: string | null;
};

export type ExchangeRateSyncPairRow = {
  id: string;
  base_currency: string;
  target_currency: "CNY";
  is_enabled: boolean;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
};

export type ExchangeRateSyncState = {
  settings: ExchangeRateSyncSettingsRow;
  pairs: ExchangeRateSyncPairRow[];
};

export type ManualExchangeRateFetchItem = {
  baseCurrency: string;
  targetCurrency: "CNY";
  ok: boolean;
  rate?: number;
  rateDate?: string;
  rateRecordId?: string;
  quotedAt?: string;
  message?: string;
};

export type ManualExchangeRateFetchResult = {
  results: ManualExchangeRateFetchItem[];
  successCount: number;
  failedCount: number;
  outcome: string;
};

export type HistoricalExchangeRateFetchStatus =
  | "inserted"
  | "skipped"
  | "failed";

export type HistoricalExchangeRateFetchInput = {
  baseCurrencies: string[];
  fromDate: string;
  toDate: string;
};

export type HistoricalExchangeRateFetchItem = {
  baseCurrency: string;
  targetCurrency: "CNY";
  rateDate: string;
  rateRecordId?: string;
  quotedAt?: string;
  status: HistoricalExchangeRateFetchStatus;
  rate?: number;
  message?: string;
};

export type HistoricalExchangeRateFetchResult = {
  results: HistoricalExchangeRateFetchItem[];
  insertedCount: number;
  skippedCount: number;
  failedCount: number;
};

export type ExchangeRatesPageData = {
  hasPermission: boolean;
  rates: ExchangeRateRow[];
  syncState: ExchangeRateSyncState | null;
};
