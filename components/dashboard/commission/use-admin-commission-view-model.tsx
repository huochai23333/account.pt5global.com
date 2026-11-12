"use client";

import { useCallback, useMemo, useState } from "react";
import { Coins, WalletCards } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  getAdminCommissionPageData,
  type AdminCommissionPageData,
  type AdminCommissionRow,
} from "@/lib/admin-commission";
import { getBrowserSupabaseClient } from "@/lib/supabase";
import { useDashboardPagination } from "@/lib/use-dashboard-pagination";
import {
  type FeedbackTone,
} from "@/components/dashboard/dashboard-shared-ui";
import { useWorkspaceSyncEffect } from "@/components/dashboard/workspace-session-provider";

import { toCommissionErrorMessage } from "./commission-display";
import { useAdminCommissionFilters } from "./use-admin-commission-filters";
import { useManagedCommissionSettlement } from "./use-managed-commission-settlement";

type PageFeedback = { message: string; tone: FeedbackTone } | null;
type CommissionBoard = "normal" | "task";

// 管理看板只串联数据刷新、当前视图和行操作，筛选规则在独立 Hook 中。
export function useAdminCommissionViewModel(
  initialData: AdminCommissionPageData,
) {
  const supabase = getBrowserSupabaseClient();
  const t = useTranslations("Commission");
  const [pageFeedback, setPageFeedback] = useState<PageFeedback>(null);
  const [hasPermission, setHasPermission] = useState(initialData.hasPermission);
  const [commissions, setCommissions] = useState<AdminCommissionRow[]>(
    initialData.commissions,
  );
  const [taskCommissions, setTaskCommissions] = useState(
    initialData.taskCommissions,
  );
  const [activeBoard, setActiveBoard] = useState<CommissionBoard>("normal");

  const applyPageData = useCallback((pageData: AdminCommissionPageData) => {
    setHasPermission(pageData.hasPermission);
    setCommissions(pageData.commissions);
    setTaskCommissions(pageData.taskCommissions);
  }, []);

  const reloadCommissionBoard = useCallback(async () => {
    if (!supabase) return;
    applyPageData(await getAdminCommissionPageData(supabase));
    setPageFeedback(null);
  }, [applyPageData, supabase]);

  const refreshCommissionBoard = useCallback(
    async ({ isMounted }: { isMounted: () => boolean }) => {
      if (!supabase) return;
      try {
        const nextPageData = await getAdminCommissionPageData(supabase);
        if (!isMounted()) return;
        applyPageData(nextPageData);
        setPageFeedback(null);
      } catch (error) {
        if (!isMounted()) return;
        setPageFeedback({
          message: toCommissionErrorMessage(error, t, "admin"),
          tone: "error",
        });
      }
    },
    [applyPageData, supabase, t],
  );

  useWorkspaceSyncEffect(refreshCommissionBoard);

  const commissionFilters = useAdminCommissionFilters(commissions);
  const commissionsPagination = useDashboardPagination(commissionFilters.filteredCommissions);

  const boardOptions = useMemo(
    () => [
      {
        icon: <WalletCards className="size-4" />,
        key: "normal" as const,
        meta: t("boards.normal.meta", { count: commissions.length }),
        title: t("boards.normal.title"),
      },
      {
        icon: <Coins className="size-4" />,
        key: "task" as const,
        meta: t("boards.task.meta", { count: taskCommissions.length }),
        title: t("boards.task.title"),
      },
    ],
    [commissions.length, taskCommissions.length, t],
  );

  const {
    handleMarkCommissionAsPaid,
    handleMarkTaskCommissionAsPaid,
    settlingCommissionId,
    settlingTaskCommissionId,
  } = useManagedCommissionSettlement({
    onPageFeedback: setPageFeedback,
    refreshCommissionBoard: reloadCommissionBoard,
    supabase,
  });

  return {
    activeBoard,
    ...commissionFilters,
    boardOptions,
    commissionsPagination,
    handleMarkCommissionAsPaid,
    handleMarkTaskCommissionAsPaid,
    hasPermission,
    pageFeedback,
    setActiveBoard,
    settlingCommissionId,
    settlingTaskCommissionId,
    taskCommissions,
  };
}
