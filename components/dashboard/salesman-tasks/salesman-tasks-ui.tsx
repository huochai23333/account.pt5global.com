/** 任务、团队与旅游协作资产：组合或展示本模块已准备的数据；交互回调沿上层状态与服务处理，不在展示中重新实现业务规则。 */
"use client";

import { InteractiveButton as DesignButton } from "@/components/ui/button";

import { useTranslations } from "next-intl";
import { CircleCheckBig, LoaderCircle, Paperclip, Upload, UsersRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useLocale } from "@/components/i18n/locale-provider";
import { formatDateTime, formatFileSize } from "@/components/dashboard/dashboard-shared-ui";
import {
  formatTaskCommissionMoney,
  getTaskAcceptanceLimitLabel,
  getTaskAcceptanceRemainingLabel,
  getTaskAttachmentCountLabel,
  getTaskIntroText,
  getTaskReviewRequirementLabel,
  getTaskTargetRolesLabel,
  getTaskTypeLabel,
} from "@/components/dashboard/tasks/tasks-display";
import {
  TaskDataPill as DataPill,
  TaskInfoTile as InfoTile,
  TaskStatusPill,
} from "@/components/dashboard/tasks/task-ui";
import type { SalesmanTaskRow } from "@/lib/salesman-tasks";

export {
  TaskFilterField as FilterField,
  TaskSearchField as SearchField,
} from "@/components/dashboard/tasks/task-ui";

