/** 十进制整数运算与 PostgreSQL numeric 的四舍五入一致，避免二进制浮点误差多算或少算一分钱。 */
export function multiplyRoundedDecimal(left: number | string, right: number | string, places: number) {
  const decimal = (value: number | string) => {
    const text = String(value);
    if (!/^-?\d+(\.\d+)?$/.test(text)) throw new Error("金额格式无效。");
    const [whole, fraction = ""] = text.split(".");
    return { integer: BigInt(whole + fraction), scale: fraction.length };
  };
  const a = decimal(left), b = decimal(right);
  const product = a.integer * b.integer;
  const sign = product < BigInt(0) ? BigInt(-1) : BigInt(1);
  const magnitude = product * sign;
  const shift = a.scale + b.scale - places;
  const divisor = BigInt(10) ** BigInt(Math.max(shift, 0));
  const rounded = shift > 0 ? (magnitude + divisor / BigInt(2)) / divisor : magnitude * BigInt(10) ** BigInt(-shift);
  const digits = String(rounded).padStart(places + 1, "0");
  return `${sign < BigInt(0) ? "-" : ""}${places ? `${digits.slice(0, -places)}.${digits.slice(-places)}` : digits}`;
}

/** 参数必须是原始买入汇率；成交汇率不能再次传入本函数。 */
export function companyExchangeRate(currency: string | null, buyingRate: number | string | null | undefined) {
  if (currency?.trim().toUpperCase() === "CNY") return 1;
  if (buyingRate === null || buyingRate === undefined || buyingRate === "" || Number(buyingRate) <= 0) return null;
  return Number(multiplyRoundedDecimal(buyingRate, "0.99", 6));
}
