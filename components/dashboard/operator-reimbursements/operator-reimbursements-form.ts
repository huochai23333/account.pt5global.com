import type { OperatorReimbursementFormInput } from "@/lib/operator-reimbursements";

// 输入的日期按上海时区准备；金额校验和错误映射集中供表单与确认动作使用。
export type OperatorReimbursementFormState = {
  amount: string;
  content: string;
  spentAt: string;
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
  if (!isOperatorReimbursementDate(formState.spentAt)) {
    throw new Error(copy.invalidDate);
  }

  if (!formState.amount.trim()) {
    throw new Error(copy.missingAmount);
  }

  const amount = Number(formState.amount);

  // 金额列使用两位小数；先拦截超精度输入，避免写入后被舍入。
  if (!Number.isFinite(amount) || amount <= 0 || amount !== Math.round(amount * 100) / 100) {
    throw new Error(copy.invalidAmount);
  }

  if (!formState.content.trim()) {
    throw new Error(copy.missingContent);
  }

  return {
    amount,
    content: formState.content,
    spentAt: formState.spentAt,
  };
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

export function isOperatorReimbursementDate(value: string) {
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
