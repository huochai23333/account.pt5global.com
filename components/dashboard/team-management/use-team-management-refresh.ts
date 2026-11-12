"use client";

import { useCallback, type Dispatch, type SetStateAction } from "react";
import { useTranslations } from "next-intl";

import { getTeamManagementPageData, type TeamManagementPageData } from "@/lib/team-management";
import type { getBrowserSupabaseClient } from "@/lib/supabase";

import { toTeamManagementErrorMessage } from "./team-management-display";
import type { PageFeedback } from "./team-management-view-model-shared";

// 读取选中的团队，并给手动刷新、工作台同步和写入后读回提供同一入口。
export function useTeamManagementRefresh({
  applyTeamManagementPageData,
  selectedTeamId,
  setBusyKey,
  setPageFeedback,
  supabase,
}: {
  applyTeamManagementPageData: (pageData: TeamManagementPageData) => void;
  selectedTeamId: string | null;
  setBusyKey: Dispatch<SetStateAction<string | null>>;
  setPageFeedback: Dispatch<SetStateAction<PageFeedback>>;
  supabase: ReturnType<typeof getBrowserSupabaseClient>;
}) {
  const t = useTranslations("TeamManagement");

  const refreshQuietly = useCallback(
    async (preferredTeamId?: string | null) => {
      if (!supabase) {
        return;
      }

      const nextPageData = await getTeamManagementPageData(
        supabase,
        preferredTeamId ?? selectedTeamId,
      );

      // 读取完成后由视图模型判断是否仍属于发起请求的服务端快照。
      applyTeamManagementPageData(nextPageData);
      setPageFeedback(null);
    },
    [applyTeamManagementPageData, selectedTeamId, supabase, setPageFeedback],
  );

  const refreshTeamManagementPage = useCallback(
    async ({ isMounted }: { isMounted: () => boolean }) => {
      if (!supabase) {
        return;
      }

      try {
        const nextPageData = await getTeamManagementPageData(
          supabase,
          selectedTeamId,
        );

        if (!isMounted()) {
          return;
        }

        applyTeamManagementPageData(nextPageData);
        setPageFeedback(null);
      } catch (error) {
        if (!isMounted()) {
          return;
        }

        setPageFeedback({
          tone: "error",
          message: toTeamManagementErrorMessage(error, t),
        });
      }
    },
    [applyTeamManagementPageData, selectedTeamId, supabase, t, setPageFeedback],
  );

  const handleSelectTeam = useCallback(
    async (teamId: string) => {
      if (teamId === selectedTeamId) {
        return;
      }

      setBusyKey(`team:${teamId}`);

      try {
        await refreshQuietly(teamId);
      } catch (error) {
        setPageFeedback({ tone: "error", message: toTeamManagementErrorMessage(error, t) });
      } finally {
        setBusyKey(null);
      }
    },
    [selectedTeamId, refreshQuietly, setBusyKey, setPageFeedback, t],
  );

  const handleRefresh = useCallback(async () => {
    setBusyKey("refresh");

    try {
      await refreshQuietly(selectedTeamId);
    } catch (error) {
      setPageFeedback({ tone: "error", message: toTeamManagementErrorMessage(error, t) });
    } finally {
      setBusyKey(null);
    }
  }, [selectedTeamId, refreshQuietly, setBusyKey, setPageFeedback, t]);

  return { handleSelectTeam, handleRefresh, refreshQuietly, refreshTeamManagementPage };
}
