"use client";

import { quoteOriginalCopy as copy } from "@/lib/quotations/original-copy";

import type { Dispatch, ReactNode, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import * as FormControls from "@/components/ui/form-controls";
import { DatePicker } from "@/components/ui/date-picker";
import { Select } from "@/components/ui/select";
import { QuoteTerms, QuotePayments } from "./quote-appendices";
import { QuoteProductTable } from "./quote-product-table";
import { calculateDestination, quoteCurrency } from "@/lib/quotations/calculate";
import { defaultPackingCurrency, defaultTaxNote, newDestination, newProduct, quotationNumber,
  QUOTE_CURRENCIES, type QuoteDestination, type QuoteDocument } from "@/lib/quotations/model";

type Props = {
  doc: QuoteDocument; change: Dispatch<SetStateAction<QuoteDocument>>;
  uploadImage: (file: File) => Promise<string>;
  importImage: (url: string) => Promise<string>;
  onError: (message: string) => void;
  imageUrls: Record<string, string>;
};
type EntryProps = { label: string; children: ReactNode };
const numeric = (value: string) => value.trim() === "" ? 0 : Number(value);
function Entry({ label, children }: EntryProps) {
  return <FormControls.Field className="q-entry" label={label}>{children}</FormControls.Field>;
}
function Num({ value, onChange, step = "0.01", placeholder }: {
  value: number | null; onChange: (value: number | null) => void; step?: string; placeholder?: string;
}) {
  return <FormControls.Input type="number" min="0" step={step} placeholder={placeholder}
    value={value ?? ""} onChange={(event) => onChange(event.target.value === "" ? null : numeric(event.target.value))} />;
}
export function QuoteForm({ doc, change, uploadImage, importImage, imageUrls, onError }: Props) {
  const set = <K extends keyof QuoteDocument>(key: K, value: QuoteDocument[K]) => change((current) => ({ ...current, [key]: value }));
  // 通过目的地、产品 ID 更新对应行，避免异步图片上传完成时覆盖员工刚输入的其他字段。
  const setDest = (id: string, update: (dest: QuoteDestination) => QuoteDestination) =>
    change((current) => ({ ...current, destinations: current.destinations.map((dest) => dest.id === id ? update(dest) : dest) }));
  return <div className="q-form">
    <div className="q-bar"><b className="q-brand">{copy.text004}</b>
      <div className="q-grid">
        <Entry label="Client / store"><FormControls.Input value={doc.client} onChange={(e) => set("client", e.target.value)} /></Entry>
        <Entry label="Quoted by"><FormControls.Input value={doc.quoter} onChange={(e) => set("quoter", e.target.value)} /></Entry>
        <Entry label="Date"><DatePicker value={doc.date} onValueChange={(value) => set("date", value)} /></Entry>
        <Entry label="Currency"><Select value={doc.currency} onValueChange={(code) => {
          change((current) => ({ ...current, currency: code, displayRate: QUOTE_CURRENCIES[code as keyof typeof QUOTE_CURRENCIES].rate }));
        }} options={Object.keys(QUOTE_CURRENCIES).map((code) => ({ value: code, label: code }))} /></Entry>
        <Entry label="Display rate (1 USD =)"><Num value={doc.displayRate} onChange={(v) => set("displayRate", v ?? 0)} step="0.0001" /></Entry>
        <Entry label="FX US$1 = CNY"><Num value={doc.usdCnyRate} onChange={(v) => set("usdCnyRate", v ?? 0)} /></Entry>
        <Entry label="Service fee %"><Num value={doc.serviceFeePercent} onChange={(v) => set("serviceFeePercent", v ?? 0)} step="0.1" /></Entry>
        <Entry label="Company (prints)"><FormControls.Input value={doc.company} onChange={(e) => set("company", e.target.value)} /></Entry>
        <Entry label="Address (prints)"><FormControls.Input value={doc.address} onChange={(e) => set("address", e.target.value)} /></Entry>
        <Entry label="Website (prints)"><FormControls.Input value={doc.website} onChange={(e) => set("website", e.target.value)} /></Entry>
        <Entry label="Phone / WhatsApp (prints)"><FormControls.Input value={doc.phone} onChange={(e) => set("phone", e.target.value)} /></Entry>
        <Entry label="Email (prints)"><FormControls.Input value={doc.email} onChange={(e) => set("email", e.target.value)} /></Entry>
        <Entry label="Quote no. prefix"><FormControls.Input value={doc.numberPrefix} onChange={(e) => set("numberPrefix", e.target.value)} /></Entry>
      </div>
      <div className="q-options">
        <Button type="button" onClick={() => set("destinations", [...doc.destinations, newDestination(doc.destinations.length)])}>{copy.text005}</Button>
        <Button type="button" onClick={() => set("destinations", doc.destinations.map((dest) => ({ ...dest, included: true })))}>Select all</Button>
        <Button type="button" onClick={() => set("destinations", doc.destinations.map((dest) => ({ ...dest, included: false })))}>Select none</Button>
        <div><FormControls.Checkbox aria-label={copy.text006} checked={doc.includeTerms} onChange={(e) => set("includeTerms", e.target.checked)} />{copy.text006}</div>
        <div><FormControls.Checkbox aria-label={copy.text007} checked={doc.includePayment} onChange={(e) => set("includePayment", e.target.checked)} />{copy.text007}</div>
        <Entry label="PDF layout"><Select value={doc.layout} onValueChange={(value) => change((current) => ({ ...current, layout: value as QuoteDocument["layout"], rowHeightMm: value === "portrait" ? 26 : 12 }))}
          options={[{ value: "landscape", label: copy.text008 }, { value: "portrait", label: copy.text009 }]} /></Entry>
        <Entry label="Print row height (mm)"><Num value={doc.rowHeightMm} step="1" onChange={(v) => set("rowHeightMm", v ?? 12)} /></Entry>
        <Entry label="EUR per USD (packing)"><Num value={doc.packingEurRate} onChange={(v) => set("packingEurRate", v ?? 0)} step="0.0001" /></Entry>
      </div>
    </div>
    {doc.destinations.map((dest, destIndex) => <section className="q-page" key={dest.id}>
      <div className="q-letterhead"><div><h2>{doc.company}</h2><p><b>Address</b> {doc.address}</p><p><b>Website</b> {doc.website}</p><p><b>Mobile / Whatsapp</b> {doc.phone} {doc.email}</p></div>
        <div><p><b>{copy.text010}</b><strong>{quotationNumber(doc, dest)}</strong></p><p><b>{copy.text011}</b>{doc.date.replaceAll("-", ".")}</p><p><b>{copy.text012}</b>{dest.code}</p><p><b>{copy.text013}</b>{doc.client}</p><p><b>{copy.text014}</b>{doc.quoter}</p></div></div>
      <div className="q-page-head"><div><small>{copy.text015}</small><h2>{copy.text016}{doc.client || "[client]"}-{dest.code || "[destination]"}-{doc.quoter || "[quoted by]"}-{doc.date.replaceAll("-", "")}-{dest.number}</h2></div>
        <div><div><FormControls.Checkbox aria-label={copy.text017} checked={dest.included} onChange={(e) => setDest(dest.id, (d) => ({ ...d, included: e.target.checked }))} />{copy.text017}</div>
          <Button type="button" disabled={doc.destinations.length === 1} onClick={() => set("destinations", doc.destinations.filter((d) => d.id !== dest.id))}>{copy.text018}</Button></div></div>
      <div className="q-grid q-dest-fields">
        <Entry label="Destination"><FormControls.Input value={dest.code} onChange={(e) => setDest(dest.id, (d) => ({ ...d,
          code: e.target.value.toUpperCase(), packingCurrency: defaultPackingCurrency(e.target.value),
          taxNote: !d.taxNote || d.taxNote === defaultTaxNote(d.code) ? defaultTaxNote(e.target.value) : d.taxNote,
        }))} /></Entry>
        <Entry label="No."><FormControls.Input value={dest.number} onChange={(e) => setDest(dest.id, (d) => ({ ...d, number: e.target.value }))} /></Entry>
        <Entry label="Origin warehouse"><FormControls.Input value={dest.origin} onChange={(e) => setDest(dest.id, (d) => ({ ...d, origin: e.target.value }))} /></Entry>
        <Entry label="Volumetric divisor"><Num value={dest.divisor} step="1" onChange={(v) => setDest(dest.id, (d) => ({ ...d, divisor: v ?? 0 }))} /></Entry>
        <Entry label="Packing currency"><Select value={dest.packingCurrency} onValueChange={(value) => setDest(dest.id, (d) => ({ ...d, packingCurrency: value as "USD" | "EUR" }))}
          options={[{ value: "USD", label: copy.text075 }, { value: "EUR", label: copy.text076 }]} /></Entry>
        <Entry label="Freight rate / kg (CNY)"><Num value={dest.ratePerKgCny} onChange={(v) => setDest(dest.id, (d) => ({ ...d, ratePerKgCny: v ?? 0 }))} /></Entry>
        <Entry label="Parcel fee (CNY)"><Num value={dest.parcelFeeCny} onChange={(v) => setDest(dest.id, (d) => ({ ...d, parcelFeeCny: v ?? 0 }))} /></Entry>
      </div>
      <details className="q-override"><summary>Quotation number override</summary><FormControls.Input value={dest.quotationNumber} placeholder={copy.text019} onChange={(e) => setDest(dest.id, (d) => ({ ...d, quotationNumber: e.target.value }))} /></details>
      <h2 className="q-document-title">{copy.text020}</h2>
      <div className="q-tax"><Entry label="Tax & duty note for this destination"><FormControls.Input value={dest.taxNote} onChange={(e) => setDest(dest.id, (d) => ({ ...d, taxNote: e.target.value }))} /></Entry></div>
      <p className="q-shared">{copy.text021}{doc.currency}{copy.text022}{doc.usdCnyRate}{copy.text023}{doc.serviceFeePercent}%</p>
      <QuoteProductTable doc={doc} dest={dest} imageUrls={imageUrls} uploadImage={uploadImage} importImage={importImage}
        onError={onError} changeDest={(update) => setDest(dest.id, update)} />
      <div className="q-page-footer"><Button type="button" onClick={() => setDest(dest.id, (d) => ({ ...d, products: [...d.products, newProduct()] }))}>{copy.text035}</Button>
        <strong>{copy.text036}{quoteCurrency(doc)} {calculateDestination(doc, dest).toFixed(2)}</strong></div>
      <small>{copy.text037}{destIndex + 1}{copy.text038}{doc.destinations.length}</small>
    </section>)}
    <QuoteTerms doc={doc} change={change} />
    <QuotePayments doc={doc} change={change} />
  </div>;
}
