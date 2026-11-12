"use client";

import { InteractiveButton as DesignButton } from "@/components/ui/button";

import * as FormControls from "@/components/ui/form-controls";

import { useTranslations } from "next-intl";
import { LoaderCircle, Paperclip, Trash2, Upload } from "lucide-react";

import {
  TASK_REVIEW_SUBMISSION_MAX_FILES,
  TASK_REVIEW_SUBMISSION_MAX_TOTAL_SIZE_BYTES,
} from "@/lib/task-review-assets";
import {
  IMAGE_UPLOAD_MAX_SIZE_BYTES,
  OTHER_UPLOAD_MAX_SIZE_BYTES,
  VIDEO_UPLOAD_MAX_SIZE_BYTES,
} from "@/lib/upload-file-size-limits";
import { Button } from "@/components/ui/button";
import {
  formatFileSize,
  FeedbackNotice,
  type FeedbackTone,
} from "@/components/dashboard/dashboard-shared-ui";
import { DashboardDialog } from "@/components/dashboard/dashboard-dialog";
import { DashboardFilePicker } from "@/components/dashboard/dashboard-framework-primitives";
import type { SalesmanTaskRow } from "@/lib/salesman-tasks";

type DialogFeedback = { tone: FeedbackTone; message: string } | null;

export function SalesmanTaskSubmitDialog({
  feedback,
  files,
  note,
  onFilesChange,
  onNoteChange,
  onOpenChange,
  onRemoveFile,
  onSubmit,
  open,
  pending,
  task,
}: {
  feedback: DialogFeedback;
  files: File[];
  note: string;
  onFilesChange: (files: File[]) => void;
  onNoteChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onRemoveFile: (index: number) => void;
  onSubmit: () => void;
  open: boolean;
  pending: boolean;
  task: SalesmanTaskRow | null;
}) {
  const t = useTranslations("Tasks.salesman.submitDialog");
  const requiresAttachment = task?.review_requires_attachment ?? true;

  return (
    <DashboardDialog
      actions={
        <>
          <Button
            size="compact"
            disabled={pending}
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            {t("cancel")}
          </Button>
          <Button
            variant="success"
            size="compact"
            className="disabled:opacity-70"
            disabled={pending}
            onClick={onSubmit}
            type="button"
          >
            {pending ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            {task?.status === "rejected" ? t("resubmit") : t("submit")}
          </Button>
        </>
      }
      description={
        task
          ? t(requiresAttachment ? "description" : "descriptionNoteOnly", {
              taskName: task.task_name,
            })
          : undefined
      }
      onOpenChange={onOpenChange}
      open={open}
      title={t("title")}
    >
      <div className="space-y-5">
        {feedback ? (
          <FeedbackNotice tone={feedback.tone}>
            {feedback.message}
          </FeedbackNotice>
        ) : null}

        {task?.review_reject_reason ? (
          <div className="rounded-control-large border border-border-subtle bg-surface-inset p-4">
            <p className="text-sm font-semibold text-status-danger">
              {t("rejectReasonLabel")}
            </p>
            <p className="mt-2 text-sm leading-7 text-content-muted">
              {task.review_reject_reason}
            </p>
          </div>
        ) : null}

        <FormControls.Field
          label={requiresAttachment ? t("noteLabel") : t("noteRequiredLabel")}
          required={!requiresAttachment}
        >
          <FormControls.Textarea
            aria-required={!requiresAttachment}
            className="min-h-[140px]"
            onChange={(event) => onNoteChange(event.target.value)}
            placeholder={t("notePlaceholder")}
            value={note}
          />
        </FormControls.Field>

        <div>
          <p className="mb-2 text-sm font-semibold text-content-strong">
            {requiresAttachment ? t("filesLabel") : t("filesOptionalLabel")}
          </p>
          <DashboardFilePicker
            label={t("filesCta")}
            multiple
            onFiles={onFilesChange}
          />
          <p className="mt-2 text-xs leading-6 text-content-muted">
            {requiresAttachment
              ? t("filesHint", {
                  maxFiles: TASK_REVIEW_SUBMISSION_MAX_FILES,
                  imageMaxPerFile: formatFileSize(IMAGE_UPLOAD_MAX_SIZE_BYTES),
                  videoMaxPerFile: formatFileSize(VIDEO_UPLOAD_MAX_SIZE_BYTES),
                  otherMaxPerFile: formatFileSize(OTHER_UPLOAD_MAX_SIZE_BYTES),
                  maxTotal: formatFileSize(
                    TASK_REVIEW_SUBMISSION_MAX_TOTAL_SIZE_BYTES,
                  ),
                })
              : t("filesOptionalHint", {
                  maxFiles: TASK_REVIEW_SUBMISSION_MAX_FILES,
                  imageMaxPerFile: formatFileSize(IMAGE_UPLOAD_MAX_SIZE_BYTES),
                  videoMaxPerFile: formatFileSize(VIDEO_UPLOAD_MAX_SIZE_BYTES),
                  otherMaxPerFile: formatFileSize(OTHER_UPLOAD_MAX_SIZE_BYTES),
                  maxTotal: formatFileSize(
                    TASK_REVIEW_SUBMISSION_MAX_TOTAL_SIZE_BYTES,
                  ),
                })}
          </p>

          {files.length > 0 ? (
            <div className="mt-4 space-y-2">
              {files.map((file, index) => (
                <div
                  className="flex items-center justify-between gap-3 rounded-record-card border border-border-subtle bg-surface-interactive px-4 py-3"
                  key={`${file.name}-${file.size}-${index}`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium text-content-strong">
                      <Paperclip className="size-4 shrink-0 text-primary" />
                      <span className="truncate">{file.name}</span>
                    </div>
                    <p className="mt-1 text-xs text-content-muted">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                  <DesignButton
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-status-danger-soft text-status-danger transition hover:bg-status-danger-soft"
                    onClick={() => onRemoveFile(index)}
                    type="button"
                  >
                    <Trash2 className="size-4" />
                  </DesignButton>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm leading-7 text-content-muted">
              {requiresAttachment ? t("filesEmpty") : t("filesOptionalEmpty")}
            </p>
          )}
        </div>
      </div>
    </DashboardDialog>
  );
}
