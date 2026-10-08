"use client";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { DocumentReceipt } from "@/lib/document-library/model";
import type { DocumentIntent } from "./use-document-actions";

/** 数据库待处理凭证与浏览器断线意图按编号合并，刷新后仍可核对原请求。 */
export function DocumentPendingOperations({ receipts, intents, busy, reconcile }: { receipts: DocumentReceipt[]; intents: DocumentIntent[]; busy: boolean; reconcile: (receipt: Pick<DocumentReceipt, "operationId">) => void }) {
  const t = useTranslations("Documents");
  const pending = [...receipts.map((receipt) => ({ operationId: receipt.operationId, name: receipt.record.name, failed: receipt.status === "failed" })), ...intents.filter((intent) => !receipts.some((receipt) => receipt.operationId === intent.operationId)).map((intent) => ({ operationId: intent.operationId, name: String(intent.payload.name ?? t("pending")), failed: false }))];
  if (!pending.length) return null;
  return <section className="space-y-3 rounded-lg border p-4"><h3 className="font-semibold">{t("pending")}</h3>{pending.map((receipt) => <div className="flex min-w-0 flex-wrap items-center gap-3" key={receipt.operationId}><span className="min-w-0 break-words [overflow-wrap:anywhere]">{receipt.name}</span><Button variant="outline" disabled={busy || receipt.failed} onClick={() => reconcile(receipt)}>{receipt.failed ? t("uploadAgain") : t("reconcile")}</Button></div>)}</section>;
}
