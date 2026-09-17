export type QuoteImage = { path: string; sourceUrl: string };
export type QuoteProduct = {
  id: string; name: string; link: string; image: QuoteImage | null;
  factoryCny: number; weightKg: number; lengthCm: number; widthCm: number; heightCm: number;
  packing: number; freightOverride: number | null; ratePerKgCny: number | null;
  parcelFeeCny: number | null; destinationTax: number; deliveryPeriod: string;
};
export type QuoteDestination = {
  id: string; code: string; number: string; quotationNumber: string;
  origin: string; divisor: number; packingCurrency: "USD" | "EUR";
  ratePerKgCny: number; parcelFeeCny: number; taxNote: string;
  included: boolean; products: QuoteProduct[];
};
export type QuotePaymentRoute = {
  id: string; title: string; fields: { id: string; label: string; value: string }[];
};
export type QuoteDocument = {
  client: string; quoter: string; date: string; currency: string;
  displayRate: number; usdCnyRate: number; packingEurRate: number; serviceFeePercent: number;
  company: string; address: string; website: string; phone: string; email: string;
  numberPrefix: string; includeTerms: boolean; includePayment: boolean;
  layout: "portrait" | "landscape"; rowHeightMm: number;
  terms: string[]; paymentRoutes: QuotePaymentRoute[]; destinations: QuoteDestination[];
};
export type QuoteRow = {
  id: string; owner_id: string; status: "draft" | "completed";
  content: QuoteDocument; revision: number; created_at: string;
  updated_at: string; completed_at: string | null;
};

const TERMS = [
  "Exchange rate. Settled at the Bank of China buying rate on the settlement date; the rate shown is indicative for the quote month and is updated monthly.",
  "Packing. EUR 0.50 per parcel for EU destinations and USD 0.50 per parcel for all other destinations. Oversized or special packing is quoted separately.",
  "Service fee. 5% for new clients (first 3 months) and DS VIP clients; 8% for regular clients. Base = factory price + packing + international freight + destination tax; China tax and payment fee are excluded from the base.",
  "Taxes. The destination-tax line shows what is declared or collected for this shipment under the destination's current import rules — each destination page carries its own tax and duty note; it is not a flat per-parcel fee. China tax is 3% of the running total and is invoiced under Chinese tax law.",
  "Payment fee. 1% of the total. PayPal business payments add 5% and are paid by the client.",
  "Payment route. Bank transfer, Payoneer, PingPong or PayPal — the account details are in the payment details section of this quotation.",
  "Order Compensation plan & returns. Optional: 2% general goods / 3% goods with batteries / 4% sensitive or pure battery / 5% branded-style, charged on the goods value. Covers loss (theft excluded), damage and customs seizure; cap 20% of your retail price, fast-track pays 80%. Claim window 30 days with the plan, 60 days without. Evidence: a photo of the product and proof you refunded your buyer in your store. We never ship parcels back from China — we refund or re-ship.",
  "Storage. Free for the first 3 months; after that $10 per cbm per month, rising 10% each month. Volumes over 0.1 cbm round up to 1 cbm.",
  "Credit line. From $200, subject to review (connected store + pending orders of at least $200). Usually repaid within 4 weeks; over 8 weeks is treated as bad debt.",
  "Validity. This quotation is valid for 15 days from the date shown above.",
];

export const QUOTE_CURRENCIES = {
  USD: { symbol: "$", rate: 1 }, CNY: { symbol: "¥", rate: 6.7 },
  EUR: { symbol: "€", rate: 0.92 }, GBP: { symbol: "£", rate: 0.79 },
  AUD: { symbol: "A$", rate: 1.52 }, CAD: { symbol: "C$", rate: 1.37 },
  HKD: { symbol: "HK$", rate: 7.8 }, JPY: { symbol: "¥", rate: 147 },
} as const;

