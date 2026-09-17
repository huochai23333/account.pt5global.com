"use client";

import { quoteOriginalCopy as copy } from "@/lib/quotations/original-copy";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { pdf } from "@react-pdf/renderer";
import { getBrowserSupabaseClient } from "@/lib/supabase";
import { imagePaths, newQuote, type QuoteDocument, type QuoteRow } from "@/lib/quotations/model";
import { validateQuote } from "@/lib/quotations/calculate";
import { quoteDisplayError } from "@/lib/quotations/display-error";
import { QUOTE_IMAGE_BUCKET, readQuoteImage, uploadQuoteImage } from "@/lib/quotations/images";
import { removeQuoteImages } from "@/lib/quotations/images";
import { saveQuote } from "@/lib/quotations/repository";
import { QuoteForm } from "./quote-form";
import { QuotePdf } from "./quote-pdf";
import "./quote-form.css";

export function QuoteEditor({ initial, workspace }: { initial: QuoteRow | null; workspace: string }) {
  const router = useRouter();
  const [doc, setDoc] = useState<QuoteDocument>(() => initial?.content ?? newQuote());
  const [record, setRecord] = useState<QuoteRow | null>(initial);
  // 首次保存前就固定记录 ID；若数据库已提交而网络回执丢失，再按原 ID 重试。
  const pendingId = useRef(initial?.id ?? crypto.randomUUID());
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const supabase = getBrowserSupabaseClient();

  useEffect(() => {
    if (!supabase) return;
    const pending = imagePaths(doc).filter((path) => !imageUrls[path]);
    if (!pending.length) return;
    let current = true;
    void Promise.all(pending.map(async (path) => {
      const { data, error: signedError } = await supabase.storage.from(QUOTE_IMAGE_BUCKET).createSignedUrl(path, 3600);
      if (signedError || !data?.signedUrl) return null;
      return [path, data.signedUrl] as const;
    })).then((results) => {
      if (current) setImageUrls((old) => ({ ...old, ...Object.fromEntries(results.filter((result): result is readonly [string, string] => Boolean(result))) }));
    });
    return () => { current = false; };
  }, [doc, imageUrls, supabase]);

  async function save(status: "draft" | "completed", currentDoc = doc) {
    if (!supabase) throw new Error("Please sign in again.");
    const previousPaths = record ? imagePaths(record.content) : [];
    const updated = await saveQuote(supabase, record?.id ?? pendingId.current, record?.revision ?? null, status, currentDoc);
    setRecord(updated);
    if (!record) router.replace(`/${workspace}/quotes/${updated.id}`);
    const removed = previousPaths.filter((path) => !imagePaths(currentDoc).includes(path));
    if (removed.length) {
      try { await removeQuoteImages(supabase, removed); }
      catch { throw new Error("partial_failed: quotation saved, but some old images could not be removed."); }
    }
    return updated;
  }
  async function saveDraft() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true); setError(""); setFeedback("");
    try { await save("draft"); setFeedback("Draft saved."); }
    catch (cause) { setError(quoteDisplayError(cause, "Draft was not saved. Please try again.")); }
    finally { inFlight.current = false; setBusy(false); }
  }
  async function exportPdf() {
    if (inFlight.current) return;
    const invalid = validateQuote(doc);
    if (invalid) { setError(invalid); return; }
    if (!supabase) { setError("Please sign in again."); return; }
    inFlight.current = true; setBusy(true); setError(""); setFeedback("");
    try {
      // 先从私有存储逐张取回图片，任何图片缺失都停止导出，避免 PDF 悄悄漏图。
      const entries = await Promise.all(imagePaths(doc).map(async (path) => [path, await readQuoteImage(supabase, path)] as const));
      const blob = await pdf(<QuotePdf doc={doc} images={Object.fromEntries(entries)} />).toBlob();
      const signature = await blob.slice(0, 5).text();
      if (signature !== "%PDF-" || blob.size < 500) throw new Error("PDF generation did not finish.");
      // 先确认浏览器可以持有真实 PDF，再把报价标为完成；生成中断时保留草稿状态。
      const url = URL.createObjectURL(blob);
      let updated;
      try { updated = await save("completed"); }
      catch (cause) { URL.revokeObjectURL(url); throw cause; }
      const link = document.createElement("a");
      link.href = url;
      link.download = `Costlist-${doc.client.replace(/[^a-z0-9_-]+/gi, "-")}-${updated.id.slice(0, 8)}.pdf`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setFeedback("PDF generated. Your browser should start the download.");
    } catch (cause) { setError(quoteDisplayError(cause, "PDF was not generated. Please try again.")); }
    finally { inFlight.current = false; setBusy(false); }
  }
  async function uploadImage(file: File) {
    if (!supabase) throw new Error("Please sign in again.");
    try { const path = await uploadQuoteImage(supabase, file); setFeedback("Image uploaded."); return path; }
    catch (cause) { setError(quoteDisplayError(cause, "Image upload failed. Please try again.")); throw cause; }
  }
  async function importImage(url: string) {
    const response = await fetch("/api/quotations/import-image", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }),
    });
    const payload = await response.json() as { path?: string; error?: string };
    if (!response.ok || !payload.path) throw new Error(payload.error || "Image URL could not be imported.");
    setFeedback("Image imported."); return payload.path;
  }
  return <main className="q-shell"><div className="q-toolbar"><div><Link href={`/${workspace}/quotes`}>{copy.text001}</Link><h1>{copy.text002}</h1></div>
    <div className="q-list-actions"><Button disabled={busy} onClick={() => void saveDraft()}>{busy ? "Working…" : "Save draft"}</Button>
      <Button className="q-primary" disabled={busy} onClick={() => void exportPdf()}>{copy.text003}</Button></div></div>
    {error ? <p role="alert" className="q-status q-error">{error}</p> : null}
    {feedback ? <p role="status" className="q-status">{feedback}</p> : null}
    <QuoteForm doc={doc} change={setDoc} uploadImage={uploadImage} importImage={importImage} imageUrls={imageUrls}
      onError={(message) => setError(quoteDisplayError(new Error(message), "Image could not be added. Please try again."))} />
  </main>;
}
