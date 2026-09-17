import { Document, Image as PdfImage, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { calculateDestination, calculateProduct, quoteCurrency } from "@/lib/quotations/calculate";
import { quotationNumber, type QuoteDestination, type QuoteDocument, type QuoteProduct } from "@/lib/quotations/model";
import colors from "@/config/quotation-pdf-colors.json";

const sheet = StyleSheet.create({
  page: { paddingTop: 27, paddingHorizontal: 27, paddingBottom: 28, fontFamily: "Helvetica", fontSize: 8, color: colors.ink },
  letterhead: { flexDirection: "row", justifyContent: "space-between", minHeight: 66, gap: 12 },
  company: { fontFamily: "Helvetica-Bold", fontSize: 18, color: colors.navy, marginBottom: 3 },
  companyLine: { fontSize: 7.5, lineHeight: 1.5, marginBottom: 1 },
  meta: { flexDirection: "row", justifyContent: "flex-end", gap: 5, marginBottom: 2 },
  metaLabel: { fontFamily: "Helvetica-Bold", color: colors.muted, fontSize: 7, textTransform: "uppercase" },
  metaValue: { fontSize: 8, textAlign: "right" },
  metaImportant: { fontFamily: "Helvetica-Bold", color: colors.navy, fontSize: 9 },
  docTitle: { fontFamily: "Times-Bold", fontSize: 24, letterSpacing: 6, color: colors.navy,
    textAlign: "center", paddingTop: 12, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: colors.orange },
  tax: { paddingTop: 5, paddingBottom: 5, borderBottomWidth: .6, borderBottomColor: colors.line,
    backgroundColor: "#fffdf7", textAlign: "center", fontSize: 7, color: colors.muted },
  taxValue: { color: colors.navy, fontFamily: "Helvetica-Bold", fontSize: 8, marginTop: 2 },
  shared: { paddingVertical: 4, textAlign: "center", borderBottomWidth: .6, borderBottomColor: colors.line,
    color: colors.muted, fontSize: 7 },
  tableHeader: { flexDirection: "row", backgroundColor: colors.navy, color: "#fff", borderTopLeftRadius: 6,
    borderTopRightRadius: 6, minHeight: 24, alignItems: "center" },
  tableHeading: { textAlign: "center", fontFamily: "Helvetica-Bold", fontSize: 7, paddingHorizontal: 2 },
  row: { flexDirection: "row", borderLeftWidth: .6, borderRightWidth: .6, borderBottomWidth: .6,
    borderColor: colors.line, minHeight: 48 },
  productCell: { width: "20%", flexDirection: "row", alignItems: "center", padding: 4,
    borderRightWidth: .6, borderColor: colors.line, gap: 4 },
  priceCell: { width: "10%", textAlign: "center", paddingHorizontal: 2, paddingTop: 14,
    borderRightWidth: .6, borderColor: colors.line, fontSize: 8 },
  lastPrice: { color: colors.orange, fontFamily: "Helvetica-Bold", borderRightWidth: 0 },
  index: { color: colors.orange, fontFamily: "Helvetica-Bold", fontSize: 9 },
  picture: { width: 40, height: 38, objectFit: "contain", borderWidth: .5, borderColor: colors.line,
    borderRadius: 4 },
  productName: { fontFamily: "Helvetica-Bold", fontSize: 8, color: colors.navy },
  details: { textAlign: "center", borderBottomWidth: 2, borderBottomColor: colors.orange,
    borderLeftWidth: .6, borderRightWidth: .6, borderLeftColor: colors.line, borderRightColor: colors.line,
    paddingVertical: 4, marginBottom: 3, fontSize: 7.5 },
  sectionTitle: { color: colors.orange, fontFamily: "Helvetica-Bold", fontSize: 10,
    letterSpacing: 1, textTransform: "uppercase", marginBottom: 7 },
  sectionNote: { color: colors.muted, fontSize: 7.2, marginBottom: 14 },
  term: { flexDirection: "row", gap: 10, paddingVertical: 7, borderBottomWidth: .5,
    borderBottomColor: colors.line },
  numberCircle: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#f2f6fa",
    color: colors.navy, fontFamily: "Helvetica-Bold", fontSize: 8, textAlign: "center", paddingTop: 5 },
  termText: { flex: 1, fontSize: 9, lineHeight: 1.45 },
  routeGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  route: { width: "49%", borderWidth: .6, borderColor: colors.line, borderRadius: 8,
    padding: 8, marginBottom: 7, minHeight: 65 },
  routeTitle: { color: colors.orange, fontFamily: "Helvetica-Bold", fontSize: 7.5,
    letterSpacing: .6, textTransform: "uppercase", marginBottom: 8 },
  routeField: { flexDirection: "row", gap: 5, marginBottom: 3, fontSize: 7.3 },
  routeLabel: { width: "37%", fontFamily: "Helvetica-Bold", color: colors.muted },
  routeValue: { flex: 1 },
  portraitCard: { borderWidth: .6, borderColor: colors.line, borderRadius: 6, padding: 8, marginBottom: 5 },
  portraitTitle: { color: colors.navy, fontFamily: "Helvetica-Bold", fontSize: 10, marginBottom: 5 },
  portraitInfo: { color: colors.muted, fontSize: 7.5, lineHeight: 1.5 },
  portraitTotal: { color: colors.orange, fontFamily: "Helvetica-Bold", fontSize: 9, marginTop: 5 },
});

