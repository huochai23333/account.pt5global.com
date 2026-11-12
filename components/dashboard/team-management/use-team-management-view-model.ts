"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import {
  canViewTeamPanel,
  type TeamManagementPageData,
} from "@/lib/team-management";
import { getBrowserSupabaseClient } from "@/lib/supabase";

import { useWorkspaceSyncEffect } from "@/components/dashboard/workspace-session-provider";
import { createDashboardSharedCopy } from "@/components/dashboard/dashboard-shared-ui";

import {
  filterTeamCandidates,
  filterTeamClients,
  filterTeamMembers,
} from "./team-management-utils";
import {
  applyTeamManagementReadback,
  createTeamManagementDataState,
  getTeamManagementDataKey,
  type PageFeedback,
  type TeamManagementDataState,
} from "./team-management-view-model-shared";
import { useTeamManagementActions } from "./use-team-management-actions";
import { useTeamManagementRefresh } from "./use-team-management-refresh";

export function useTeamManagementViewModel({
  initialData,
}: {
  initialData: TeamManagementPageData;
}) {
  const supabase = getBrowserSupabaseClient();
  const sharedT = useTranslations("DashboardShared");
  const sharedCopy = useMemo(() => createDashboardSharedCopy(sharedT), [sharedT]);

  const initialDataKey = useMemo(
    () => getTeamManagementDataKey(initialData),
    [initialData],
  );
  const [dataState, setDataState] = useState<TeamManagementDataState>(() =>
    createTeamManagementDataState(initialData),
  );
  const [pageFeedback, setPageFeedback] = useState<PageFeedback>(null);
  const [memberSearchText, setMemberSearchText] = useState("");
  const [clientSearchText, setClientSearchText] = useState("");
  const [candidateSearchText, setCandidateSearchText] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const currentData =
    dataState.dataKey === initialDataKey
      ? dataState
      : createTeamManagementDataState(initialData);

  // 新服务端快照到达时先切换本地基线，旧请求的回调不能覆盖新的权限或团队。
  if (dataState !== currentData) {
    setDataState(currentData);
  }

  const updateDataState = useCallback(
    (updater: (current: TeamManagementDataState) => TeamManagementDataState) => {
      setDataState((current) => current.dataKey === initialDataKey ? updater(current) : current);
    },
    [initialDataKey],
  );

  const applyTeamManagementPageData = useCallback((pageData: TeamManagementPageData) => {
    setDataState((current) => applyTeamManagementReadback(current, initialDataKey, pageData));
  }, [initialDataKey]);

  const refresh = useTeamManagementRefresh({
    applyTeamManagementPageData,
    selectedTeamId: currentData.selectedTeamId,
    setBusyKey,
    setPageFeedback,
    supabase,
  });
  const actions = useTeamManagementActions({
    refreshQuietly: refresh.refreshQuietly,
    currentData,
    setBusyKey,
    setPageFeedback,
    supabase,
  });

  useWorkspaceSyncEffect(refresh.refreshTeamManagementPage);

  const canView = canViewTeamPanel(currentData.viewerRole, currentData.viewerStatus);
  const canManageSelectedTeam = currentData.detail.team?.can_manage === true;

  const filteredMembers = useMemo(
    () => filterTeamMembers(currentData.detail.members, memberSearchText, sharedCopy),
    [currentData.detail.members, memberSearchText, sharedCopy],
  );
  const filteredClients = useMemo(
    () => filterTeamClients(currentData.detail.clients, clientSearchText, sharedCopy),
    [clientSearchText, currentData.detail.clients, sharedCopy],
  );
  const filteredCandidates = useMemo(
    () =>
      filterTeamCandidates(
        currentData.candidateSalesmen,
        candidateSearchText,
        sharedCopy,
      ),
    [candidateSearchText, currentData.candidateSalesmen, sharedCopy],
  );
  const availableCandidateCount = useMemo(
    () =>
      currentData.candidateSalesmen.filter((candidate) => candidate.assignable).length,
    [currentData.candidateSalesmen],
  );

  const updateTeamNameDraft = useCallback(
    (value: string) => {
      updateDataState((current) => ({
        ...current,
        teamNameDraft: value,
      }));
    },
    [updateDataState],
  );

  const updateManagerUserIdDraft = useCallback(
    (value: string) => {
      updateDataState((current) => ({
        ...current,
        managerUserIdDraft: value,
      }));
    },
    [updateDataState],
  );

  const updateCreateTeamNameDraft = useCallback(
    (value: string) => {
      updateDataState((current) => ({
        ...current,
        createTeamNameDraft: value,
      }));
    },
    [updateDataState],
  );

  const updateCreateManagerUserIdDraft = useCallback(
    (value: string) => {
      updateDataState((current) => ({
        ...current,
        createManagerUserIdDraft: value,
      }));
    },
    [updateDataState],
  );

  return {
    availableCandidateCount,
    busyKey,
    canManageSelectedTeam,
    canView,
    candidateSalesmen: currentData.candidateSalesmen,
    candidateSearchText,
    clientSearchText,
    createManagerCandidates: currentData.createManagerCandidates,
    createManagerUserIdDraft: currentData.createManagerUserIdDraft,
    createTeamNameDraft: currentData.createTeamNameDraft,
    detail: currentData.detail,
    filteredCandidates,
    filteredClients,
    filteredMembers,
    handleAddSalesman: actions.handleAddSalesman,
    handleCreateTeam: actions.handleCreateTeam,
    handleDeleteTeam: actions.handleDeleteTeam,
    handleRefresh: refresh.handleRefresh,
    handleRemoveSalesman: actions.handleRemoveSalesman,
    handleSaveTeam: actions.handleSaveTeam,
    handleSelectTeam: refresh.handleSelectTeam,
    managerCandidates: currentData.managerCandidates,
    managerUserIdDraft: currentData.managerUserIdDraft,
    memberSearchText,
    overviews: currentData.overviews,
    pageFeedback,
    selectedTeamId: currentData.selectedTeamId,
    setCandidateSearchText,
    setClientSearchText,
    setMemberSearchText,
    teamNameDraft: currentData.teamNameDraft,
    updateCreateManagerUserIdDraft,
    updateCreateTeamNameDraft,
    updateManagerUserIdDraft,
    updateTeamNameDraft,
    viewerRole: currentData.viewerRole,
    viewerStatus: currentData.viewerStatus,
  };
}
