import type { OperatorReimbursementPeriod } from "@/lib/operator-reimbursements";
import { isOperatorReimbursementDate } from "./operator-reimbursements-form";

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
  if (!value || !isOperatorReimbursementDate(value)) return "-";

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
