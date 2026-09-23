import { useTranslations } from "next-intl";

// 手机先展示简短入口，把完整规则留在展开区，确保首屏还能看到待处理线索。
export function SalesLeadRules() {
  const t = useTranslations("SalesLeads.rules");
  const content = <>
    <dl className="mt-3 grid min-w-0 gap-4 text-sm leading-6 md:grid-cols-3">
      {(["firstContact", "followUp", "claimPeriod"] as const).map((rule) => <div className="min-w-0 break-words [overflow-wrap:anywhere]" key={rule}>
        <dt className="font-semibold text-content-strong">{t(`${rule}.title`)}</dt>
        <dd className="mt-1 text-content-muted">{t(`${rule}.description`)}</dd>
      </div>)}
    </dl>
    <p className="mt-3 break-words text-sm leading-6 text-content-muted [overflow-wrap:anywhere]">{t("shared")}</p>
  </>;
  return <>
    <details className="min-w-0 rounded-record-card border border-border-subtle bg-surface-inset p-4 md:hidden" data-testid="sales-lead-rules">
      <summary className="cursor-pointer font-bold text-content-strong">{t("title")} · {t("mobileSummary")}</summary>
      {content}
    </details>
    <section aria-labelledby="sales-lead-rules-heading" className="hidden min-w-0 rounded-record-card border border-border-subtle bg-surface-inset p-5 md:block" data-testid="sales-lead-rules-desktop">
      <h2 className="font-bold text-content-strong" id="sales-lead-rules-heading">{t("title")}</h2>
      {content}
    </section>
  </>;
}
