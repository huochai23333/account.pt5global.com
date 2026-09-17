"use client";

import { quoteOriginalCopy as copy } from "@/lib/quotations/original-copy";
import { Button } from "@/components/ui/button";
import * as FormControls from "@/components/ui/form-controls";
import type { Dispatch, SetStateAction } from "react";
import type { QuoteDocument } from "@/lib/quotations/model";

type Props = { doc: QuoteDocument; change: Dispatch<SetStateAction<QuoteDocument>> };

export function QuoteTerms({ doc, change }: Props) {
  return <section className="q-page q-appendix"><h2>{copy.text039}</h2>
    <p>{copy.text040}</p>
    {doc.terms.map((term, index) => <div className="q-terms-row" key={index}><span>{index + 1}</span>
      <FormControls.Textarea value={term} onChange={(e) => change({ ...doc, terms: doc.terms.map((t, i) => i === index ? e.target.value : t) })} /></div>)}
    <Button type="button" onClick={() => change({ ...doc, terms: [...doc.terms, ""] })}>{copy.text041}</Button>
  </section>;
}
export function QuotePayments({ doc, change }: Props) {
  return <section className="q-page q-appendix"><h2>{copy.text042}</h2>
    <p>{copy.text043}</p>
    <div className="q-payment-grid">{doc.paymentRoutes.map((route, index) => <div className="q-payment-card" key={route.id}>
      <div className="q-payment-head"><FormControls.Input value={route.title} onChange={(e) => change({ ...doc, paymentRoutes: doc.paymentRoutes.map((r) => r.id === route.id ? { ...r, title: e.target.value } : r) })} />
        <Button type="button" onClick={() => change({ ...doc, paymentRoutes: doc.paymentRoutes.filter((r) => r.id !== route.id) })}>×</Button></div>
      {route.fields.map((field) => <FormControls.Field key={field.id} className="q-entry" label={field.label}><FormControls.Input value={field.value} onChange={(e) => change({ ...doc, paymentRoutes: doc.paymentRoutes.map((r) => r.id === route.id ? { ...r, fields: r.fields.map((f) => f.id === field.id ? { ...f, value: e.target.value } : f) } : r) })} /></FormControls.Field>)}
      <Button type="button" onClick={() => change({ ...doc, paymentRoutes: doc.paymentRoutes.map((r) => r.id === route.id ? { ...r, fields: [...r.fields, { id: crypto.randomUUID(), label: `Field ${r.fields.length + 1}`, value: "" }] } : r) })}>{copy.text044}</Button>
      <small>{copy.text045}{index + 1}</small>
    </div>)}</div>
    <Button type="button" onClick={() => change({ ...doc, paymentRoutes: [...doc.paymentRoutes, { id: crypto.randomUUID(), title: "New payment route", fields: [] }] })}>{copy.text046}</Button>
  </section>;
}
