"use client";

import type { ReactNode } from "react";

import { BadgePlus, FileClock, LoaderCircle, RotateCw } from "lucide-react";
import { useTranslations } from "next-intl";

import { DashboardDialog } from "@/components/dashboard/dashboard-dialog";
import {
  FeedbackNotice,
  type FeedbackTone,
} from "@/components/dashboard/dashboard-shared-ui";
import { Button } from "@/components/ui/button";
import type {
  BusinessVipMembershipAction,
  BusinessVipRow,
} from "@/lib/business-vip-management";
import type { Locale } from "@/lib/locale";

import {
  formatBusinessVipAmount,
  formatBusinessVipDate,
} from "./business-vip-display";
import { getBusinessVipMembershipRecords, type BusinessVipMembershipRecord } from "./business-vip-record-projection";

export type BusinessVipWholesaleDialogState =
  | {
      action: BusinessVipMembershipAction;
      kind: "wholesaleAction";
      row: BusinessVipRow;
    }
  | {
      kind: "wholesaleRecords";
      row: BusinessVipRow;
    }
  | null;

type BusinessVipWholesaleDialogFeedback = {
  message: string;
  tone: FeedbackTone;
} | null;

export function BusinessVipWholesaleActionDialog({
  confirmationRequired,
  dialog,
  feedback,
  onClose,
  onConfirm,
  pending,
}: {
  confirmationRequired: boolean;
  dialog: Extract<
    NonNullable<BusinessVipWholesaleDialogState>,
    { kind: "wholesaleAction" }
  >;
  feedback: BusinessVipWholesaleDialogFeedback;
  onClose: () => void;
  onConfirm: (row: BusinessVipRow, action: BusinessVipMembershipAction) => void;
  pending: boolean;
}) {
  const t = useTranslations("BusinessVip");
  const opening = dialog.action === "open";

  return (
    <DashboardDialog
      description={t(
        opening
          ? "dialogs.wholesale.openDescription"
          : "dialogs.wholesale.renewDescription",
        { name: dialog.row.customerLabel },
      )}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open
      title={t(
        opening
          ? "dialogs.wholesale.openTitle"
          : "dialogs.wholesale.renewTitle",
      )}
    >
      <div className="space-y-5">
        {feedback ? (
          <FeedbackNotice tone={feedback.tone}>
            {feedback.message}
          </FeedbackNotice>
        ) : null}
        <div className="rounded-record-card border border-border-subtle bg-surface-inset px-4 py-3">
          <p className="break-words text-sm font-semibold text-content-strong [overflow-wrap:anywhere]">
            {dialog.row.customerLabel}
          </p>
          <p className="mt-1 text-sm leading-6 text-content-muted">
            {t(
              opening
                ? "dialogs.wholesale.openRule"
                : "dialogs.wholesale.renewRule",
            )}
          </p>
          <p className="mt-2 text-sm font-semibold text-primary">
            {t("dialogs.wholesale.annualFee")}
          </p>
          <p className="mt-1 text-xs leading-5 text-content-muted">
            {t("dialogs.wholesale.commissionRule")}
          </p>
        </div>
        <DialogActions
          cancelLabel={t("dialogs.cancel")}
          cancelDisabled={pending}
          icon={
            pending ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : opening ? (
              <BadgePlus className="size-4" />
            ) : (
              <RotateCw className="size-4" />
            )
          }
          onCancel={onClose}
          onSubmit={() => onConfirm(dialog.row, dialog.action)}
          // 未确认的客户可以关掉弹窗查看记录，但不能在当前页再次提交。
          submitDisabled={pending || confirmationRequired}
          submitLabel={t(
            opening
              ? "dialogs.wholesale.openSubmit"
              : "dialogs.wholesale.renewSubmit",
          )}
        />
      </div>
    </DashboardDialog>
  );
}

export function BusinessVipWholesaleRecordsDialog({
  dialog,
  locale,
  onClose,
}: {
  dialog: Extract<
    NonNullable<BusinessVipWholesaleDialogState>,
    { kind: "wholesaleRecords" }
  >;
  locale: Locale;
  onClose: () => void;
}) {
  const t = useTranslations("BusinessVip");
  const records = getBusinessVipMembershipRecords(dialog.row);

  return (
    <DashboardDialog
      description={t("dialogs.wholesale.recordsDescription", {
        name: dialog.row.customerLabel,
      })}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open
      title={t("dialogs.wholesale.recordsTitle")}
    >
      {records.length === 0 ? (
        <div className="rounded-surface-inset border border-border-subtle bg-surface-interactive px-5 py-6 text-center">
          <FileClock className="mx-auto size-5 text-primary" />
          <p className="mt-3 text-sm font-semibold text-content-strong">
            {t("dialogs.wholesale.recordsEmptyTitle")}
          </p>
          <p className="mt-1 text-sm leading-6 text-content-muted">
            {t("dialogs.wholesale.recordsEmptyDescription")}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {records.map((record) => (
            <WholesaleMembershipRecordCard
              key={record.id}
              locale={locale}
              record={record}
            />
          ))}
        </div>
      )}
    </DashboardDialog>
  );
}

function WholesaleMembershipRecordCard({
  locale,
  record,
}: {
  locale: Locale;
  record: BusinessVipMembershipRecord;
}) {
  const t = useTranslations("BusinessVip");
  const fallback = t("fallback.noRecord");

  return (
    <article className="rounded-record-card border border-border-subtle bg-surface-interactive px-4 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-semibold text-primary">
            {t(`operationRecords.types.${record.kind}`)}
          </p>
          <p className="mt-1 break-words text-xs leading-5 text-content-muted [overflow-wrap:anywhere]">
            {t("operationRecords.expiresChange", {
              next: formatBusinessVipDate(
                record.nextExpiresAt,
                locale,
                fallback,
              ),
              previous: formatBusinessVipDate(
                record.previousExpiresAt,
                locale,
                fallback,
              ),
            })}
          </p>
          <p className="mt-1 break-words text-xs leading-5 text-content-muted [overflow-wrap:anywhere]">
            {t("operationRecords.annualFee", {
              amount: formatBusinessVipAmount(
                record.amount,
                record.currency,
                fallback,
              ),
            })}
          </p>
        </div>
        <span className="shrink-0 text-xs text-content-muted">
          {formatBusinessVipDate(record.createdAt, locale, fallback)}
        </span>
      </div>
      <p className="mt-2 text-sm text-content-muted">
        {record.actorName ?? t("operationRecords.actorFallback")}
      </p>
      {record.note ? (
        <p className="mt-1 break-words text-xs leading-5 text-content-subtle [overflow-wrap:anywhere]">
          {record.note}
        </p>
      ) : null}
    </article>
  );
}

function DialogActions({
  cancelDisabled,
  cancelLabel,
  className,
  icon,
  onCancel,
  onSubmit,
  submitDisabled,
  submitLabel,
}: {
  cancelDisabled: boolean;
  cancelLabel: string;
  className?: string;
  icon: ReactNode;
  onCancel: () => void;
  onSubmit: () => void;
  submitDisabled: boolean;
  submitLabel: string;
}) {
  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
      <Button
        size="default"
        disabled={cancelDisabled}
        onClick={onCancel}
        type="button"
        variant="outline"
      >
        {cancelLabel}
      </Button>
      <Button
        className={className}
        disabled={submitDisabled}
        onClick={onSubmit}
        size="default"
        type="button"
        variant="primary"
      >
        {icon}
        {submitLabel}
      </Button>
    </div>
  );
}
