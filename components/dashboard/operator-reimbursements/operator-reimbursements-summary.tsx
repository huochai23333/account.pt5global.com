"use client";

import { BadgeCheck, ReceiptText, WalletCards } from "lucide-react";

import { MetricCard, MetricGrid } from "@/components/ui/data-display";
import type { OperatorReimbursementsPageData } from "@/lib/operator-reimbursements";

import { formatOperatorReimbursementAmount } from "./operator-reimbursements-display";

type OperatorReimbursementsSummarySectionProps = {
  copy: {
    count: (count: number) => string;
    currentPeriod: string;
    currentReimbursed: string;
    currentUnreimbursed: string;
    totalUnreimbursed: string;
  };
  summaries: OperatorReimbursementsPageData["summaries"];
  scopeLabel: string;
  locale: string;
};

export function OperatorReimbursementsSummarySection({
  copy,
  summaries,
  scopeLabel,
  locale,
}: OperatorReimbursementsSummarySectionProps) {
  return (
    <section aria-label={scopeLabel} className="min-w-0 space-y-3">
      <p className="break-words text-sm text-content-muted">{scopeLabel}</p>
      <MetricGrid layout="summary-strip">
        <MetricCard
          description={copy.count(summaries.currentUnreimbursed.count)}
          icon={<WalletCards className="size-4" />}
          label={copy.currentUnreimbursed}
          presentation="compact"
          tone="warning"
          value={formatOperatorReimbursementAmount(
            summaries.currentUnreimbursed.amount,
            locale,
          )}
        />
        <MetricCard
          description={copy.count(summaries.currentReimbursed.count)}
          icon={<BadgeCheck className="size-4" />}
          label={copy.currentReimbursed}
          presentation="compact"
          tone="success"
          value={formatOperatorReimbursementAmount(
            summaries.currentReimbursed.amount,
            locale,
          )}
        />
        <MetricCard
          description={copy.count(summaries.totalUnreimbursed.count)}
          icon={<ReceiptText className="size-4" />}
          label={copy.totalUnreimbursed}
          presentation="compact"
          tone="info"
          value={formatOperatorReimbursementAmount(
            summaries.totalUnreimbursed.amount,
            locale,
          )}
        />
      </MetricGrid>
    </section>
  );
}
