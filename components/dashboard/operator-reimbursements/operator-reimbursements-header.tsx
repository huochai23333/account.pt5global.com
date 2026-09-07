"use client";

import { CheckCircle2, LoaderCircle, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { OperatorReimbursementPeriod } from "@/lib/operator-reimbursements";

import { DashboardSectionHeader } from "../dashboard-section-header";
import { formatOperatorReimbursementPeriod } from "./operator-reimbursements-display";

type OperatorReimbursementsHeaderSectionProps = {
  copy: {
    create: string;
    currentPeriodLabel: string;
    reimburse: string;
    title: string;
  };
  currentPeriod: OperatorReimbursementPeriod;
  unreimbursedCount: number;
  ownView: boolean;
  loading: boolean;
  locale: string;
  onCreate: () => void;
  onReimburse: () => void;
  reimbursePending: boolean;
};

export function OperatorReimbursementsHeaderSection({
  copy,
  currentPeriod,
  unreimbursedCount,
  ownView,
  loading,
  locale,
  onCreate,
  onReimburse,
  reimbursePending,
}: OperatorReimbursementsHeaderSectionProps) {
  // 按本人全部可报销周期决定入口是否可用，历史遗漏也可以进入弹窗。
  const reimburseDisabled =
    loading || reimbursePending || unreimbursedCount === 0;

  return (
    <DashboardSectionHeader
      actions={
        ownView ? (
          <>
            <Button size="default" onClick={onCreate} variant="outline">
              <Plus className="size-4" />
              {copy.create}
            </Button>
            <Button
              variant="primary"
              size="default"
              disabled={reimburseDisabled}
              onClick={onReimburse}
            >
              {reimbursePending ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              {copy.reimburse}
            </Button>
          </>
        ) : null
      }
      meta={
        <p className="max-w-full break-words text-sm leading-7 text-content-muted [overflow-wrap:anywhere] min-[1360px]:text-right">
          <span className="font-semibold text-content-muted">
            {copy.currentPeriodLabel}
          </span>
          {formatOperatorReimbursementPeriod(currentPeriod, locale)}
        </p>
      }
      presentation="work"
      title={copy.title}
    />
  );
}
