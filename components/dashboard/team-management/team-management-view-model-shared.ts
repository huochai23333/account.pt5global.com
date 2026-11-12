import type {
  TeamDetail,
  TeamManagementPageData,
  TeamManagerCandidate,
  TeamOverview,
  TeamSalesmanCandidate,
} from "@/lib/team-management";

import type { FeedbackTone } from "@/components/dashboard/dashboard-shared-ui";

export type PageFeedback = { tone: FeedbackTone; message: string } | null;

export type TeamManagementDataState = {
  dataKey: string;
  candidateSalesmen: TeamSalesmanCandidate[];
  createManagerCandidates: TeamManagerCandidate[];
  createManagerUserIdDraft: string;
  createTeamNameDraft: string;
  detail: TeamDetail;
  managerCandidates: TeamManagerCandidate[];
  managerUserIdDraft: string;
  overviews: TeamOverview[];
  selectedTeamId: string | null;
  teamNameDraft: string;
  viewerRole: TeamManagementPageData["viewerRole"];
  viewerStatus: TeamManagementPageData["viewerStatus"];
};

export function getTeamManagementDataKey(pageData: TeamManagementPageData) {
  return JSON.stringify({
    candidateSalesmen: pageData.candidateSalesmen,
    createManagerCandidates: pageData.createManagerCandidates,
    detail: pageData.detail,
    managerCandidates: pageData.managerCandidates,
    overviews: pageData.overviews,
    selectedTeamId: pageData.selectedTeamId,
    viewerRole: pageData.viewerRole,
    viewerStatus: pageData.viewerStatus,
  });
}

export function createTeamManagementDataState(
  pageData: TeamManagementPageData,
): TeamManagementDataState {
  return {
    candidateSalesmen: pageData.candidateSalesmen,
    createManagerCandidates: pageData.createManagerCandidates,
    createManagerUserIdDraft: "",
    createTeamNameDraft: "",
    dataKey: getTeamManagementDataKey(pageData),
    detail: pageData.detail,
    managerCandidates: pageData.managerCandidates,
    managerUserIdDraft: pageData.detail.team?.manager_user_id ?? "",
    overviews: pageData.overviews,
    selectedTeamId: pageData.selectedTeamId,
    teamNameDraft: pageData.detail.team?.team_name ?? "",
    viewerRole: pageData.viewerRole,
    viewerStatus: pageData.viewerStatus,
  };
}

export function applyTeamManagementReadback(
  current: TeamManagementDataState,
  sourceKey: string,
  pageData: TeamManagementPageData,
): TeamManagementDataState {
  // 本地读回沿用发起时的服务端快照标识，返回的团队编号不能替换这个标识。
  if (current.dataKey !== sourceKey) return current;
  return { ...createTeamManagementDataState(pageData), dataKey: sourceKey };
}