const EU = new Set("AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE".split(" "));
const TAX_NOTES: Record<string, string> = {
  US: "US: sales tax and duty follow the state threshold; the de minimis rule applies.",
  CA: "CA: GST/HST plus duty, cleared by CBSA.",
  UK: "UK: VAT 20% under the UK import scheme (IOSS does not apply).",
  DE: "EU: IOSS for goods up to EUR 150; DE VAT 19%.",
  FR: "EU: IOSS for goods up to EUR 150; FR VAT 20%.",
  IT: "EU: IOSS for goods up to EUR 150; IT VAT 22%.",
  ES: "EU: IOSS for goods up to EUR 150; ES VAT 21%.",
  NL: "EU: IOSS for goods up to EUR 150; NL VAT 21%.",
  AU: "AU: GST 10% collected at checkout for goods up to AUD 1,000.",
  NZ: "NZ: GST 15% for goods up to NZD 1,000.",
  JP: "JP: consumption tax 10% under the simplified import rules.",
  SG: "SG: GST 9% collected at checkout on low-value goods.",
  AE: "AE: VAT 5% on imports; customs duty per the tariff schedule.",
};
export function defaultTaxNote(code: string) {
  const normalized = code.trim().toUpperCase();
  return TAX_NOTES[normalized] ?? (normalized
    ? `Tax and duty per ${normalized} current import rules.`
    : "Tax and duty per the destination country's current rules.");
}
export function newProduct(): QuoteProduct {
  // 产品只保存员工填写的原始数值；合计由 calculate.ts 随时重算，避免保存两套金额。
  return { id: crypto.randomUUID(), name: "", link: "", image: null, factoryCny: 0,
    weightKg: 0, lengthCm: 0, widthCm: 0, heightCm: 0, packing: 0.5,
    freightOverride: null, ratePerKgCny: null, parcelFeeCny: null,
    destinationTax: 0, deliveryPeriod: "" };
}
export function newDestination(index: number): QuoteDestination {
  // 每个目的地拥有独立产品行和运费参数，生成 PDF 时也会从新页开始。
  return { id: crypto.randomUUID(), code: index === 0 ? "US" : "",
    number: String(index + 1).padStart(2, "0"), quotationNumber: "",
    origin: "Shenzhen Warehouse", divisor: 6000, packingCurrency: "USD",
    ratePerKgCny: 0, parcelFeeCny: 0, taxNote: index === 0 ? defaultTaxNote("US") : "", included: true,
    products: [newProduct()] };
}
export function newQuote(): QuoteDocument {
  const route = (title: string, labels: string[]): QuotePaymentRoute => ({
    id: crypto.randomUUID(), title,
    fields: labels.map((label) => ({ id: crypto.randomUUID(), label, value: "" })),
  });
  return { client: "", quoter: "", date: new Date().toISOString().slice(0, 10),
    currency: "USD", displayRate: 1, usdCnyRate: 6.7, packingEurRate: 0.92, serviceFeePercent: 5,
    company: "PT5 China Sourcing Management Co., Limited",
    address: "Building 29, Haishang Mingmen, Haimen, Nantong 226006",
    website: "https://www.pt5-dropshipping.com", phone: "+86 13962913045",
    email: "", numberPrefix: "PT5-DS", includeTerms: true,
    includePayment: true, layout: "landscape", rowHeightMm: 26,
    terms: [...TERMS],
    paymentRoutes: [
      route("A · Bank transfer — international", ["Beneficiary name", "Beneficiary address", "Account number / IBAN", "Bank name", "Bank address", "SWIFT / BIC", "Intermediary bank (if any)", "Payment reference"]),
      route("B · Payoneer", ["Account email", "Payoneer ID / account", "Account holder", "Currency"]),
      route("C · PingPong", ["Account email", "PingPong ID / account", "Account holder", "Currency"]),
      route("D · PayPal", ["PayPal account"]),
      route("E · Payment advice", ["Send proof to", "Paid amount", "Paid on", "Remarks"]),
    ], destinations: [newDestination(0)] };
}
export function defaultPackingCurrency(code: string): "USD" | "EUR" {
  return EU.has(code.toUpperCase()) ? "EUR" : "USD";
}
export function quotationNumber(doc: QuoteDocument, dest: QuoteDestination): string {
  return dest.quotationNumber.trim() || [doc.numberPrefix || "PT5-DS", dest.code.toUpperCase() || "US",
    doc.date.replaceAll("-", ""), dest.number || "01"].join("-");
}
export function imagePaths(doc: QuoteDocument): string[] {
  // 去重后的对象路径用于导出前取图，以及删除报价后的存储清理。
  return [...new Set(doc.destinations.flatMap((dest) => dest.products.map((p) => p.image?.path).filter((path): path is string => Boolean(path))))];
}
