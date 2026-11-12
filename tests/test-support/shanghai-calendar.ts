/** 所有组件返回上海本地日历字符串，不受测试进程的操作系统时区影响。 */
function partsInShanghai(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
  };
}

export function shanghaiDate(now = new Date()) {
  const parts = partsInShanghai(now);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function nextShanghaiMonthStartLocal(now = new Date()) {
  const parts = partsInShanghai(now);
  const month = Number(parts.month);
  // 只对上海日历的年月做运算。先转 Date 再 setMonth 会混入宿主时区，月末可能选错月份。
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = Number(parts.year) + (month === 12 ? 1 : 0);
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00`;
}

export function nextShanghaiDayLocal(now = new Date()) {
  // 上海当前规则没有夏令时。增加 24 小时后仍按上海日历投影，避免机器时区参与日期格式化。
  const parts = partsInShanghai(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
