"use client";
import { useTranslations } from "next-intl";
import type { DocumentUploadResult } from "./use-document-actions";

/** 逐项结果使用经过核对的操作结果；文件名是文本，不能渲染成上传者提供的 HTML。 */
export function DocumentUploadResults({ results }: { results: DocumentUploadResult[] }) {
  const t = useTranslations("Documents");
  if (!results.length) return null;
  return <ul className="space-y-2" aria-live="polite">{results.map((result, index) => <li key={index} data-document-upload-result={result.ok ? "succeeded" : "failed"} className="break-words rounded-lg border border-border-subtle p-3 [overflow-wrap:anywhere]">
    <span className="font-semibold">{result.name}</span><p className={result.ok ? "text-status-success" : "text-status-danger"}>{t(`errors.${result.ok ? "saved" : result.error ?? "unconfirmed"}`)}</p>
  </li>)}</ul>;
}
