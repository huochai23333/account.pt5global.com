import type { SalesmanTaskRow } from "@/lib/salesman-tasks";
import type { TaskScope, TaskStatus, TaskTargetRole } from "@/lib/admin-tasks";
import type { Locale } from "@/lib/locale";

type TranslationValues = Record<string, string | number>;
export type TranslateFn = (key: string, values?: TranslationValues) => string;

export function getTaskStatusMeta(
  status: TaskStatus | SalesmanTaskRow["status"],
  t: TranslateFn,
) {
  if (status === "to_be_accepted") {
    return { label: t("status.toBeAccepted"), accent: "gold" as const };
  }

  if (status === "accepted") {
    return { label: t("status.accepted"), accent: "blue" as const };
  }

  if (status === "reviewing") {
    return { label: t("status.reviewing"), accent: "orange" as const };
  }

  if (status === "rejected") {
    return { label: t("status.rejected"), accent: "rose" as const };
  }

  return { label: t("status.completed"), accent: "green" as const };
}

export function getTaskScopeLabel(
  scope: TaskScope | SalesmanTaskRow["scope"],
  t: TranslateFn,
) {
  return scope === "public" ? t("scope.public") : t("scope.team");
}

// 只有团队任务才显示团队名称，两个佣金看板使用相同的范围标签。
export function getTaskScopeWithTeamLabel(
  scope: TaskScope,
  teamName: string | null,
  t: TranslateFn,
) {
  const scopeLabel = getTaskScopeLabel(scope, t);
  return scope === "team" && teamName ? `${scopeLabel} · ${teamName}` : scopeLabel;
}

export function getTaskTeamName(
  teamName: string | null | undefined,
  t: TranslateFn,
) {
  return teamName?.trim() || t("fallback.unnamedTeam");
}

export function getTaskTargetRoleLabel(role: TaskTargetRole, t: TranslateFn) {
  return t(`targetRoles.${role}`);
}

export function getTaskTargetRolesLabel(
  roles: TaskTargetRole[],
  t: TranslateFn,
) {
  if (roles.length === 0) {
    return t("fallback.noRecord");
  }

  return roles.map((role) => getTaskTargetRoleLabel(role, t)).join("、");
}

export function getTaskIntroText(
  taskIntro: string | null | undefined,
  t: TranslateFn,
) {
  return taskIntro?.trim() || t("fallback.noTaskIntro");
}

export function getTaskTypeLabel(
  taskTypeLabel: string | null | undefined,
  taskTypeCode: string | null | undefined,
  t: TranslateFn,
) {
  return taskTypeLabel?.trim() || taskTypeCode?.trim() || t("fallback.unknownTaskType");
}

export function formatTaskCommissionMoney(value: number, locale: Locale) {
  if (value <= 0) {
    return locale === "zh" ? "无奖励" : "No reward";
  }

  return new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function getTaskAcceptanceProgressLabel(
  task: {
    acceptance_limit: number;
    acceptance_unlimited: boolean;
    accepted_count: number;
    completed_count: number;
  },
  t: TranslateFn,
) {
  if (task.acceptance_unlimited) {
    return t("acceptance.progressUnlimited", {
      accepted: task.accepted_count,
      completed: task.completed_count,
    });
  }

  return t("acceptance.progressLimited", {
    accepted: task.accepted_count,
    completed: task.completed_count,
    limit: task.acceptance_limit,
  });
}

export function getTaskAcceptanceLimitLabel(
  task: {
    acceptance_limit: number;
    acceptance_unlimited: boolean;
  },
  t: TranslateFn,
) {
  if (task.acceptance_unlimited) {
    return t("acceptance.unlimited");
  }

  return t("acceptance.limited", { limit: task.acceptance_limit });
}

export function getTaskAcceptanceRemainingLabel(
  task: {
    acceptance_limit: number;
    acceptance_unlimited: boolean;
    accepted_count: number;
  },
  t: TranslateFn,
) {
  if (task.acceptance_unlimited) {
    return t("acceptance.remainingUnlimited");
  }

  return t("acceptance.remainingLimited", {
    count: Math.max(0, task.acceptance_limit - task.accepted_count),
  });
}

export function getTaskAttachmentCountLabel(count: number, t: TranslateFn) {
  return t("attachmentCount", { count });
}

export function getTaskReviewRequirementLabel(
  reviewRequiresAttachment: boolean,
  t: TranslateFn,
) {
  return reviewRequiresAttachment
    ? t("reviewRequirementRequiresAttachment")
    : t("reviewRequirementNoteOnly");
}

export function getTaskMoreAttachmentsLabel(count: number, t: TranslateFn) {
  return t("moreAttachments", { count });
}

export function resolveTaskActorLabel(
  actor:
    | {
        name: string | null;
        email: string | null;
      }
    | null
    | undefined,
  fallbackUserId: string | null | undefined,
  t: TranslateFn,
) {
  return actor?.name ?? actor?.email ?? fallbackUserId ?? t("fallback.noRecord");
}

export function getTaskAssignmentLabel(
  scope: TaskScope,
  teamName: string | null | undefined,
  t: TranslateFn,
) {
  return scope === "team" ? getTaskTeamName(teamName, t) : t("scope.public");
}

export { toAdminTaskErrorMessage, toSalesmanTaskErrorMessage } from "./tasks-error-messages";
