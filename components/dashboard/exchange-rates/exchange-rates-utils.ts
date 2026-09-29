import type {
  ExchangeRateFormInput,
  ExchangeRateRow,
} from "@/lib/exchange-rates";

import {
  getBeijingDateString,
  normalizeCurrencyCode,
} from "@/lib/exchange-rates";
import {
  DEFAULT_LOCALE,
  type Locale,
} from "@/lib/locale";

import {
  getRawErrorMessage,
} from "../dashboard-shared-ui";

export type ExchangeRateFormState = {
  dailyExchangeRate: string;
  quotedAt: string;
  originalCurrency: string;
  targetCurrency: string;
};

type ExchangeRateTranslator = (
  key: string,
  values?: Record<string, string | number>,
) => string;

export type ExchangeRateCopy = {
  dialogs: {
    dailyExchangeRateLabel: string;
  };
  errors: {
    duplicateKey: string;
    permission: string;
    positiveRate: string;
    unknown: string;
  };
  summary: {
    noRecord: string;
  };
  validation: {
    greaterThanZero: (label: string) => string;
    inputPrompt: (label: string) => string;
    invalidFormat: (label: string) => string;
    originalCurrencyRequired: string;
    quotedAtRequired: string;
    targetCurrencyRequired: string;
  };
};

export function createExchangeRateCopy(
  t: ExchangeRateTranslator,
): ExchangeRateCopy {
  return {
    dialogs: {
      dailyExchangeRateLabel: t("dialogs.fields.dailyExchangeRate"),
    },
    errors: {
      duplicateKey: t("errors.duplicateKey"),
      permission: t("errors.permission"),
      positiveRate: t("errors.positiveRate"),
      unknown: t("errors.unknown"),
    },
    summary: {
      noRecord: t("summary.noRecord"),
    },
    validation: {
      greaterThanZero: (label) => t("validation.greaterThanZero", { label }),
      inputPrompt: (label) => t("validation.inputPrompt", { label }),
      invalidFormat: (label) => t("validation.invalidFormat", { label }),
      originalCurrencyRequired: t("validation.originalCurrencyRequired"),
      quotedAtRequired: t("validation.quotedAtRequired"),
      targetCurrencyRequired: t("validation.targetCurrencyRequired"),
    },
  };
}

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

export function formatExchangeRateValue(
  value: number | string | null | undefined,
  locale: Locale = DEFAULT_LOCALE,
  noRecordLabel = "",
) {
  const numericValue =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;

  if (!Number.isFinite(numericValue)) {
    return noRecordLabel;
  }

  return new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", {
    maximumFractionDigits: 6,
    minimumFractionDigits: numericValue % 1 === 0 ? 0 : 2,
  }).format(numericValue);
}

/** 汇率日期没有时分秒，固定按 UTC 日历格式化可避免浏览器时区把日期减一天。 */
export function formatExchangeRateDate(
  value: string | null | undefined,
  locale: Locale = DEFAULT_LOCALE,
  noRecordLabel = "",
) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return noRecordLabel;

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return noRecordLabel;

  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
    year: "numeric",
  }).format(date);
}

export function addExchangeRateCalendarDays(value: string, amount: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount));

  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

/** 银行报价必须按北京时间显示到秒，浏览器所在时区不能改变业务报价日期。 */
export function formatExchangeRateQuoteTime(value: string | null | undefined, locale: Locale = DEFAULT_LOCALE) {
  if (!value || !Number.isFinite(Date.parse(value))) return "—";
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).format(new Date(value));
}

export function getHistoricalExchangeRateMaxDate() {
  return addExchangeRateCalendarDays(getBeijingDateString(), -1);
}

export function getExchangeRateDateRangeDayCount(
  fromDate: string,
  toDate: string,
) {
  if (!fromDate || !toDate || fromDate > toDate) return 0;

  const fromTimestamp = Date.parse(`${fromDate}T00:00:00.000Z`);
  const toTimestamp = Date.parse(`${toDate}T00:00:00.000Z`);
  if (!Number.isFinite(fromTimestamp) || !Number.isFinite(toTimestamp)) return 0;

  return Math.floor((toTimestamp - fromTimestamp) / 86_400_000) + 1;
}

export function toExchangeRateErrorMessage(
  error: unknown,
  copy: ExchangeRateCopy,
) {
  const rawMessage = getRawErrorMessage(error);

  if (rawMessage.includes("duplicate key")) {
    return copy.errors.duplicateKey;
  }

  if (rawMessage.includes("exchange_rate_daily_exchange_rate_positive")) {
    return copy.errors.positiveRate;
  }

  if (rawMessage.includes("row-level security")) {
    return copy.errors.permission;
  }

  return copy.errors.unknown;
}

export function isExchangeRatePermissionMessage(
  message: string,
  permissionMessage: string,
) {
  return (
    message.includes("row-level security") ||
    message.includes("permission to view or manage FX rate data") ||
    message.includes(permissionMessage)
  );
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
