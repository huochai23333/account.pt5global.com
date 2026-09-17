import { QUOTE_CURRENCIES, type QuoteDestination, type QuoteDocument, type QuoteProduct } from "./model";

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
export function calculateProduct(doc: QuoteDocument, dest: QuoteDestination, product: QuoteProduct) {
  const rate = doc.usdCnyRate;
  const display = doc.displayRate;
  const divisor = dest.divisor;
  // 体积重和实际重取较大值计运费；没有完整尺寸时只使用实际重量。
  const volumetricKg = product.lengthCm && product.widthCm && product.heightCm && divisor > 0
    ? product.lengthCm * product.widthCm * product.heightCm / divisor : 0;
  const chargeableKg = Math.max(product.weightKg, volumetricKg);
  const freightCny = chargeableKg * (product.ratePerKgCny ?? dest.ratePerKgCny)
    + (product.parcelFeeCny ?? dest.parcelFeeCny);
  // 手改运费优先于自动运费；两者最终都转换到本报价的显示币种。
  const freight = product.freightOverride === null ? freightCny / rate * display : product.freightOverride * display;
  const packingRate = dest.packingCurrency === "EUR" ? doc.packingEurRate : 1;
  const factory = product.factoryCny / rate * display;
  const packing = product.packing / packingRate * display;
  const destinationTax = product.destinationTax * display;
  const base = factory + packing + freight + destinationTax;
  // 按原表顺序叠加服务费、中国税和支付费，页面与 PDF 共用这一个函数。
  const service = base * doc.serviceFeePercent / 100;
  const chinaTax = (base + service) * 0.03;
  const payment = (base + service + chinaTax) * 0.01;
  return { volumetricKg: round(volumetricKg), chargeableKg: round(chargeableKg),
    factory: round(factory), packing: round(packing), freight: round(freight),
    destinationTax: round(destinationTax), service: round(service),
    chinaTax: round(chinaTax), payment: round(payment),
    total: product.factoryCny > 0 ? round(base + service + chinaTax + payment) : null };
}
export function calculateDestination(doc: QuoteDocument, dest: QuoteDestination) {
  return round(dest.products.reduce((sum, product) => sum + (calculateProduct(doc, dest, product).total ?? 0), 0));
}
export function quoteCurrency(doc: QuoteDocument) {
  return QUOTE_CURRENCIES[doc.currency as keyof typeof QUOTE_CURRENCIES]?.symbol ?? "$";
}
export function validateQuote(doc: QuoteDocument): string | null {
  // 草稿允许暂缺字段；只有导出 PDF 时才要求报价内容和汇率完整。
  if (!doc.client.trim() || !doc.quoter.trim() || !doc.date) return "Fill in the client, quoted by and date.";
  if (!(doc.usdCnyRate > 0) || !(doc.displayRate > 0) || !(doc.packingEurRate > 0)
    || !Number.isFinite(doc.usdCnyRate * doc.displayRate * doc.packingEurRate)) return "Enter valid exchange rates.";
  if (doc.serviceFeePercent < 0 || !Number.isFinite(doc.serviceFeePercent)) return "Enter a valid service fee.";
  if (!Number.isFinite(doc.rowHeightMm) || doc.rowHeightMm < 5 || doc.rowHeightMm > 80)
    return "Set a print row height between 5 and 80 mm.";
  const selected = doc.destinations.filter((dest) => dest.included);
  if (!selected.length) return "Select at least one destination.";
  for (const dest of selected) {
    if (!dest.code.trim() || !(dest.divisor > 0) || !dest.products.length) return "Complete each selected destination.";
    for (const product of dest.products) {
      if (product.image?.sourceUrl && !product.image.path) return "Import each image URL before exporting.";
      if (!product.name.trim() || !(product.factoryCny > 0) || !product.deliveryPeriod.trim()) return "Complete each product name, factory price and delivery period.";
      const nums = [product.weightKg, product.lengthCm, product.widthCm, product.heightCm, product.packing,
        product.destinationTax, product.freightOverride ?? 0, product.ratePerKgCny ?? 0, product.parcelFeeCny ?? 0];
      if (nums.some((value) => !Number.isFinite(value) || value < 0)) return "Product amounts and dimensions cannot be negative.";
      if (calculateProduct(doc, dest, product).total === null) return "Complete every selected product.";
    }
  }
  return null;
}
