"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import * as FormControls from "@/components/ui/form-controls";
import { DashboardFilePicker } from "@/components/dashboard/dashboard-framework-primitives";
import { calculateProduct, quoteCurrency } from "@/lib/quotations/calculate";
import { type QuoteDestination, type QuoteDocument, type QuoteProduct } from "@/lib/quotations/model";
import { quoteOriginalCopy as copy } from "@/lib/quotations/original-copy";

type Props = {
  doc: QuoteDocument;
  dest: QuoteDestination;
  imageUrls: Record<string, string>;
  uploadImage: (file: File) => Promise<string>;
  importImage: (url: string) => Promise<string>;
  onError: (message: string) => void;
  changeDest: (update: (current: QuoteDestination) => QuoteDestination) => void;
};

function Num({ value, onChange, placeholder, step = "0.01" }: {
  value: number | null; onChange: (value: number | null) => void; placeholder?: string; step?: string;
}) {
  return <FormControls.Input type="number" min="0" step={step} placeholder={placeholder} value={value ?? ""}
    onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))} />;
}

export function QuoteProductTable({ doc, dest, imageUrls, uploadImage, importImage, onError, changeDest }: Props) {
  // 上传结果通过产品 ID 写回，等待网络请求时仍可继续修改同一目的地的其他产品。
  const changeProduct = (id: string, update: (product: QuoteProduct) => QuoteProduct) => changeDest((current) => ({
    ...current, products: current.products.map((product) => product.id === id ? update(product) : product),
  }));
  const upload = async (id: string, file: File) => {
    try {
      const path = await uploadImage(file);
      changeProduct(id, (product) => ({ ...product, image: { path, sourceUrl: "" } }));
    } catch (cause) { onError(cause instanceof Error ? cause.message : "Image upload failed."); }
  };
  const headings = ["#", "Product photo", "Product name", `Factory price (${doc.currency})`, "Actual weight (kg)",
    "Package size L × W × H (cm)", "Volumetric weight (kg)", "Chargeable weight (kg)", `Packing (${doc.currency})`,
    `Intl freight (${doc.currency})`, `Destination tax (${doc.currency})`, `Service fee ${doc.serviceFeePercent}% (${doc.currency})`,
    `China tax 3% (${doc.currency})`, `Payment fee 1% (${doc.currency})`, `Total (${doc.currency})`, "Delivery period", "Row"];
  return <div className="q-table-scroll"><table className="q-table"><thead><tr>{headings.map((heading) => <th key={heading}>{heading}</th>)}</tr></thead>
    <tbody>{dest.products.map((product, index) => {
      const result = calculateProduct(doc, dest, product);
      const money = (value: number | null) => value === null ? "—" : `${quoteCurrency(doc)} ${value.toFixed(2)}`;
      const set = <K extends keyof QuoteProduct>(key: K, value: QuoteProduct[K]) => changeProduct(product.id, (current) => ({ ...current, [key]: value }));
      const setNumber = (key: keyof QuoteProduct) => (value: number | null) => set(key, value as never);
      return <tr key={product.id}><td>{index + 1}</td>
        <td><div className="q-image-box" role="button" tabIndex={0} aria-label={copy.text025}
          onPaste={(event) => { const file = [...event.clipboardData.files][0]; if (file) { event.preventDefault(); void upload(product.id, file); } }}>
          {product.image?.path && imageUrls[product.image.path]
            ? <Image src={imageUrls[product.image.path]} alt={copy.text024} width={66} height={66} unoptimized />
            : <span>{copy.text025}</span>}
        </div><DashboardFilePicker accept="image/png,image/jpeg,image/webp" label={copy.text025}
          onFiles={(files) => { if (files[0]) void upload(product.id, files[0]); }} />
          <FormControls.Input className="q-url" placeholder={copy.text026} value={product.image?.sourceUrl ?? ""}
            onChange={(event) => set("image", { path: "", sourceUrl: event.target.value })} />
          <Button type="button" onClick={async () => { if (product.image?.sourceUrl) {
            try { const path = await importImage(product.image.sourceUrl); set("image", { path, sourceUrl: product.image.sourceUrl }); }
            catch (cause) { onError(cause instanceof Error ? cause.message : "Image import failed."); }
          } }}>{copy.text027}</Button>
          {product.image ? <Button type="button" onClick={() => set("image", null)}>{copy.text028}</Button> : null}</td>
        <td><FormControls.Input placeholder={copy.text029} value={product.name} onChange={(event) => set("name", event.target.value)} />
          <FormControls.Input placeholder={copy.text030} value={product.link} onChange={(event) => set("link", event.target.value)} /></td>
        <td><Num value={product.factoryCny} onChange={setNumber("factoryCny")} /><small>{result.factory ? money(result.factory) : "—"}</small></td>
        <td><Num value={product.weightKg} onChange={setNumber("weightKg")} /></td>
        <td className="q-dims"><Num value={product.lengthCm} onChange={setNumber("lengthCm")} step="0.1" placeholder={copy.text077} />
          <Num value={product.widthCm} onChange={setNumber("widthCm")} step="0.1" placeholder={copy.text078} />
          <Num value={product.heightCm} onChange={setNumber("heightCm")} step="0.1" placeholder={copy.text079} /></td>
        <td className="q-calculated">{result.volumetricKg ? result.volumetricKg.toFixed(2) : "—"}</td>
        <td className="q-calculated">{result.chargeableKg ? result.chargeableKg.toFixed(2) : "—"}</td>
        <td><Num value={product.packing} onChange={setNumber("packing")} /></td>
        <td><Num value={product.freightOverride} onChange={setNumber("freightOverride")} placeholder={copy.text019} />
          <small>{copy.text031}{money(result.freight)}</small><Num value={product.ratePerKgCny} onChange={setNumber("ratePerKgCny")} placeholder={copy.text032} />
          <Num value={product.parcelFeeCny} onChange={setNumber("parcelFeeCny")} placeholder={copy.text033} /></td>
        <td><Num value={product.destinationTax} onChange={setNumber("destinationTax")} /></td>
        <td className="q-calculated">{money(result.service)}</td><td className="q-calculated">{money(result.chinaTax)}</td>
        <td className="q-calculated">{money(result.payment)}</td><td className="q-total"><b>{money(result.total)}</b></td>
        <td><FormControls.Input value={product.deliveryPeriod} onChange={(event) => set("deliveryPeriod", event.target.value)} placeholder={copy.text034} /></td>
        <td><Button type="button" onClick={() => changeDest((current) => ({ ...current, products: [...current.products.slice(0, index + 1), { ...product, id: crypto.randomUUID() }, ...current.products.slice(index + 1)] }))}>+</Button>
          <Button type="button" disabled={dest.products.length === 1} onClick={() => changeDest((current) => ({ ...current, products: current.products.filter((row) => row.id !== product.id) }))}>×</Button></td>
      </tr>;
    })}</tbody></table></div>;
}
