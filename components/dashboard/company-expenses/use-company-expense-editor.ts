"use client";

import { useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CompanyExpenseCreateRejected,
  companyExpenseCreateDifferent,
  companyExpenseCreateUnconfirmed,
  createCompanyExpense,
  getCompanyExpenseDraftKey,
  updateCompanyExpense,
  type CompanyExpenseRow,
} from "@/lib/company-expenses";
import { getCurrentUser } from "@/lib/current-session-auth";
import {
  createCompanyExpenseFormFromRow,
  createEmptyCompanyExpenseForm,
  toCompanyExpenseErrorMessage,
  toCompanyExpenseInput,
  type CompanyExpenseFormState,
} from "./company-expenses-form";

type EditorCopy = Parameters<typeof toCompanyExpenseInput>[1] & {
  createDifferent: string;
  createUnconfirmed: string;
};

type Creation = {
  actorId: string;
  id: string;
  key: string;
  form: CompanyExpenseFormState;
};

export function useCompanyExpenseEditor(
  supabase: SupabaseClient | null,
  copy: EditorCopy,
  onSaved: (row: CompanyExpenseRow, editing: boolean) => void,
) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<CompanyExpenseRow | null>(null);
  const [formState, setFormState] = useState(createEmptyCompanyExpenseForm);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitPending, setSubmitPending] = useState(false);
  const lock = useRef(false);
  const creation = useRef<Creation | null>(null);

  function openCreateDialog() {
    setEditingExpense(null);
    setFormState(creation.current?.form ?? createEmptyCompanyExpenseForm());
    setErrorMessage(creation.current ? copy.createUnconfirmed : null);
    setDialogOpen(true);
  }

  function openEditDialog(expense: CompanyExpenseRow) {
    setEditingExpense(expense);
    setFormState(createCompanyExpenseFormFromRow(expense));
    setErrorMessage(null);
    setDialogOpen(true);
  }

  async function handleSubmit() {
    if (!supabase || lock.current) return;
    // 状态要等 React 重绘才能禁用按钮；同步锁保证首帧连击也只有一次写入。
    lock.current = true;
    setSubmitPending(true);
    setErrorMessage(null);
    try {
      const input = toCompanyExpenseInput(formState, copy);
      if (editingExpense) {
        onSaved(await updateCompanyExpense(supabase, editingExpense.id, input), true);
      } else {
        const prior = creation.current;
        const key = getCompanyExpenseDraftKey(input);
        if (prior && prior.key !== key) throw new Error(companyExpenseCreateDifferent);
        const actor = await getCurrentUser(supabase);
        if (!actor || (prior && prior.actorId !== actor.id)) throw new Error("permission denied");
        const draft = prior ?? { actorId: actor.id, form: formState, id: crypto.randomUUID(), key };
        creation.current = draft;
        try {
          const saved = await createCompanyExpense(supabase, draft, input);
          creation.current = null;
          onSaved(saved, false);
        } catch (error) {
          // 首次请求明确被拒绝时可以修正草稿；之前断过线时则保留原编号和表单。
          if (!prior && error instanceof CompanyExpenseCreateRejected) creation.current = null;
          throw error;
        }
      }
      setDialogOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setErrorMessage(message === companyExpenseCreateDifferent
        ? copy.createDifferent
        : message === companyExpenseCreateUnconfirmed
          ? copy.createUnconfirmed
          : toCompanyExpenseErrorMessage(error, copy));
    } finally {
      lock.current = false;
      setSubmitPending(false);
    }
  }

  return {
    dialogFeedback: errorMessage ? { tone: "error" as const, message: errorMessage } : null,
    dialogOpen,
    editingExpense,
    formState,
    handleDialogOpenChange(open: boolean) {
      if (!lock.current) setDialogOpen(open);
    },
    handleSubmit,
    openCreateDialog,
    openEditDialog,
    submitPending,
    updateFormField<Key extends keyof CompanyExpenseFormState>(field: Key, value: CompanyExpenseFormState[Key]) {
      setFormState((current) => ({ ...current, [field]: value }));
    },
  };
}
