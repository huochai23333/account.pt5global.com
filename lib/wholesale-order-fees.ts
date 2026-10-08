export type WholesaleOrderFeeInputs = {
  smallOrderCount: string | number;
  productPurchaseAmount: string | number;
  internationalShippingFee: string | number;
};

/** 金额使用整数分计算，避免 0.1 等小数的浮点误差让预览与数据库差一分钱。 */
function toCents(value: string | number): bigint {
  const match = String(value).trim().match(/^(\d+)(?:\.(\d*))?$/);
  if (!match) return BigInt(0);
  const decimal = (match[2] ?? "").padEnd(3, "0");
  return BigInt(match[1]) * BigInt(100) + BigInt(decimal.slice(0, 2)) +
    (decimal[2] >= "5" ? BigInt(1) : BigInt(0));
}

/** 正数四舍五入到分；付款手续费必须使用已经舍入的服务费、税费。 */
function percentOf(cents: bigint, percent: bigint) {
  return (cents * percent + BigInt(50)) / BigInt(100);
}

export function calculateWholesaleOrderFees(input: WholesaleOrderFeeInputs) {
  const count = String(input.smallOrderCount).match(/^\d+$/)
    ? BigInt(input.smallOrderCount) : BigInt(0);
  const base = count * BigInt(300) + toCents(input.productPurchaseAmount) +
    toCents(input.internationalShippingFee);
  const service = percentOf(base, BigInt(5));
  const tax = percentOf(base, BigInt(3));
  return {
    serviceFee: Number(service) / 100,
    cnTaxFee: Number(tax) / 100,
    paymentProcessingFee: Number(percentOf(base + service + tax, BigInt(1))) / 100,
  };
}
