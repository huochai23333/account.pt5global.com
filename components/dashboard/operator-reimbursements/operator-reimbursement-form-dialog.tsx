"use client";

import * as FormControls from "@/components/ui/form-controls";
import { DatePicker } from "@/components/ui/date-picker";

import {
  FormDialog,
  DashboardFormField,
  DashboardFormTextarea,
} from "@/components/dashboard/dashboard-form-dialog";

import type { FeedbackTone } from "../dashboard-shared-ui";
import type { OperatorReimbursementFormState } from "./operator-reimbursements-display";

type OperatorReimbursementFormDialogProps = {
  copy: {
    amountLabel: string;
    cancel: string;
    contentLabel: string;
    contentPlaceholder: string;
    createDescription: string;
    createSubmit: string;
    createTitle: string;
    spentAtLabel: string;
  };
  feedback: { tone: FeedbackTone; message: string } | null;
  fieldError: { field: keyof OperatorReimbursementFormState; message: string } | null;
  formState: OperatorReimbursementFormState;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
  onUpdateField: <Key extends keyof OperatorReimbursementFormState>(
    field: Key,
    value: OperatorReimbursementFormState[Key],
  ) => void;
  open: boolean;
  pending: boolean;
};

export function OperatorReimbursementFormDialog({
  copy,
  feedback,
  fieldError,
  formState,
  onOpenChange,
  onSubmit,
  onUpdateField,
  open,
  pending,
}: OperatorReimbursementFormDialogProps) {
  // 弹窗只收集用户能理解的三个字段，报销状态和周期由数据库自动处理。
  return (
    <FormDialog
      cancelLabel={copy.cancel}
      description={copy.createDescription}
      feedback={feedback}
      onOpenChange={onOpenChange}
      onSubmit={onSubmit}
      open={open}
      pending={pending}
      submitLabel={copy.createSubmit}
      title={copy.createTitle}
    >
      <div className="grid gap-4 md:grid-cols-[0.8fr_1fr]">
        <DashboardFormField controlId="reimbursement-spentAt" error={fieldError?.field === "spentAt" ? fieldError.message : undefined} label={copy.spentAtLabel} required>
          <DatePicker
            onValueChange={(value) => onUpdateField("spentAt", value)}
            value={formState.spentAt}
          />
        </DashboardFormField>

        <DashboardFormField controlId="reimbursement-amount" error={fieldError?.field === "amount" ? fieldError.message : undefined} label={copy.amountLabel} required>
          <FormControls.Input
            inputMode="decimal"
            min="0"
            onChange={(event) => onUpdateField("amount", event.target.value)}
            step="0.01"
            type="number"
            value={formState.amount}
          />
        </DashboardFormField>
      </div>

      <DashboardFormField controlId="reimbursement-content" error={fieldError?.field === "content" ? fieldError.message : undefined} label={copy.contentLabel} required>
        <DashboardFormTextarea
          onChange={(event) => onUpdateField("content", event.target.value)}
          placeholder={copy.contentPlaceholder}
          value={formState.content}
        />
      </DashboardFormField>
    </FormDialog>
  );
}
