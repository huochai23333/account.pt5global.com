import type {
  HistoricalExchangeRateFetchInput,
  HistoricalExchangeRateFetchItem,
  HistoricalExchangeRateFetchResult,
  ManualExchangeRateFetchItem,
  ManualExchangeRateFetchResult,
} from "./exchange-rate-types";

const DAY_MS = 86_400_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unconfirmed(): never {
  throw new Error("汇率结果仍未确认，请稍后刷新当前页面查看。");
}

function readBatch(value: unknown): Record<string, unknown> & { results: unknown[] } {
  if (!isRecord(value) || typeof value.operationId !== "string" || !value.operationId.trim() ||
      !Array.isArray(value.results)) unconfirmed();
  return { ...value, results: value.results as unknown[] };
}

// 接口计数、尝试结果和账本状态应相互一致。排队重试和人工处理只适用于有失败的批次。
function checkOutcome(batch: ReturnType<typeof readBatch>, succeeded: number, failed: number) {
  const outcome = failed === 0 ? "succeeded" : succeeded === 0 ? "failed" : "partial_failed";
  if (batch.outcome !== outcome || (batch.operationStatus !== outcome &&
      !(failed > 0 && (batch.operationStatus === "queued" || batch.operationStatus === "needs_attention")))) {
    unconfirmed();
  }
  return outcome;
}

function checkTargets(actual: string[], expected: string[]) {
  const unique = new Set(actual);
  if (!expected.length || actual.length !== expected.length || unique.size !== expected.length ||
      expected.some((key) => !unique.has(key))) unconfirmed();
}

function readDate(value: string) {
  const time = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) unconfirmed();
  return time;
}

function getHistoricalDates(input: HistoricalExchangeRateFetchInput) {
  const from = readDate(input.fromDate);
  const days = (readDate(input.toDate) - from) / DAY_MS + 1;
  if (days < 1 || days > 31) unconfirmed();
  return Array.from({ length: days }, (_, index) => new Date(from + index * DAY_MS).toISOString().slice(0, 10));
}

export function readManualExchangeRateBatch(value: unknown, currencies: string[], dates: readonly string[]): ManualExchangeRateFetchResult {
  const batch = readBatch(value);
  const results = batch.results.map((item) => {
    if (!isRecord(item) || typeof item.baseCurrency !== "string" || item.targetCurrency !== "CNY" ||
        typeof item.ok !== "boolean" || (item.ok && (typeof item.rateDate !== "string" || !dates.includes(item.rateDate)))) unconfirmed();
    return item as ManualExchangeRateFetchItem;
  });
  // 即使已经返回一条可独立核对的报价，缺失的币种也不能算作完成。
  checkTargets(results.map((item) => item.baseCurrency), currencies);
  const successCount = results.filter((item) => item.ok).length;
  const failedCount = results.length - successCount;
  // 当天同步的成功回执省略 failedCount，明细有失败时则必须提供准确计数。
  const reportedFailures = batch.failedCount === undefined && failedCount === 0 ? 0 : batch.failedCount;
  if (batch.successCount !== successCount || reportedFailures !== failedCount) unconfirmed();
  return { results, successCount, failedCount, outcome: checkOutcome(batch, successCount, failedCount) };
}

export function readHistoricalExchangeRateBatch(value: unknown, input: HistoricalExchangeRateFetchInput): HistoricalExchangeRateFetchResult {
  const batch = readBatch(value);
  const results = batch.results.map((item) => {
    if (!isRecord(item) || typeof item.baseCurrency !== "string" || item.targetCurrency !== "CNY" ||
        typeof item.rateDate !== "string" || (item.status !== "inserted" && item.status !== "skipped" && item.status !== "failed")) unconfirmed();
    return item as HistoricalExchangeRateFetchItem;
  });
  const dates = getHistoricalDates(input);
  checkTargets(results.map((item) => `${item.baseCurrency}:${item.rateDate}`),
    input.baseCurrencies.flatMap((currency) => dates.map((date) => `${currency}:${date}`)));
  const insertedCount = results.filter((item) => item.status === "inserted").length;
  const skippedCount = results.filter((item) => item.status === "skipped").length;
  const failedCount = results.length - insertedCount - skippedCount;
  if (batch.insertedCount !== insertedCount || batch.skippedCount !== skippedCount || batch.failedCount !== failedCount) unconfirmed();
  checkOutcome(batch, insertedCount + skippedCount, failedCount);
  return { results, insertedCount, skippedCount, failedCount };
}
