import type {
  ExchangeRateLatestRow,
  ExchangeRateRow,
} from "./exchange-rate-types";

/**
 * 以下函数只做数据整理，不访问数据库。
 * 把纯计算单独放置后，页面展示和服务端查询都能复用同一套货币代码规则。
 */
export function buildExchangeRateLatestRows(rows: ExchangeRateRow[]) {
  const groupedRows = new Map<
    string,
    { historyCount: number; latestRow: ExchangeRateRow }
  >();

  for (const row of sortExchangeRateRows(rows)) {
    const pairKey = getExchangeRatePairKey(
      row.original_currency,
      row.target_currency,
    );
    const groupedRow = groupedRows.get(pairKey);

    if (groupedRow) {
      groupedRow.historyCount += 1;
      continue;
    }

    groupedRows.set(pairKey, { historyCount: 1, latestRow: row });
  }

  return Array.from(groupedRows.entries()).map(([pairKey, value]) => ({
    ...value.latestRow,
    historyCount: value.historyCount,
    pairKey,
    pairLabel: getExchangeRatePairLabel(
      value.latestRow.original_currency,
      value.latestRow.target_currency,
    ),
  })) satisfies ExchangeRateLatestRow[];
}

export function sortExchangeRateRows(rows: ExchangeRateRow[]) {
  return [...rows].sort(
    (left, right) => {
      // 历史补充记录的抓取时间很新，但它不能盖过业务日期更晚的汇率。
      const rateDateComparison = (right.rate_date ?? "").localeCompare(
        left.rate_date ?? "",
      );

      return rateDateComparison !== 0
        ? rateDateComparison
        : toExchangeRateComparableTimestamp(right) -
            toExchangeRateComparableTimestamp(left);
    },
  );
}

export type ExchangeRateSourceKind =
  | "automatic"
  | "historical"
  | "manual"
  | "system";

export function getExchangeRateSourceKind(
  source: string | null | undefined,
): ExchangeRateSourceKind {
  if (source === "nowapi") return "automatic";
  if (source === "system") return "system";
  return "manual";
}

export function normalizeCurrencyCode(value: string | null | undefined) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

export function getExchangeRatePairKey(
  originalCurrency: string | null | undefined,
  targetCurrency: string | null | undefined,
) {
  return `${normalizeCurrencyCode(originalCurrency)}:${normalizeCurrencyCode(targetCurrency)}`;
}

export function getExchangeRatePairLabel(
  originalCurrency: string | null | undefined,
  targetCurrency: string | null | undefined,
) {
  const original = normalizeCurrencyCode(originalCurrency) || "未知货币";
  const target = normalizeCurrencyCode(targetCurrency) || "未知货币";
  return `${original}/${target}`;
}

export function getBeijingDateString(value = new Date()) {
  return new Date(value.getTime() + 8 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

export function findTodayCnyExchangeRate(
  rows: ExchangeRateRow[],
  baseCurrency: string,
) {
  const today = getBeijingDateString();
  // 保留“今日人民币”这条页面内置记录的固定标识，方便 React 稳定复用对应节点。
  if (normalizeCurrencyCode(baseCurrency) === "CNY") {
    return buildCnyRate("cny-cny-today", today);
  }
  return findCnyExchangeRateByDate(rows, baseCurrency, today);
}

export function findCnyExchangeRateByDate(
  rows: ExchangeRateRow[],
  baseCurrency: string,
  rateDate: string,
) {
  const normalizedBaseCurrency = normalizeCurrencyCode(baseCurrency);
  if (!rateDate) return null;

  if (normalizedBaseCurrency === "CNY") {
    return buildCnyRate(`cny-cny-${rateDate}`, rateDate);
  }

  return (
    sortExchangeRateRows(rows).find(
      (row) =>
        normalizeCurrencyCode(row.original_currency) ===
          normalizedBaseCurrency &&
        normalizeCurrencyCode(row.target_currency) === "CNY" &&
        row.rate_date === rateDate &&
        (rateDate === getBeijingDateString() || row.is_day_final),
    ) ?? null
  );
}

export function findLatestCnyExchangeRate(
  rows: ExchangeRateRow[],
  baseCurrency: string,
) {
  const normalizedBaseCurrency = normalizeCurrencyCode(baseCurrency);
  const today = getBeijingDateString();

  if (normalizedBaseCurrency === "CNY") {
    return buildCnyRate("cny-cny-latest", today);
  }

  return (
    sortExchangeRateRows(rows).find(
      (row) =>
        normalizeCurrencyCode(row.original_currency) ===
          normalizedBaseCurrency &&
        normalizeCurrencyCode(row.target_currency) === "CNY",
    ) ?? null
  );
}

export function normalizeCurrencyList(
  values: Array<string | null | undefined>,
) {
  return Array.from(
    new Set(
      values
        .map((value) => normalizeCurrencyCode(value))
        .filter((value) => /^[A-Z]{3}$/.test(value)),
    ),
  );
}

function buildCnyRate(id: string, rateDate: string) {
  return {
    id,
    original_currency: "CNY",
    target_currency: "CNY",
    daily_exchange_rate: 1,
    created_at: null,
    rate_date: rateDate,
    source: "system",
    fetched_at: null,
    provider_updated_at: null,
    provider_rate_date: rateDate,
    bank_code: null,
    bank_quote: 100,
    quote_type: null,
    is_day_final: true,
  } satisfies ExchangeRateRow;
}

function toComparableTimestamp(value: string | null | undefined) {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function toExchangeRateComparableTimestamp(row: ExchangeRateRow) {
  return (
    toComparableTimestamp(row.provider_updated_at) ||
    toComparableTimestamp(row.fetched_at) ||
    toComparableTimestamp(row.created_at)
  );
}
