"use client";

import { quoteOriginalCopy as copy } from "@/lib/quotations/original-copy";

import Link from "next/link";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { getBrowserSupabaseClient } from "@/lib/supabase";
import { imagePaths, type QuoteRow } from "@/lib/quotations/model";
import { quoteDisplayError } from "@/lib/quotations/display-error";
import { deleteQuote } from "@/lib/quotations/repository";
import { removeQuoteImages } from "@/lib/quotations/images";
import "./quote-form.css";

// 固定时区和地区格式，保证服务器首屏与浏览器接管后的时间完全一致。
const quoteDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hour12: false,
});

export function QuoteList({ initial, workspace }: { initial: QuoteRow[]; workspace: string }) {
  const [rows, setRows] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const deleting = useRef(false);
  const [error, setError] = useState("");
  async function remove(row: QuoteRow) {
    if (deleting.current || !confirm(`Delete the quotation for ${row.content.client || "this client"}?`)) return;
    const supabase = getBrowserSupabaseClient();
    if (!supabase) return;
    deleting.current = true; setBusyId(row.id); setError("");
    try {
      await deleteQuote(supabase, row);
      try { await removeQuoteImages(supabase, imagePaths(row.content)); }
      catch {
        setRows((old) => old.filter((item) => item.id !== row.id));
        throw new Error("partial_failed: quotation deleted, but some product images could not be removed.");
      }
      // 数据库记录和图片对象都已确认删除后，列表才向员工显示最终结果。
      setRows((old) => old.filter((item) => item.id !== row.id));
    } catch (cause) { setError(quoteDisplayError(cause, "Quotation could not be deleted. Please try again.")); }
    finally { deleting.current = false; setBusyId(null); }
  }
  return <main className="q-shell"><div className="q-toolbar"><div><Link href={`/${workspace}/home`}>{copy.text047}</Link><h1>{copy.text048}</h1></div>
    <Link className="q-primary" href={`/${workspace}/quotes/new`}>{copy.text049}</Link></div>
    {error ? <p role="alert" className="q-status q-error">{error}</p> : null}
    <div className="q-list">{rows.length ? rows.map((row) => <article className="q-list-item" key={row.id}>
      <div><b>{row.content.client || "Untitled quotation"}</b><p>{row.content.destinations.map((dest) => dest.code).join(", ")} · {row.status === "draft" ? "Draft" : "Completed"} · {quoteDate.format(new Date(row.updated_at))}</p></div>
      <div className="q-list-actions"><Link href={`/${workspace}/quotes/${row.id}`}>{copy.text050}</Link>
        <Button type="button" disabled={busyId === row.id} onClick={() => void remove(row)}>{copy.text051}</Button></div>
    </article>) : <div className="q-list-item">{copy.text052}</div>}</div>
  </main>;
}
