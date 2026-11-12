"use client";

import { useState, type FormEvent } from "react";
import { Ban, CalendarClock, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";

import { DashboardDialog } from "@/components/dashboard/dashboard-dialog";
import { FeedbackNotice, type FeedbackTone } from "@/components/dashboard/dashboard-shared-ui";
import { DatePicker } from "@/components/ui/date-picker";
import { Field } from "@/components/ui/form-controls";
import { Select } from "@/components/ui/select";
import type { BusinessVipAdjustmentAction, BusinessVipRow } from "@/lib/business-vip-management";

import { getBusinessVipDateTimeInputValue } from "./business-vip-display";
import { BusinessVipDialogActions as DialogActions, BusinessVipNoteField } from "./business-vip-dialog-fields";

type BusinessVipDialogFeedback = { message: string; tone: FeedbackTone } | null;

// 旅游调整表单只负责草稿，是否允许提交由业务启用配置及服务端决定。
export function BusinessVipAdjustmentDialog({
  feedback,
  onClose,
  onSubmit,
  pending,
  row,
}: {
  feedback: BusinessVipDialogFeedback;
  onClose: () => void;
  onSubmit: (
    action: BusinessVipAdjustmentAction,
    nextExpiresAt: string | null,
    note: string,
  ) => void;
  pending: boolean;
  row: BusinessVipRow;
}) {
  const t = useTranslations("BusinessVip");
  const [action, setAction] =
    useState<BusinessVipAdjustmentAction>("set_expires_at");
  const [nextExpiresAt, setNextExpiresAt] = useState(
    getBusinessVipDateTimeInputValue(row.expiresAt),
  );
  const [note, setNote] = useState("");
  const dateRequired = action === "set_expires_at";
  const canSubmit = !pending && (!dateRequired || Boolean(nextExpiresAt));

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    onSubmit(action, action === "set_expires_at" ? nextExpiresAt : null, note);
  };

  return (
    <DashboardDialog
      description={t("dialogs.adjust.description", {
        name: row.customerLabel,
      })}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open
      title={t("dialogs.adjust.title")}
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        {feedback ? (
          <FeedbackNotice tone={feedback.tone}>{feedback.message}</FeedbackNotice>
        ) : null}
        <Field label={t("dialogs.adjust.actionLabel")}>
          <Select
            disabled={pending}
            onValueChange={setAction}
            options={[
              {
                label: t("dialogs.adjust.setExpiresAt"),
                value: "set_expires_at",
              },
              { label: t("dialogs.adjust.cancelVip"), value: "cancel" },
            ]}
            value={action}
          />
        </Field>

        {action === "set_expires_at" ? (
          <Field label={t("dialogs.adjust.dateLabel")} required>
            <DatePicker
              disabled={pending}
              mode="datetime-local"
              onValueChange={setNextExpiresAt}
              required
              value={nextExpiresAt}
            />
          </Field>
        ) : null}

        <BusinessVipNoteField
          disabled={pending}
          label={t("dialogs.noteLabel")}
          onChange={setNote}
          placeholder={t("dialogs.adjust.notePlaceholder")}
          value={note}
        />
        <DialogActions
          cancelLabel={t("dialogs.cancel")}
          className={
            action === "cancel" ? "bg-status-danger hover:bg-surface-inset" : ""
          }
          icon={
            pending ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : action === "cancel" ? (
              <Ban className="size-4" />
            ) : (
              <CalendarClock className="size-4" />
            )
          }
          cancelDisabled={pending}
          onCancel={onClose}
          submitDisabled={!canSubmit}
          submitLabel={t("dialogs.adjust.submit")}
        />
      </form>
    </DashboardDialog>
  );
}