export function SalesmanTaskCard({
  task,
  viewerId,
  busy,
  attachmentBusyKey,
  onAccept,
  onOpenAttachment,
  onSubmitReview,
}: {
  task: SalesmanTaskRow;
  viewerId: string | null;
  busy: boolean;
  attachmentBusyKey: string | null;
  onAccept: () => void;
  onOpenAttachment: (attachment: SalesmanTaskRow["attachments"][number]) => void;
  onSubmitReview: () => void;
}) {
  const t = useTranslations("Tasks.salesman.card");
  const sharedT = useTranslations("Tasks.shared");
  const { locale } = useLocale();
  const isMine = task.accepted_by_user_id === viewerId;
  const targetLabel = getTaskTargetRolesLabel(task.target_roles, sharedT);
  const hasReviewFeedback = Boolean(task.review_reject_reason);
  const canAccept =
    task.status === "to_be_accepted" &&
    task.parent_task_id === null &&
    (task.acceptance_unlimited || task.accepted_count < task.acceptance_limit);

  return (
    <article className="rounded-surface-panel border border-border-subtle bg-surface-interactive p-6 shadow-surface-interactive">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <TaskStatusPill status={task.status} />
          <DataPill accent="blue">
            <UsersRound className="size-3.5" />
            {targetLabel}
          </DataPill>
          <DataPill accent="blue">
            {getTaskTypeLabel(task.task_type_label, task.task_type_code, sharedT)}
          </DataPill>
          <DataPill accent="gold">
            {formatTaskCommissionMoney(task.commission_amount_rmb, locale)}
          </DataPill>
          <DataPill accent="blue">{getTaskAcceptanceRemainingLabel(task, sharedT)}</DataPill>
          <DataPill accent="blue">
            {getTaskReviewRequirementLabel(task.review_requires_attachment, sharedT)}
          </DataPill>
          {task.attachments.length > 0 ? (
            <DataPill accent="blue">
              <Paperclip className="size-3.5" />
              {getTaskAttachmentCountLabel(task.attachments.length, sharedT)}
            </DataPill>
          ) : null}
        </div>

        <div>
          <h3 className="break-words text-2xl font-bold tracking-tight text-content-strong">
            {task.task_name}
          </h3>
          <p className="mt-3 break-words text-sm leading-7 text-content-muted">
            {getTaskIntroText(task.task_intro, sharedT)}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <InfoTile
            label={t("taskTypeLabel")}
            value={getTaskTypeLabel(task.task_type_label, task.task_type_code, sharedT)}
          />
          <InfoTile
            label={t("commissionAmountLabel")}
            value={formatTaskCommissionMoney(task.commission_amount_rmb, locale)}
          />
          <InfoTile
            label={t("acceptanceLimitLabel")}
            value={getTaskAcceptanceLimitLabel(task, sharedT)}
          />
          <InfoTile
            label={t("reviewRequirementLabel")}
            value={getTaskReviewRequirementLabel(task.review_requires_attachment, sharedT)}
          />
          <InfoTile label={t("taskScopeLabel")} value={targetLabel} />
          <InfoTile label={t("createdAtLabel")} value={formatDateTime(task.created_at)} />
          <InfoTile label={t("acceptedAtLabel")} value={formatDateTime(task.accepted_at)} />
          <InfoTile label={t("submittedAtLabel")} value={formatDateTime(task.submitted_at)} />
          <InfoTile label={t("reviewedAtLabel")} value={formatDateTime(task.reviewed_at)} />
          <InfoTile label={t("completedAtLabel")} value={formatDateTime(task.completed_at)} />
        </div>

        {task.attachments.length > 0 ? (
          <div className="rounded-control-large border border-border-subtle bg-surface-inset p-4">
            <p className="text-sm font-semibold text-primary">{t("attachmentsTitle")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {task.attachments.map((attachment) => {
                const attachmentKey = `${task.id}:${attachment.id}`;
                const attachmentBusy = attachmentBusyKey === attachmentKey;

                return (
                  <DesignButton
                    className="inline-flex items-center gap-2 rounded-full bg-status-info-soft px-3 py-2 text-xs font-medium text-primary transition hover:bg-surface-inset disabled:cursor-not-allowed disabled:opacity-70"
                    disabled={attachmentBusy}
                    key={attachment.id}
                    onClick={() => onOpenAttachment(attachment)}
                    type="button"
                  >
                    {attachmentBusy ? (
                      <LoaderCircle className="size-3.5 animate-spin" />
                    ) : (
                      <Paperclip className="size-3.5" />
                    )}
                    {attachment.original_name}
                    <span className="text-content-muted">
                      {formatFileSize(attachment.file_size_bytes)}
                    </span>
                  </DesignButton>
                );
              })}
            </div>
          </div>
        ) : null}

        {hasReviewFeedback ? (
          <div className="rounded-control-large border border-border-subtle bg-surface-inset p-4">
            <p className="text-sm font-semibold text-status-danger">
              {t("reviewRejectReasonLabel")}
            </p>
            <p className="mt-2 text-sm leading-7 text-content-muted">{task.review_reject_reason}</p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          {canAccept ? (
            <Button
              variant="primary"
              size="default"
              className="disabled:opacity-70"
              disabled={busy}
              onClick={onAccept}
              type="button"
            >
              {busy ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <CircleCheckBig className="size-4" />
              )}
              {t("accept")}
            </Button>
          ) : null}

          {task.status === "to_be_accepted" && !canAccept ? (
            <p className="text-sm leading-7 text-content-muted">{t("fullyAccepted")}</p>
          ) : null}

          {(task.status === "accepted" || task.status === "rejected") && isMine ? (
            <Button
              variant="success"
              size="default"
              className="disabled:opacity-70"
              disabled={busy}
              onClick={onSubmitReview}
              type="button"
            >
              {busy ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              {task.status === "rejected" ? t("resubmit") : t("submitReview")}
            </Button>
          ) : null}

          {task.status === "accepted" && !isMine ? (
            <p className="text-sm leading-7 text-content-muted">{t("takenByOthers")}</p>
          ) : null}

          {task.status === "reviewing" ? (
            <p className="text-sm leading-7 text-content-muted">
              {isMine ? t("reviewingByMe") : t("reviewingByOthers")}
            </p>
          ) : null}

          {task.status === "rejected" && !isMine ? (
            <p className="text-sm leading-7 text-content-muted">{t("rejectedByOthers")}</p>
          ) : null}

          {task.status === "completed" ? (
            <p className="text-sm leading-7 text-content-muted">
              {isMine ? t("completedByMe") : t("completedGeneric")}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
