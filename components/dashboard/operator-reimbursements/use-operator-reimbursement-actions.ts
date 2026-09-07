"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  deleteOperatorReimbursement,
  reimburseOperatorPeriod,
  type OperatorReimbursementRow,
  type OperatorReimbursementsPageData,
} from "@/lib/operator-reimbursements";
import { getBrowserSupabaseClient } from "@/lib/supabase";
import { markBrowserCloudSyncActivity } from "@/lib/browser-sync-recovery";
import { useDashboardConfirm } from "../dashboard-confirm-provider";
import { toOperatorReimbursementErrorMessage } from "./operator-reimbursements-display";
import type {
  ReimbursementCopy,
  ReimbursementFeedback,
} from "./use-operator-reimbursement-form";

/** 删除和报销共用写入锁；归属检查同时存在于界面和数据库中。 */
export function useOperatorReimbursementActions(
  data: OperatorReimbursementsPageData,
  copy: ReimbursementCopy,
  onSaved: (message: string) => Promise<void>,
  setFeedback: (feedback: ReimbursementFeedback) => void,
) {
  const confirm = useDashboardConfirm();
  const t = useTranslations("DashboardFramework.confirm");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState("");
  const [pending, setPending] = useState(false);
  const [dialogFeedback, setDialogFeedback] =
    useState<ReimbursementFeedback>(null);
  const lock = useRef(false);
  const selected = data.ownPendingPeriods.find((item) => item.start === period);
  const openReimburse = () => {
    const current = data.ownPendingPeriods.find(
      (item) => item.start === data.currentPeriod.start,
    );
    setPeriod((current ?? data.ownPendingPeriods[0])?.start ?? "");
    setDialogFeedback(null);
    setOpen(true);
  };
  const changeOpen = (value: boolean) => {
    if (!lock.current) setOpen(value);
  };
  const remove = async (row: OperatorReimbursementRow) => {
    const supabase = getBrowserSupabaseClient();
    if (
      !supabase ||
      lock.current ||
      row.operator_user_id !== data.currentUserId ||
      row.status !== "unreimbursed"
    )
      return;
    lock.current = true;
    try {
      if (
        !(await confirm({
          description: copy.deleteConfirm(row.content),
          title: t("title"),
          tone: "danger",
        }))
      )
        return;
      setPendingId(row.id);
      await deleteOperatorReimbursement(supabase, row.id);
      markBrowserCloudSyncActivity();
      await onSaved(copy.deleteSuccess);
    } catch (error) {
      setFeedback({
        tone: "error",
        message: toOperatorReimbursementErrorMessage(error, copy),
      });
    } finally {
      lock.current = false;
      setPendingId(null);
    }
  };
  const reimburse = async () => {
    const supabase = getBrowserSupabaseClient();
    if (!supabase || lock.current || !selected) return;
    lock.current = true;
    setPending(true);
    setDialogFeedback(null);
    try {
      const result = await reimburseOperatorPeriod(supabase, selected.start);
      markBrowserCloudSyncActivity();
      setOpen(false);
      await onSaved(
        result.updatedCount > 0
          ? copy.reimburseSuccess(result.updatedCount)
          : copy.reimburseEmpty,
      );
    } catch (error) {
      setDialogFeedback({
        tone: "error",
        message: toOperatorReimbursementErrorMessage(error, copy),
      });
    } finally {
      lock.current = false;
      setPending(false);
    }
  };
  return {
    pendingId,
    open,
    period,
    setPeriod,
    selected,
    pending,
    dialogFeedback,
    openReimburse,
    changeOpen,
    remove,
    reimburse,
  };
}
