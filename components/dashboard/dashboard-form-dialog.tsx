"use client";

import type { ReactNode } from "react";

import { ActionGroup } from "@/components/ui/action-group";
import { Button } from "../ui/button";
import { Field, Textarea } from "../ui/form-controls";
import { DashboardDialog } from "./dashboard-dialog";
import { FeedbackNotice, type FeedbackTone } from "./dashboard-shared-ui";

/** 创建和编辑弹窗共用的标题、反馈与操作按钮。 */
export function FormDialog({
  cancelTestId,
  cancelLabel,
  children,
  description,
  feedback,
  onOpenChange,
  onSubmit,
  open,
  pending,
  submitLabel,
  submitDisabled = false,
  submitTestId,
  title,
}: {
  cancelTestId?: string;
  cancelLabel: string;
  children: ReactNode;
  description?: string;
  feedback?: { message: string; tone: FeedbackTone } | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
  open: boolean;
  pending: boolean;
  submitLabel: string;
  submitDisabled?: boolean;
  submitTestId?: string;
  title: string;
}) {
  if (!open) return null;

  return (
    <DashboardDialog
      actions={
        <ActionGroup>
          <Button
            data-testid={cancelTestId}
            disabled={pending}
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
            wrap
          >
            {cancelLabel}
          </Button>
          <Button
            data-testid={submitTestId}
            disabled={pending || submitDisabled}
            loading={pending}
            onClick={onSubmit}
            type="button"
            wrap
          >
            {submitLabel}
          </Button>
        </ActionGroup>
      }
      description={description}
      onOpenChange={onOpenChange}
      open={open}
      title={title}
    >
      <div className="space-y-5">
        {feedback ? (
          <FeedbackNotice tone={feedback.tone}>
            {feedback.message}
          </FeedbackNotice>
        ) : null}
        {children}
      </div>
    </DashboardDialog>
  );
}

export function DashboardFormField({
  children,
  className,
  controlId,
  density,
  error,
  hint,
  hintTone,
  label,
  labelAction,
  labelHidden,
  required,
}: React.ComponentProps<typeof Field>) {
  return (
    <Field
      className={className}
      controlId={controlId}
      density={density}
      error={error}
      hint={hint}
      hintTone={hintTone}
      label={label}
      labelAction={labelAction}
      labelHidden={labelHidden}
      required={required}
    >
      {children}
    </Field>
  );
}

export function DashboardFormTextarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <Textarea className={className} controlSize="default" {...props} />;
}
