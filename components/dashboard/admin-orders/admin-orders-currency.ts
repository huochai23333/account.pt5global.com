import {
  findTodayCnyExchangeRate,
  normalizeCurrencyCode,
  sortExchangeRateRows,
  type ExchangeRateRow,
  type ExchangeRateSyncPairRow,
} from "@/lib/exchange-rates";

import {
  formatEditableNumericValue,
  parseNumericValue,
} from "./admin-orders-display";
import { companyExchangeRate, multiplyRoundedDecimal } from "@/lib/company-exchange-rate";

export type OrderCurrencyOption = {
  currency: string;
  dailyExchangeRate: string;
  transactionRate: string;
};

export function buildOrderCurrencyOptions(
  orderCurrencyRates: ExchangeRateRow[],
  syncPairs: ExchangeRateSyncPairRow[] = [],
): OrderCurrencyOption[] {
  const rateByCurrency = new Map<string, ExchangeRateRow>();

  for (const row of sortExchangeRateRows(orderCurrencyRates)) {
    const currency = normalizeCurrencyCode(row.original_currency);

    if (
      !currency ||
      normalizeCurrencyCode(row.target_currency) !== "CNY" ||
      rateByCurrency.has(currency) ||
      !formatEditableNumericValue(row.daily_exchange_rate)
    ) {
      continue;
    }

    rateByCurrency.set(currency, row);
  }

  const orderedCurrencies = getOrderedCurrencyCodes(rateByCurrency, syncPairs);
  // 人民币无需供应商报价，币种选项和金额计算必须共同保留固定汇率 1。
  if (!orderedCurrencies.includes("CNY")) {
    const cny = findTodayCnyExchangeRate([], "CNY");
    if (cny) rateByCurrency.set("CNY", cny);
    orderedCurrencies.push("CNY");
  }

  return orderedCurrencies.map((currency) => {
    const dailyExchangeRate = formatEditableNumericValue(
      rateByCurrency.get(currency)?.daily_exchange_rate,
    );

    return {
      currency,
      dailyExchangeRate,
      transactionRate: deriveTransactionRateValue(dailyExchangeRate, currency),
    };
  });
}

export function getDefaultOrderCurrency(orderCurrencyRates: ExchangeRateRow[]) {
  const options = buildOrderCurrencyOptions(orderCurrencyRates);

  return (
    options.find((option) => option.currency === "USD")?.currency ??
    options[0]?.currency ??
    ""
  );
}

export function applyOrderExchangeRateToOrderForm<
  FormState extends {
    originalCurrency: string;
    amount: string;
    dailyExchangeRate: string;
    transactionRate: string;
    rmbAmount: string;
  },
>(formState: FormState, orderCurrencyRates: ExchangeRateRow[]): FormState {
  const rate = findTodayCnyExchangeRate(
    orderCurrencyRates,
    formState.originalCurrency,
  );
  const dailyExchangeRate = formatEditableNumericValue(rate?.daily_exchange_rate);

  return {
    ...formState,
    dailyExchangeRate,
    transactionRate: deriveTransactionRateValue(dailyExchangeRate, formState.originalCurrency),
    rmbAmount: deriveRmbAmountValue(formState.amount, deriveTransactionRateValue(dailyExchangeRate, formState.originalCurrency)),
  };
}

export function deriveTransactionRateValue(
  value: number | string | null | undefined,
  currency: string,
) {
  const parsed = parseNumericValue(value);

  if (parsed === null) {
    return "";
  }

  // 输入始终是买入价；人民币自身保持 1，其他币种只在这里扣一次 1%。
  const derived = companyExchangeRate(currency, value)?.toFixed(6) ?? "";
  return derived.replace(/\.?0+$/, "");
}

/** 金额入口只接受已计算的成交价，调用方不能再传买入价或重复扣减 1%。 */
export function deriveRmbAmountValue(
  amount: number | string | null | undefined,
  transactionRate: number | string | null | undefined,
) {
  const parsedAmount = parseNumericValue(amount);
  const parsedRate = parseNumericValue(transactionRate);

  if (parsedAmount === null || parsedRate === null) {
    return "";
  }

  return multiplyRoundedDecimal(String(amount), String(transactionRate), 2).replace(/\.?0+$/, "");
}

function getOrderedCurrencyCodes(
  rateByCurrency: Map<string, ExchangeRateRow>,
  syncPairs: ExchangeRateSyncPairRow[],
) {
  const configuredCurrencies = syncPairs
    .map((pair) => normalizeCurrencyCode(pair.base_currency))
    .filter((currency) => currency && rateByCurrency.has(currency));
  const latestRateCurrencies = Array.from(rateByCurrency.keys());

  return Array.from(new Set([...configuredCurrencies, ...latestRateCurrencies]));
}
