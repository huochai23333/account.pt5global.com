"use client";

import { useCallback, useRef, useState } from "react";

import { useTranslations } from "next-intl";

import type { AdminCommissionRow } from "@/lib/admin-commission";
import {
  markCommissionRecordAsPaid,
  markTaskCommissionRecordAsPaid,
} from "@/lib/commission-settlement";
import type { getBrowserSupabaseClient } from "@/lib/supabase";
import type { TaskCommissionRow } from "@/lib/task-commissions";

import type { FeedbackTone } from "@/components/dashboard/dashboard-shared-ui";
import { useDashboardConfirm } from "@/components/dashboard/dashboard-confirm-provider";

import { toCommissionErrorMessage } from "./commission-display";

type PageFeedbackValue = {
  message: string;
  tone: FeedbackTone;
};

type SettlementAction = {
  key: string;
  confirmMessage: string;
  save: () => Promise<string>;
  successMessage: string;
};

export function useManagedCommissionSettlement({
  onPageFeedback,
  refreshCommissionBoard,
  supabase,
}: {
  onPageFeedback: (feedback: PageFeedbackValue | null) => void;
  refreshCommissionBoard: () => Promise<void>;
  supabase: ReturnType<typeof getBrowserSupabaseClient>;
}) {
  const confirm = useDashboardConfirm();
  const confirmT = useTranslations("DashboardFramework.confirm");
  const t = useTranslations("Commission");
  const [settlingKey, setSettlingKey] = useState<string | null>(null);
  const settling = useRef(false);

  const settle = useCallback(
    async (action: SettlementAction) => {
      if (settling.current) return;

      // 确认弹窗打开前先锁住提交，同一轮点击不必等组件重新渲染。
      settling.current = true;
      let saved = false;
      try {
        const confirmed = await confirm({
          description: action.confirmMessage,
          title: confirmT("title"),
          tone: "warning",
        });
        if (!confirmed) return;

        setSettlingKey(action.key);
        await action.save();
        saved = true;
        await refreshCommissionBoard();
        onPageFeedback({ tone: "success", message: action.successMessage });
      } catch (error) {
        // 写入已确认但列表加载失败时，请用户刷新核对，避免误以为要再次结算。
        onPageFeedback({
          tone: "error",
          message: saved
            ? t("feedback.settlementRefreshFailed")
            : toCommissionErrorMessage(error, t, "admin"),
        });
      } finally {
        settling.current = false;
        setSettlingKey(null);
      }
    },
    [confirm, confirmT, onPageFeedback, refreshCommissionBoard, t],
  );

  const handleMarkCommissionAsPaid = useCallback(
    async (commission: AdminCommissionRow) => {
      if (!supabase) return;

      await settle({
        key: `order:${commission.id}`,
        confirmMessage: t("actions.confirmMarkOrderPaid", {
          orderNumber: commission.orderNumber,
        }),
        save: () => markCommissionRecordAsPaid(supabase, { commissionRecordId: commission.id }),
        successMessage: t("feedback.orderMarkedPaid", {
          orderNumber: commission.orderNumber,
        }),
      });
    },
    [settle, supabase, t],
  );

  const handleMarkTaskCommissionAsPaid = useCallback(
    async (commission: TaskCommissionRow) => {
      if (!supabase) return;

      await settle({
        key: `task:${commission.id}`,
        confirmMessage: t("actions.confirmMarkTaskPaid", {
          taskName: commission.taskName,
        }),
        save: () =>
          markTaskCommissionRecordAsPaid(supabase, { taskCommissionRecordId: commission.id }),
        successMessage: t("feedback.taskMarkedPaid", {
          taskName: commission.taskName,
        }),
      });
    },
    [settle, supabase, t],
  );

  return {
    handleMarkCommissionAsPaid,
    handleMarkTaskCommissionAsPaid,
    settlingCommissionId: settlingKey?.startsWith("order:")
      ? settlingKey.slice("order:".length)
      : null,
    settlingTaskCommissionId: settlingKey?.startsWith("task:")
      ? settlingKey.slice("task:".length)
      : null,
  };
}
