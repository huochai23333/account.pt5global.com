import type {
  OperatorReimbursementFormInput,
  OperatorReimbursementPeriod,
} from "@/lib/operator-reimbursements";

export type OperatorReimbursementFormState = {
  amount: string;
  content: string;
  spentAt: string;
};

export type OperatorReimbursementSummary = {
  amount: number;
  count: number;
};

type OperatorReimbursementErrorCopy = {
  deleteLockedError: string;
  invalidAmount: string;
  invalidDate: string;
  missingAmount: string;
  missingContent: string;
  notFoundError: string;
  permissionError: string;
  unknownError: string;
};

export function createEmptyOperatorReimbursementForm(): OperatorReimbursementFormState {
  return {
    amount: "",
    content: "",
    spentAt: getTodayDateInputValue(),
  };
}

export function toOperatorReimbursementInput(
  formState: OperatorReimbursementFormState,
  copy: OperatorReimbursementErrorCopy,
): OperatorReimbursementFormInput {
  if (!formState.content.trim()) {
    throw new Error(copy.missingContent);
  }

  if (!formState.amount.trim()) {
    throw new Error(copy.missingAmount);
  }

  const amount = Number(formState.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(copy.invalidAmount);
  }

  if (!isDateInputValue(formState.spentAt)) {
    throw new Error(copy.invalidDate);
  }

  return {
    amount,
    content: formState.content,
    spentAt: formState.spentAt,
  };
}

export function formatOperatorReimbursementAmount(
  amount: number,
  locale: string,
) {
  return new Intl.NumberFormat(locale, {
    currency: "CNY",
    style: "currency",
  }).format(amount);
}

export function formatOperatorReimbursementDate(
  value: string | null,
  locale: string,
) {
  if (!value || !isDateInputValue(value)) return "-";

  // date 字段没有时刻含义，固定按上海零点解析可以避免浏览器所在时区改变业务日期。
  const date = new Date(`${value}T00:00:00+08:00`);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "Asia/Shanghai",
  }).format(date);
}

export function formatOperatorReimbursementDateTime(
  value: string | null,
  locale: string,
) {
  if (!value) return "-";

  // timestamptz 必须保留完整时刻再转上海时间；截取前十位会误用 UTC 日期。
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Shanghai",
  }).format(date);
}

export function formatOperatorReimbursementPeriod(
  period: OperatorReimbursementPeriod,
  locale: string,
) {
  // 周期同时包含两个完整日期，用紧凑数字格式避免移动端截断或只剩“日”字换行。
  const formatter = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Shanghai",
  });
  const format = (value: string) =>
    formatter.format(new Date(`${value}T00:00:00+08:00`));
  return `${format(period.start)} - ${format(period.end)}`;
}

export function toOperatorReimbursementErrorMessage(
  error: unknown,
  copy: OperatorReimbursementErrorCopy,
) {
  // Supabase 返回普通错误对象，不一定是 Error 实例；只把已知业务文案交给用户。
  const message =
    error && typeof error === "object" && "message" in error
      ? String(error.message).trim()
      : "";
  const normalizedMessage = message.toLowerCase();

  if (
    message === copy.invalidAmount ||
    message === copy.invalidDate ||
    message === copy.missingAmount ||
    message === copy.missingContent
  ) {
    return message;
  }

  if (normalizedMessage.includes("operator reimbursement was not found")) {
    return copy.notFoundError;
  }

  if (
    normalizedMessage.includes("delete") ||
    normalizedMessage.includes("not found")
  ) {
    return copy.deleteLockedError;
  }

  if (
    normalizedMessage.includes("permission") ||
    normalizedMessage.includes("forbidden") ||
    normalizedMessage.includes("unauthorized") ||
    normalizedMessage.includes("row-level security")
  ) {
    return copy.permissionError;
  }

  return copy.unknownError;
}

function isDateInputValue(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  // Date 会把 2 月 30 日自动顺延到 3 月；回读年月日才能确认它是真实日历日期。
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function getTodayDateInputValue() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Shanghai",
    year: "numeric",
  }).formatToParts(new Date());
  const partMap = new Map(parts.map((part) => [part.type, part.value]));

  // 日期输入框只接受 YYYY-MM-DD，所以这里用上海时区当天拼出稳定的输入值。
  return [
    partMap.get("year") ?? "",
    partMap.get("month") ?? "",
    partMap.get("day") ?? "",
  ].join("-");
}
