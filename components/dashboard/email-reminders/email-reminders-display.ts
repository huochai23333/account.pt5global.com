/**
 * 服务端和浏览器必须生成完全相同的上海时间文字，避免操作系统语言不同造成水合错误。
 * 这里直接把时间移动到 UTC+8 后读取 UTC 字段，不依赖设备的地区格式。
 */
export function formatEmailReminderTime(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "-";
  const date = new Date(timestamp + 8 * 60 * 60_000);
  const part = (number: number) => number.toString().padStart(2, "0");
  return `${date.getUTCFullYear()}-${part(date.getUTCMonth() + 1)}-${part(date.getUTCDate())} ${part(date.getUTCHours())}:${part(date.getUTCMinutes())}`;
}
