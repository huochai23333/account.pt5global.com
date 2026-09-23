"use client";

import { useRef, useState } from "react";
import { createOperatorReimbursement } from "@/lib/operator-reimbursements";
import { getBrowserSupabaseClient } from "@/lib/supabase";
import { markBrowserCloudSyncActivity } from "@/lib/browser-sync-recovery";
import type { FeedbackTone } from "../dashboard-shared-ui";
import type { createOperatorReimbursementsCopy } from "./operator-reimbursements-copy";
import {
  createEmptyOperatorReimbursementForm,
  toOperatorReimbursementInput,
  toOperatorReimbursementErrorMessage,
  type OperatorReimbursementFormState,
} from "./operator-reimbursements-display";

export type ReimbursementFeedback = {
  tone: FeedbackTone;
  message: string;
} | null;
export type ReimbursementCopy = ReturnType<
  typeof createOperatorReimbursementsCopy
>["feedback"];

/** 新增表单独立管理输入与保存，列表查询不需要知道每个输入框的状态。 */
export function useOperatorReimbursementForm(
  copy: ReimbursementCopy,
  onSaved: (message: string) => Promise<void>,
) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(createEmptyOperatorReimbursementForm);
  const [feedback, setFeedback] = useState<ReimbursementFeedback>(null);
  const [fieldError, setFieldError] = useState<{ field: keyof OperatorReimbursementFormState; message: string } | null>(null);
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const openCreate = () => {
    setForm(createEmptyOperatorReimbursementForm());
    setFeedback(null);
    setFieldError(null);
    setOpen(true);
  };
  const changeOpen = (value: boolean) => {
    if (!lock.current) setOpen(value);
  };
  const updateField = <Key extends keyof OperatorReimbursementFormState>(
    field: Key,
    value: OperatorReimbursementFormState[Key],
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldError((current) => current?.field === field ? null : current);
  };
  const submit = async () => {
    const supabase = getBrowserSupabaseClient();
    if (!supabase || lock.current) return;
    let payload;
    try {
      payload = toOperatorReimbursementInput(form, copy);
    } catch (error) {
      const message = toOperatorReimbursementErrorMessage(error, copy);
      const field = message === copy.invalidDate ? "spentAt"
        : message === copy.missingAmount || message === copy.invalidAmount ? "amount" : "content";
      setFieldError({ field, message });
      // 先把错误关联到输入框，再把键盘焦点送到第一处需要修改的位置。
      requestAnimationFrame(() => document.getElementById(`reimbursement-${field}`)?.focus());
      return;
    }
    lock.current = true;
    setPending(true);
    setFeedback(null);
    try {
      await createOperatorReimbursement(
        supabase,
        payload,
      );
      markBrowserCloudSyncActivity();
      setOpen(false);
      await onSaved(copy.createSuccess);
    } catch (error) {
      setFeedback({
        tone: "error",
        message: toOperatorReimbursementErrorMessage(error, copy),
      });
    } finally {
      lock.current = false;
      setPending(false);
    }
  };
  return {
    open,
    form,
    feedback,
    fieldError,
    pending,
    openCreate,
    changeOpen,
    updateField,
    submit,
  };
}