const headings = ["Product", "Factory price", "Packing", "Intl freight", "Destination tax",
  "Service fee", "China tax", "Payment fee", "Total"];
const num = (value: number) => value.toFixed(2);

function CompanyHeader({ doc, dest }: { doc: QuoteDocument; dest: QuoteDestination }) {
  return <View style={sheet.letterhead}>
    <View style={{ width: "62%" }}>
      <Text style={sheet.company}>{doc.company}</Text>
      <Text style={sheet.companyLine}><Text style={sheet.metaLabel}>Address  </Text>{doc.address}</Text>
      <Text style={sheet.companyLine}><Text style={sheet.metaLabel}>Website  </Text>{doc.website}</Text>
      <Text style={sheet.companyLine}><Text style={sheet.metaLabel}>Mobile / Whatsapp  </Text>{doc.phone} {doc.email}</Text>
    </View>
    <View style={{ width: "38%" }}>
      {[["Quotation no.", quotationNumber(doc, dest)], ["Date", doc.date.replaceAll("-", ".")],
        ["Destination", dest.code], ["Client", doc.client], ["Quoted by", doc.quoter]].map(([label, value], i) =>
        <View key={label} style={sheet.meta}><Text style={sheet.metaLabel}>{label}</Text>
          <Text style={i === 0 ? sheet.metaImportant : sheet.metaValue}>{value}</Text></View>)}
    </View>
  </View>;
}

function LandscapeProduct({ doc, dest, product, index, images }: {
  doc: QuoteDocument; dest: QuoteDestination; product: QuoteProduct; index: number; images: Record<string, string>;
}) {
  const result = calculateProduct(doc, dest, product);
  const symbol = quoteCurrency(doc);
  const amounts = [result.factory, result.packing, result.freight, result.destinationTax,
    result.service, result.chinaTax, result.payment, result.total];
  // 普通产品两行一起换页；超长名称允许 React PDF 自动续页，避免内容被页底裁掉。
  const canSplit = product.name.length > 150 || product.deliveryPeriod.length > 120 || doc.rowHeightMm > 60;
  return <View wrap={canSplit}>
    <View style={[sheet.row, { minHeight: canSplit ? 38 : Math.max(38, doc.rowHeightMm * 1.5) }]}>
      <View style={sheet.productCell}>
        <Text style={sheet.index}>#{index + 1}</Text>
        {product.image?.path && images[product.image.path]
          ? <PdfImage src={images[product.image.path]} style={sheet.picture} /> : null}
        <View style={{ flex: 1 }}><Text style={sheet.productName}>{product.name}</Text>
          {product.link ? <Link src={product.link} style={{ fontSize: 6.5, color: colors.link }}>Product link</Link> : null}</View>
      </View>
      {amounts.map((amount, i) => <Text key={i} style={[sheet.priceCell, i === amounts.length - 1 ? sheet.lastPrice : {}]}>
        {amount === null ? "—" : `${symbol} ${num(amount)}`}
      </Text>)}
    </View>
    <View style={sheet.details}><Text>Actual weight &amp; package size: {num(product.weightKg)} kg, {product.lengthCm} × {product.widthCm} × {product.heightCm} cm, volumetric {num(result.volumetricKg)} kg, chargeable {num(result.chargeableKg)} kg</Text>
      <Text>Delivery period: {product.deliveryPeriod || "—"}</Text></View>
  </View>;
}

