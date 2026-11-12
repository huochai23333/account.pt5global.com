"use client";

import { useCallback, type Dispatch, type SetStateAction } from "react";

import { useTranslations } from "next-intl";

import {
  addTeamSalesman,
  deleteTeamProfile,
  removeTeamSalesman,
  saveTeamProfile,
} from "@/lib/team-management";
import { getBrowserSupabaseClient } from "@/lib/supabase";
import { useDashboardConfirm } from "@/components/dashboard/dashboard-confirm-provider";

import { toTeamManagementErrorMessage } from "./team-management-display";
import {
  type PageFeedback,
  type TeamManagementDataState,
} from "./team-management-view-model-shared";

export function useTeamManagementActions({
  refreshQuietly,
  currentData,
  setBusyKey,
  setPageFeedback,
  supabase,
}: {
  refreshQuietly: (preferredTeamId?: string | null) => Promise<void>;
  currentData: TeamManagementDataState;
  setBusyKey: Dispatch<SetStateAction<string | null>>;
  setPageFeedback: Dispatch<SetStateAction<PageFeedback>>;
  supabase: ReturnType<typeof getBrowserSupabaseClient>;
}) {
  const confirm = useDashboardConfirm();
  const confirmT = useTranslations("DashboardFramework.confirm");
  const t = useTranslations("TeamManagement");
  const currentTeamId = currentData.detail.team?.team_id ?? null;

  const refreshAuthClaims = useCallback(async () => {
    if (!supabase) {
      return;
    }

    const { error } = await supabase.auth.refreshSession();

    if (error) {
      throw error;
    }
  }, [supabase]);

  const handleSaveTeam = useCallback(async () => {
    if (!supabase || !currentData.teamNameDraft.trim()) {
      return;
    }

    setBusyKey("save-team");

    try {
      const teamId = await saveTeamProfile(supabase, {
        teamId: currentData.detail.team?.team_id ?? null,
        teamName: currentData.teamNameDraft,
        managerUserId:
          currentData.viewerRole === "administrator"
            ? currentData.managerUserIdDraft || null
            : undefined,
      });
      await refreshAuthClaims();
      await refreshQuietly(teamId);
      setPageFeedback({
        tone: "success",
        message: currentData.detail.team
          ? t("feedback.updated")
          : t("feedback.createdAndContinue"),
      });
    } catch (error) {
      setPageFeedback({
        tone: "error",
        message: toTeamManagementErrorMessage(error, t),
      });
    } finally {
      setBusyKey(null);
    }
  }, [
    currentData.detail.team,
    currentData.managerUserIdDraft,
    currentData.teamNameDraft,
    currentData.viewerRole,
    refreshAuthClaims,
    refreshQuietly,
    setBusyKey,
    setPageFeedback,
    supabase,
    t,
  ]);

  const handleCreateTeam = useCallback(async () => {
    if (
      !supabase ||
      currentData.viewerRole !== "administrator" ||
      !currentData.createTeamNameDraft.trim()
    ) {
      return;
    }

    setBusyKey("create-team");

    try {
      const teamId = await saveTeamProfile(supabase, {
        teamName: currentData.createTeamNameDraft,
        managerUserId: currentData.createManagerUserIdDraft || null,
      });
      await refreshAuthClaims();
      await refreshQuietly(teamId);
      setPageFeedback({
        tone: "success",
        message: t("feedback.created"),
      });
    } catch (error) {
      setPageFeedback({
        tone: "error",
        message: toTeamManagementErrorMessage(error, t),
      });
    } finally {
      setBusyKey(null);
    }
  }, [
    currentData.createManagerUserIdDraft,
    currentData.createTeamNameDraft,
    currentData.viewerRole,
    refreshAuthClaims,
    refreshQuietly,
    setBusyKey,
    setPageFeedback,
    supabase,
    t,
  ]);

  const handleAddSalesman = useCallback(
    async (salesmanUserId: string) => {
      if (!supabase || !currentTeamId) {
        return;
      }

      setBusyKey(`add:${salesmanUserId}`);

      try {
        const teamId = await addTeamSalesman(supabase, {
          salesmanUserId,
          teamId: currentTeamId,
        });
        await refreshAuthClaims();
        await refreshQuietly(teamId);
        setPageFeedback({
          tone: "success",
          message: t("feedback.memberAdded"),
        });
      } catch (error) {
        setPageFeedback({
          tone: "error",
          message: toTeamManagementErrorMessage(error, t),
        });
      } finally {
        setBusyKey(null);
      }
    },
    [
      currentTeamId,
      refreshAuthClaims,
      refreshQuietly,
      setBusyKey,
      setPageFeedback,
      supabase,
      t,
    ],
  );

  const handleRemoveSalesman = useCallback(
    async (salesmanUserId: string) => {
      if (!supabase || !currentTeamId) {
        return;
      }

      setBusyKey(`remove:${salesmanUserId}`);

      try {
        const teamId = await removeTeamSalesman(supabase, {
          salesmanUserId,
          teamId: currentTeamId,
        });
        await refreshAuthClaims();
        await refreshQuietly(teamId);
        setPageFeedback({
          tone: "success",
          message: t("feedback.memberRemoved"),
        });
      } catch (error) {
        setPageFeedback({
          tone: "error",
          message: toTeamManagementErrorMessage(error, t),
        });
      } finally {
        setBusyKey(null);
      }
    },
    [
      currentTeamId,
      refreshAuthClaims,
      refreshQuietly,
      setBusyKey,
      setPageFeedback,
      supabase,
      t,
    ],
  );

  const handleDeleteTeam = useCallback(async () => {
    if (
      !supabase ||
      currentData.viewerRole !== "administrator" ||
      !currentData.detail.team?.team_id
    ) {
      return;
    }

    if (!(await confirm({
      description: t("confirmDelete", {
        teamName:
          currentData.detail.team.team_name?.trim() ||
          t("shared.fallback.unnamedTeam"),
      }),
      title: confirmT("title"),
      tone: "danger",
    }))) {
      return;
    }

    setBusyKey("delete-team");

    try {
      await deleteTeamProfile(supabase, currentData.detail.team.team_id);
      await refreshQuietly(null);
      setPageFeedback({
        tone: "success",
        message: t("feedback.deleted"),
      });
    } catch (error) {
      setPageFeedback({
        tone: "error",
        message: toTeamManagementErrorMessage(error, t),
      });
    } finally {
      setBusyKey(null);
    }
  }, [
    confirm,
    confirmT,
    currentData.detail.team,
    currentData.viewerRole,
    refreshQuietly,
    setBusyKey,
    setPageFeedback,
    supabase,
    t,
  ]);

  return {
    handleAddSalesman,
    handleCreateTeam,
    handleDeleteTeam,
    handleRemoveSalesman,
    handleSaveTeam,
  };
}
