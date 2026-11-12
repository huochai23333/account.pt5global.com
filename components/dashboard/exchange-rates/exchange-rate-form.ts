import {
  getBeijingDateString,
  normalizeCurrencyCode,
  type ExchangeRateFormInput,
  type ExchangeRateRow,
} from "@/lib/exchange-rates";
import type { ExchangeRateCopy } from "./exchange-rates-utils";

// 表单保留原始输入，提交前才转换成规范的币种和北京时区报价。
export type ExchangeRateFormState = {
  dailyExchangeRate: string;
  quotedAt: string;
  originalCurrency: string;
  targetCurrency: string;
};

export function createExchangeRateFormState(
  defaults?: Partial<ExchangeRateFormState>,
): ExchangeRateFormState {
  return {
    dailyExchangeRate: defaults?.dailyExchangeRate ?? "",
    quotedAt: defaults?.quotedAt ?? "",
    originalCurrency: defaults?.originalCurrency ?? "",
    targetCurrency: defaults?.targetCurrency ?? "",
  };
}

export function createExchangeRateFormStateFromRow(
  row: ExchangeRateRow,
): ExchangeRateFormState {
  return {
    dailyExchangeRate: formatEditableExchangeRateValue(row.daily_exchange_rate),
    quotedAt: row.provider_updated_at ? new Date(Date.parse(row.provider_updated_at) + 28_800_000).toISOString().slice(0, 19) : "",
    originalCurrency: normalizeCurrencyCode(row.original_currency),
    targetCurrency: normalizeCurrencyCode(row.target_currency),
  };
}

export function parseExchangeRateForm(
  formState: ExchangeRateFormState,
  copy: ExchangeRateCopy,
):
  | { ok: true; payload: ExchangeRateFormInput }
  | { ok: false; message: string } {
  const originalCurrency = normalizeCurrencyCode(formState.originalCurrency);
  const targetCurrency = normalizeCurrencyCode(formState.targetCurrency);
  // 人工录入必须填写真实报价时间；不能把保存时刻冒充银行的发布时间。
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(formState.quotedAt)
    || formState.quotedAt.slice(0, 10) !== getBeijingDateString()
    || !Number.isFinite(Date.parse(`${formState.quotedAt}+08:00`))
    || Date.parse(`${formState.quotedAt}+08:00`) > Date.now()) {
    return { ok: false, message: copy.validation.quotedAtRequired };
  }

  if (!originalCurrency) {
    return {
      ok: false,
      message: copy.validation.originalCurrencyRequired,
    };
  }

  if (!targetCurrency) {
    return {
      ok: false,
      message: copy.validation.targetCurrencyRequired,
    };
  }

  const dailyExchangeRate = parsePositiveNumber(
    formState.dailyExchangeRate,
    copy.dialogs.dailyExchangeRateLabel,
    copy,
  );

  if (typeof dailyExchangeRate === "string") {
    return { ok: false, message: dailyExchangeRate };
  }

  return {
    ok: true,
    payload: {
      dailyExchangeRate,
      quotedAt: formState.quotedAt,
      originalCurrency,
      targetCurrency,
    },
  };
}

function formatEditableExchangeRateValue(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value === "string") {
    return value.trim();
  }

  return "";
}

function parsePositiveNumber(
  value: string,
  label: string,
  copy: ExchangeRateCopy,
) {
  const normalized = value.trim();

  if (!normalized) {
    return copy.validation.inputPrompt(label);
  }

  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) {
    return copy.validation.invalidFormat(label);
  }

  if (parsed <= 0) {
    return copy.validation.greaterThanZero(label);
  }

  return parsed;
}
