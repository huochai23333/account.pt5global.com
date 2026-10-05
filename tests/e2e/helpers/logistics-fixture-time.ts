import assert from "node:assert/strict";

/** 独立夹具保留到微秒；Date.parse 只有毫秒，不能据此判断数据库时间排序。 */
export function fixtureTimestampMicros(value: string): bigint {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  assert(match, "fixture timestamp must include a timezone and at most six fractional digits");
  const [, year, month, day, hour, minute, second, fraction = "", zone] = match;
  // 日期对象仅计算整秒；逐字段回读拦住自动滚动到下个月的 2 月 30 日等非法日期。
  const date = new Date(0);
  date.setUTCFullYear(Number(year), Number(month) - 1, Number(day));
  date.setUTCHours(Number(hour), Number(minute), Number(second), 0);
  assert(
    date.getUTCFullYear() === Number(year) && date.getUTCMonth() + 1 === Number(month) &&
    date.getUTCDate() === Number(day) && date.getUTCHours() === Number(hour) &&
    date.getUTCMinutes() === Number(minute) && date.getUTCSeconds() === Number(second),
    "fixture timestamp has invalid calendar fields",
  );
  let offsetMinutes = 0;
  if (zone !== "Z") {
    const hours = Number(zone.slice(1, 3));
    const minutes = Number(zone.slice(4, 6));
    assert(hours <= 23 && minutes <= 59, "fixture timestamp has invalid timezone offset");
    offsetMinutes = (zone[0] === "+" ? 1 : -1) * (hours * 60 + minutes);
  }
  // BigInt 把整秒和六位小数合并，避免浮点或毫秒截断改变独立预期。
  return BigInt(date.getTime() - offsetMinutes * 60_000) * BigInt(1000) + BigInt(fraction.padEnd(6, "0"));
}
