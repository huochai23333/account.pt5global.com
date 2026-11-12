import type { SalesLead } from "@/lib/sales-leads-types";

export function formatLeadDate(value: string | null, locale: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatLeadCountdown(
  lead: SalesLead,
  now: number,
  labels: { expired: string; daysHours: (days: number, hours: number) => string; hoursMinutes: (hours: number, minutes: number) => string },
) {
  if (!lead.expires_at) return "—";
  const remaining = new Date(lead.expires_at).getTime() - now;
  if (remaining <= 0) return labels.expired;
  const minutes = Math.ceil(remaining / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  return days > 0
    ? labels.daysHours(days, hours % 24)
    : labels.hoursMinutes(hours, minutes % 60);
}

export function toExternalHref(value: string) {
  // 来源可能填写文字而非网址；只为可确认的网页生成链接，避免把说明或危险协议当作地址。
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed) && !/^[\w-]+(?:\.[\w-]+)+(?:[/?#][^\s]*)?$/.test(trimmed)) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}
