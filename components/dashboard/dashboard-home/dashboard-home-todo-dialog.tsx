/** 待办编辑与删除确认共用文案和输入合同；按钮只调度回调，成功凭证由上层服务核对。 */
"use client";

import * as FormControls from "@/components/ui/form-controls";

import { LoaderCircle } from "lucide-react";

import { DashboardDialog } from "@/components/dashboard/dashboard-dialog";
import {
  FormDialog,
  DashboardFormField,
  DashboardFormTextarea,
} from "@/components/dashboard/dashboard-form-dialog";
import type { FeedbackTone } from "@/components/dashboard/dashboard-shared-ui";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import type { UserTodoItemRow } from "@/lib/user-todos";

import type { HomeTodoCopy } from "./dashboard-home-todo-copy";
import type { HomeTodoFormState } from "./dashboard-home-todo-display";

type HomeTodoDialogProps = {
  copy: HomeTodoCopy;
  feedback: { message: string; tone: FeedbackTone } | null;
  formState: HomeTodoFormState;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
  onUpdateField: <Key extends keyof HomeTodoFormState>(
    field: Key,
    value: HomeTodoFormState[Key],
  ) => void;
  open: boolean;
  pending: boolean;
};

export function HomeTodoDialog({
  copy,
  feedback,
  formState,
  onOpenChange,
  onSubmit,
  onUpdateField,
  open,
  pending,
}: HomeTodoDialogProps) {
  return (
    <FormDialog
      cancelLabel={copy.actions.cancel}
      cancelTestId="home-todo-dialog-cancel"
      description={copy.dialog.description}
      feedback={feedback}
      onOpenChange={onOpenChange}
      onSubmit={onSubmit}
      open={open}
      pending={pending}
      submitLabel={copy.actions.save}
      submitTestId="home-todo-dialog-save"
      title={copy.dialog.title}
    >
      <DashboardFormField label={copy.dialog.titleLabel} required>
        <FormControls.Input
          data-testid="home-todo-dialog-title"
          onChange={(event) => onUpdateField("title", event.target.value)}
          placeholder={copy.dialog.titlePlaceholder}
          type="text"
          value={formState.title}
        />
      </DashboardFormField>

      <DashboardFormField label={copy.dialog.notesLabel}>
        <DashboardFormTextarea
          className="min-h-[150px]"
          data-testid="home-todo-dialog-notes"
          onChange={(event) => onUpdateField("notes", event.target.value)}
          placeholder={copy.dialog.notesPlaceholder}
          value={formState.notes}
        />
      </DashboardFormField>

      <DashboardFormField label={copy.dialog.dueDateLabel}>
        <DatePicker
          data-testid="home-todo-dialog-due-date"
          onValueChange={(value) => onUpdateField("dueDate", value)}
          value={formState.dueDate}
        />
      </DashboardFormField>

      <div className="grid gap-3 sm:grid-cols-2">
        <FormControls.ChoiceField
          checked={formState.isImportant}
          data-testid="home-todo-dialog-important"
          label={copy.dialog.importantLabel}
          onChange={(event) => onUpdateField("isImportant", event.target.checked)}
        />

        <FormControls.ChoiceField
          checked={formState.isCompleted}
          data-testid="home-todo-dialog-completed"
          label={copy.dialog.completedLabel}
          onChange={(event) => onUpdateField("isCompleted", event.target.checked)}
        />
      </div>
    </FormDialog>
  );
}

type HomeTodoDeleteDialogProps = {
  copy: HomeTodoCopy;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  pending: boolean;
  todo: UserTodoItemRow | null;
};

export function HomeTodoDeleteDialog({
  copy,
  onConfirm,
  onOpenChange,
  open,
  pending,
  todo,
}: HomeTodoDeleteDialogProps) {
  return open && todo ? (
    <DashboardDialog
      actions={
        <>
          <Button
            size="default"
            data-testid="home-todo-delete-dialog-cancel"
            disabled={pending}
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            {copy.actions.cancel}
          </Button>
          <Button
            variant="secondary"
            size="default"
            data-testid="home-todo-delete-dialog-confirm"
            disabled={pending}
            onClick={onConfirm}
            type="button"
          >
            {pending ? <LoaderCircle className="size-4 animate-spin" /> : null}
            {copy.actions.delete}
          </Button>
        </>
      }
      description={copy.feedback.deleteConfirm(todo.title)}
      onOpenChange={onOpenChange}
      open={open}
      title={copy.actions.delete}
    >
      <div className="break-words rounded-surface-inset border border-border-subtle bg-surface-interactive px-4 py-3 text-sm font-semibold leading-6 text-content-strong [overflow-wrap:anywhere]">
        {todo.title}
      </div>
    </DashboardDialog>
  ) : null;
}
