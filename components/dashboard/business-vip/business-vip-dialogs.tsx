"use client";

import type { FormEvent } from "react";
import { useState } from "react";

import { Check, LoaderCircle, Send, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { DashboardDialog } from "@/components/dashboard/dashboard-dialog";
import {
  FeedbackNotice,
  type FeedbackTone,
} from "@/components/dashboard/dashboard-shared-ui";
import type {
  BusinessVipAdjustmentAction,
  BusinessVipRequest,
  BusinessVipReviewAction,
  BusinessVipRow,
} from "@/lib/business-vip-management";

import { BusinessVipAdjustmentDialog } from "./business-vip-adjustment-dialog";
import {
  BusinessVipDialogActions as DialogActions,
  BusinessVipNoteField,
} from "./business-vip-dialog-fields";

export type BusinessVipDialogState =
  | { kind: "request"; row: BusinessVipRow }
  | {
      action: BusinessVipReviewAction;
      kind: "review";
      request: BusinessVipRequest;
      row: BusinessVipRow;
    }
  | { kind: "adjust"; row: BusinessVipRow }
  | null;

type BusinessVipDialogFeedback = {
  message: string;
  tone: FeedbackTone;
} | null;

export function BusinessVipDialogs({
  dialog,
  feedback,
  onAdjust,
  onClose,
  onRequest,
  onReview,
  pending,
}: {
  dialog: BusinessVipDialogState;
  feedback: BusinessVipDialogFeedback;
  onAdjust: (
    row: BusinessVipRow,
    action: BusinessVipAdjustmentAction,
    nextExpiresAt: string | null,
    note: string,
  ) => void;
  onClose: () => void;
  onRequest: (row: BusinessVipRow, note: string) => void;
  onReview: (
    row: BusinessVipRow,
    request: BusinessVipRequest,
    action: BusinessVipReviewAction,
    note: string,
  ) => void;
  pending: boolean;
}) {
  if (!dialog) {
    return null;
  }

  if (dialog.kind === "request") {
    return (
      <BusinessVipRequestDialog
        feedback={feedback}
        key={`request:${dialog.row.targetId}`}
        onClose={onClose}
        onSubmit={(note) => onRequest(dialog.row, note)}
        pending={pending}
        row={dialog.row}
      />
    );
  }

  if (dialog.kind === "review") {
    return (
      <BusinessVipReviewDialog
        action={dialog.action}
        feedback={feedback}
        key={`review:${dialog.request.id}:${dialog.action}`}
        onClose={onClose}
        onSubmit={(note) =>
          onReview(dialog.row, dialog.request, dialog.action, note)
        }
        pending={pending}
        row={dialog.row}
      />
    );
  }

  return (
    <BusinessVipAdjustmentDialog
      feedback={feedback}
      key={`adjust:${dialog.row.targetId}:${dialog.row.expiresAt ?? ""}`}
      onClose={onClose}
      onSubmit={(action, nextExpiresAt, note) =>
        onAdjust(dialog.row, action, nextExpiresAt, note)
      }
      pending={pending}
      row={dialog.row}
    />
  );
}

function BusinessVipRequestDialog({
  feedback,
  onClose,
  onSubmit,
  pending,
  row,
}: {
  feedback: BusinessVipDialogFeedback;
  onClose: () => void;
  onSubmit: (note: string) => void;
  pending: boolean;
  row: BusinessVipRow;
}) {
  const t = useTranslations("BusinessVip");
  const [note, setNote] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(note);
  };

  return (
    <DashboardDialog
      description={t("dialogs.request.description", {
        name: row.customerLabel,
      })}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open
      title={t("dialogs.request.title")}
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        {feedback ? (
          <FeedbackNotice tone={feedback.tone}>{feedback.message}</FeedbackNotice>
        ) : null}
        <BusinessVipNoteField
          disabled={pending}
          label={t("dialogs.noteLabel")}
          onChange={setNote}
          placeholder={t("dialogs.request.notePlaceholder")}
          value={note}
        />
        <DialogActions
          cancelLabel={t("dialogs.cancel")}
          icon={
            pending ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )
          }
          cancelDisabled={pending}
          onCancel={onClose}
          submitDisabled={pending}
          submitLabel={t("dialogs.request.submit")}
        />
      </form>
    </DashboardDialog>
  );
}

function BusinessVipReviewDialog({
  action,
  feedback,
  onClose,
  onSubmit,
  pending,
  row,
}: {
  action: BusinessVipReviewAction;
  feedback: BusinessVipDialogFeedback;
  onClose: () => void;
  onSubmit: (note: string) => void;
  pending: boolean;
  row: BusinessVipRow;
}) {
  const t = useTranslations("BusinessVip");
  const [note, setNote] = useState("");
  const approving = action === "approve";

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(note);
  };

  return (
    <DashboardDialog
      description={t(
        approving
          ? "dialogs.review.approveDescription"
          : "dialogs.review.rejectDescription",
        { name: row.customerLabel },
      )}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open
      title={t(
        approving
          ? "dialogs.review.approveTitle"
          : "dialogs.review.rejectTitle",
      )}
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        {feedback ? (
          <FeedbackNotice tone={feedback.tone}>{feedback.message}</FeedbackNotice>
        ) : null}
        <BusinessVipNoteField
          disabled={pending}
          label={t("dialogs.review.noteLabel")}
          onChange={setNote}
          placeholder={t("dialogs.review.notePlaceholder")}
          value={note}
        />
        <DialogActions
          cancelLabel={t("dialogs.cancel")}
          className={approving ? "" : "bg-status-danger hover:bg-surface-inset"}
          icon={
            pending ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : approving ? (
              <Check className="size-4" />
            ) : (
              <X className="size-4" />
            )
          }
          cancelDisabled={pending}
          onCancel={onClose}
          submitDisabled={pending}
          submitLabel={t(
            approving
              ? "dialogs.review.approveSubmit"
              : "dialogs.review.rejectSubmit",
          )}
        />
      </form>
    </DashboardDialog>
  );
}
