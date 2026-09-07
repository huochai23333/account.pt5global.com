"use client";

import { CalendarDays, LoaderCircle, ReceiptText, Trash2 } from "lucide-react";

import {
  MotionList,
  MotionListItem,
  PresenceSwap,
} from "@/components/motion/motion-primitives";
import { Button } from "@/components/ui/button";
import { MetaGrid, MetaItem, RecordCard } from "@/components/ui/data-display";
import { StatusBadge } from "@/components/ui/status-badge";
import type {
  OperatorReimbursementRow,
  OperatorReimbursementStatus,
} from "@/lib/operator-reimbursements";

import { DashboardListSection } from "../dashboard-section-panel";
import { EmptyState } from "../dashboard-shared-ui";
import {
  formatOperatorReimbursementAmount,
  formatOperatorReimbursementDate,
  formatOperatorReimbursementPeriod,
} from "./operator-reimbursements-display";

type OperatorReimbursementsListSectionProps = {
  copy: {
    operator: string;
    amount: string;
    delete: string;
    emptyDescription: string;
    emptyTitle: string;
    period: string;
    recordsTitle: string;
    reimbursedAt: string;
    spentAt: string;
    status: string;
    statusOptions: Record<OperatorReimbursementStatus, string>;
    updatedAt: string;
  };
  currentUserId: string;
  ownView: boolean;
  locale: string;
  onDelete: (reimbursement: OperatorReimbursementRow) => void;
  pendingAction: { id: string; type: "delete" } | null;
  reimbursements: OperatorReimbursementRow[];
};

export function OperatorReimbursementsListSection({
  copy,
  currentUserId,
  ownView,
  locale,
  onDelete,
  pendingAction,
  reimbursements,
}: OperatorReimbursementsListSectionProps) {
  return (
    <DashboardListSection ariaLabel={copy.recordsTitle}>
      <PresenceSwap
        presenceKey={reimbursements.length === 0 ? "empty" : "reimbursements"}
      >
        {reimbursements.length === 0 ? (
          <EmptyState
            description={copy.emptyDescription}
            icon={<ReceiptText className="size-6" />}
            title={copy.emptyTitle}
          />
        ) : (
          <MotionList className="grid gap-4">
            {reimbursements.map((reimbursement, index) => (
              <MotionListItem index={index} key={reimbursement.id}>
                <OperatorReimbursementCard
                  currentUserId={currentUserId}
                  ownView={ownView}
                  copy={copy}
                  locale={locale}
                  onDelete={onDelete}
                  pendingAction={pendingAction}
                  reimbursement={reimbursement}
                />
              </MotionListItem>
            ))}
          </MotionList>
        )}
      </PresenceSwap>
    </DashboardListSection>
  );
}

function OperatorReimbursementCard({
  copy,
  currentUserId,
  ownView,
  locale,
  onDelete,
  pendingAction,
  reimbursement,
}: {
  copy: OperatorReimbursementsListSectionProps["copy"];
  currentUserId: string;
  ownView: boolean;
  locale: string;
  onDelete: (reimbursement: OperatorReimbursementRow) => void;
  pendingAction: OperatorReimbursementsListSectionProps["pendingAction"];
  reimbursement: OperatorReimbursementRow;
}) {
  const deletePending =
    pendingAction?.id === reimbursement.id && pendingAction.type === "delete";
  // 查阅同事时不提供写入入口；本人也只能删除未报销的记录。
  const canDelete =
    ownView &&
    reimbursement.operator_user_id === currentUserId &&
    reimbursement.status === "unreimbursed";

  return (
    <RecordCard surface="inset">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <StatusBadge
              tone={
                reimbursement.status === "reimbursed" ? "success" : "warning"
              }
            >
              {copy.statusOptions[reimbursement.status]}
            </StatusBadge>
            <span className="inline-flex min-h-7 items-center rounded-full bg-surface-inset px-3 py-1 text-xs font-semibold text-content-muted">
              {formatOperatorReimbursementPeriod(
                {
                  end: reimbursement.reimbursement_period_end,
                  start: reimbursement.reimbursement_period_start,
                },
                locale,
              )}
            </span>
          </div>

          <h3 className="mt-3 break-words text-xl font-bold text-content-strong [overflow-wrap:anywhere]">
            {reimbursement.content}
          </h3>
          <p className="mt-2 break-words text-2xl font-bold text-primary [overflow-wrap:anywhere]">
            {formatOperatorReimbursementAmount(reimbursement.amount, locale)}
          </p>

          <MetaGrid className="mt-4 xl:grid-cols-3">
            <MetaItem label={copy.operator}>
              {reimbursement.operator_name}
            </MetaItem>
            <MetaItem label={copy.spentAt}>
              <CalendarDays className="size-4" />
              {formatOperatorReimbursementDate(reimbursement.spent_at, locale)}
            </MetaItem>
            <MetaItem label={copy.period}>
              <CalendarDays className="size-4" />
              {formatOperatorReimbursementPeriod(
                {
                  end: reimbursement.reimbursement_period_end,
                  start: reimbursement.reimbursement_period_start,
                },
                locale,
              )}
            </MetaItem>
            <MetaItem label={copy.status}>
              {copy.statusOptions[reimbursement.status]}
            </MetaItem>
            <MetaItem label={copy.reimbursedAt}>
              {formatOperatorReimbursementDate(
                reimbursement.reimbursed_at,
                locale,
              )}
            </MetaItem>
            <MetaItem label={copy.updatedAt}>
              {formatOperatorReimbursementDate(
                reimbursement.updated_at.slice(0, 10),
                locale,
              )}
            </MetaItem>
          </MetaGrid>
        </div>

        {canDelete ? (
          <div className="flex flex-wrap gap-2 xl:justify-end">
            <Button
              size="compact"
              disabled={deletePending}
              onClick={() => onDelete(reimbursement)}
              variant="danger"
            >
              {deletePending ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              {copy.delete}
            </Button>
          </div>
        ) : null}
      </div>
    </RecordCard>
  );
}