function PortraitProduct({ doc, dest, product, index, images }: {
  doc: QuoteDocument; dest: QuoteDestination; product: QuoteProduct; index: number; images: Record<string, string>;
}) {
  const result = calculateProduct(doc, dest, product);
  const symbol = quoteCurrency(doc);
  return <View style={[sheet.portraitCard, { minHeight: Math.max(75, doc.rowHeightMm * 2.83) }]}
    wrap={product.name.length > 200 || product.deliveryPeriod.length > 120 || doc.rowHeightMm > 60}>
    <View style={{ flexDirection: "row", gap: 8 }}>
      {product.image?.path && images[product.image.path]
        ? <PdfImage src={images[product.image.path]} style={{ width: 55, height: 50, objectFit: "contain" }} /> : null}
      <View style={{ flex: 1 }}><Text style={sheet.portraitTitle}>#{index + 1}  {product.name}</Text>
        {product.link ? <Link src={product.link} style={{ color: colors.link, fontSize: 7 }}>Product link</Link> : null}
        <Text style={sheet.portraitInfo}>Delivery period: {product.deliveryPeriod || "—"}</Text></View>
    </View>
    <Text style={sheet.portraitInfo}>Factory price {symbol} {num(result.factory)}  ·  Actual weight {num(product.weightKg)} kg  ·  Package size {product.lengthCm} × {product.widthCm} × {product.heightCm} cm  ·  Volumetric {num(result.volumetricKg)} kg</Text>
    <Text style={sheet.portraitInfo}>Packing {symbol} {num(result.packing)}  ·  Intl freight {symbol} {num(result.freight)}  ·  Destination tax {symbol} {num(result.destinationTax)}  ·  Service fee {symbol} {num(result.service)}  ·  China tax {symbol} {num(result.chinaTax)}  ·  Payment fee {symbol} {num(result.payment)}</Text>
    <Text style={sheet.portraitTotal}>Total {result.total === null ? "—" : `${symbol} ${num(result.total)}`}</Text>
  </View>;
}

export function QuotePdf({ doc, images }: { doc: QuoteDocument; images: Record<string, string> }) {
  const symbol = quoteCurrency(doc);
  return <Document title={`Costlist-${doc.client}`} author={doc.quoter}>
    {doc.destinations.filter((dest) => dest.included).map((dest) => <Page key={dest.id} size="A4" orientation={doc.layout} style={sheet.page} wrap>
      <CompanyHeader doc={doc} dest={dest} />
      <Text style={sheet.docTitle}>COST LIST</Text>
      <View style={sheet.tax}><Text>Tax &amp; duty note for this destination:</Text><Text style={sheet.taxValue}>{dest.taxNote}</Text></View>
      <Text style={sheet.shared}>Client: {doc.client}  ·  Quoted by: {doc.quoter}  ·  Date: {doc.date.replaceAll("-", "")}  ·  Currency: {doc.currency}  ·  FX US$1 = CNY: {doc.usdCnyRate}  ·  Service fee: {doc.serviceFeePercent}%</Text>
      {doc.layout === "landscape" ? <View style={sheet.tableHeader} fixed>{headings.map((heading, index) =>
        <Text key={heading} style={[sheet.tableHeading, { width: index === 0 ? "20%" : "10%" }]}>{heading}{index ? `\n(${doc.currency})` : ""}</Text>)}</View> : null}
      {dest.products.map((product, index) => doc.layout === "landscape"
        ? <LandscapeProduct key={product.id} doc={doc} dest={dest} product={product} index={index} images={images} />
        : <PortraitProduct key={product.id} doc={doc} dest={dest} product={product} index={index} images={images} />)}
      <Text style={{ fontSize: 7, color: colors.muted, marginTop: 6, textAlign: "right" }}>Destination total: {symbol} {num(calculateDestination(doc, dest))}</Text>
    </Page>)}
    {doc.includeTerms ? <Page size="A4" orientation={doc.layout} style={sheet.page} wrap>
      <Text style={sheet.sectionTitle}>Terms &amp; notes</Text>
      <Text style={sheet.sectionNote}>These terms apply to every destination in this quotation. One destination, one cost-list page; the tax and duty note for each destination sits on that destination&apos;s own page.</Text>
      {doc.terms.map((term, index) => {
        const split = term.indexOf(".");
        return <View key={index} style={sheet.term} wrap={false}>
          <Text style={sheet.numberCircle}>{index + 1}</Text>
          <Text style={sheet.termText}>{split > 0 ? <><Text style={{ fontFamily: "Helvetica-Bold", color: colors.navy }}>{term.slice(0, split + 1)}</Text>{term.slice(split + 1)}</> : term}</Text>
        </View>;
      })}
    </Page> : null}
    {doc.includePayment ? <Page size="A4" orientation={doc.layout} style={sheet.page} wrap>
      <Text style={sheet.sectionTitle}>Payment details</Text>
      <Text style={sheet.sectionNote}>Fill in only the route you want the client to use. Any route not used can be left blank or deleted before sending.</Text>
      <View style={sheet.routeGrid}>{doc.paymentRoutes.map((route) => <View key={route.id} style={sheet.route} wrap={false}>
        <Text style={sheet.routeTitle}>{route.title}</Text>
        {route.fields.map((field) => <View key={field.id} style={sheet.routeField}>
          <Text style={sheet.routeLabel}>{field.label}</Text>
          <Text style={sheet.routeValue}>{field.value || (field.label === "Payment reference" ? quotationNumber(doc, doc.destinations[0]) : "")}</Text>
        </View>)}
      </View>)}</View>
    </Page> : null}
  </Document>;
}
