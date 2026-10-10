"use client";
import { useTranslations } from "next-intl";
import type { DocumentUploadResult } from "./use-document-actions";

/** 逐项结果使用经过核对的操作结果；文件名是文本，不能渲染成上传者提供的 HTML。 */
export function DocumentUploadResults({ results }: { results: DocumentUploadResult[] }) {
  const t = useTranslations("Documents");
  if (!results.length) return null;
  // 成功结果收为一行，失败自动展开；明细独立滚动，不随上传数量挤占文件区。
  return <details key={results.some(result=>!result.ok)?"failed":"completed"} open={results.some(result=>!result.ok)} data-document-upload-summary className="rounded-lg border border-border-subtle text-sm">
   <summary className="min-h-11 cursor-pointer px-3 py-3"><span role="status">{t("explorer.uploadSummary",{done:results.filter(result=>result.ok).length,total:results.length})}</span><span className="ms-3 text-primary">{t("explorer.activityDetails")}</span></summary>
   <ul className="max-h-40 space-y-2 overflow-y-auto border-t border-border-subtle p-3">{results.map((result, index) => <li key={index} data-document-upload-result={result.ok ? "succeeded" : "failed"} className="break-words [overflow-wrap:anywhere]">
    <span className="font-semibold">{result.name}</span><p className={result.ok ? "text-status-success" : "text-status-danger"}>{t(`errors.${result.ok ? "saved" : result.error ?? "unconfirmed"}`)}</p>
  </li>)}</ul></details>;
}
