/** 任务、团队与旅游协作资产：组合或展示本模块已准备的数据；交互回调沿上层状态与服务处理，不在展示中重新实现业务规则。 */
"use client";

import { InteractiveButton as DesignButton } from "@/components/ui/button";

import type { ReactNode } from "react";

import {
  ClipboardList,
  Eye,
  LoaderCircle,
  Mail,
  Paperclip,
  UserRound,
  XCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";

import type { PendingTaskReviewWithAssets } from "@/lib/task-reviews";
import { cn } from "@/lib/utils";

import {
  EmptyState,
  formatDateTime,
  formatFileSize,
  normalizeOptionalString,
} from "../dashboard-shared-ui";
import {
  formatTaskCommissionMoney,
  getTaskAttachmentCountLabel,
  getTaskIntroText,
  getTaskScopeLabel,
  getTaskTeamName,
  getTaskTypeLabel,
} from "../tasks/tasks-display";
import { Button } from "../../ui/button";
import { useLocale } from "../../i18n/locale-provider";
import type { AdminTaskReviewAction } from "./admin-task-review-types";

export function AdminTaskReviewList({
  assetBusyKey,
  busyRows,
  onAction,
  onOpenAsset,
  rows,
}: {
  assetBusyKey: string | null;
  busyRows: Record<string, AdminTaskReviewAction>;
  onAction: (row: PendingTaskReviewWithAssets, action: AdminTaskReviewAction) => Promise<void>;
  onOpenAsset: (
    row: PendingTaskReviewWithAssets,
    asset: PendingTaskReviewWithAssets["assets"][number],
  ) => void;
  rows: PendingTaskReviewWithAssets[];
}) {
  const t = useTranslations("ReviewsUI");
  const sharedT = useTranslations("Tasks.shared");
  const { locale } = useLocale();

  if (rows.length === 0) {
    return (
      <EmptyState
        description={t("task.emptyDescription")}
        icon={<ClipboardList className="size-6" />}
        title={t("task.emptyTitle")}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      {rows.map((row) => {
        const rowKey = `task:${row.acceptance_id}`;
        const busyAction = busyRows[rowKey];
        const assigneeName = getDisplayName(
          row.accepted_by_name,
          row.accepted_by_email,
          t("fallback.unnamedUser"),
        );
        const assigneeEmail = getDisplayEmail(row.accepted_by_email, t("fallback.notProvided"));
        const scopeLabel = getTaskScopeLabel(row.scope, sharedT);
        const teamLabel =
          row.scope === "team" ? getTaskTeamName(row.team_name, sharedT) : scopeLabel;

        return (
          <article
            className="rounded-surface-panel border border-border-subtle bg-surface-interactive p-6 shadow-surface-interactive"
            key={row.submission_id}
          >
            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="gold">
                      {t("task.roundBadge", { round: row.submission_round })}
                    </Badge>
                    <Badge tone="blue">{scopeLabel}</Badge>
                    <Badge tone="blue">
                      {getTaskTypeLabel(row.task_type_name, row.task_type_code, sharedT)}
                    </Badge>
                    <Badge tone="gold">
                      {formatTaskCommissionMoney(row.commission_amount_rmb, locale)}
                    </Badge>
                    <Badge tone="blue">
                      {getTaskAttachmentCountLabel(row.assets.length || row.asset_count, sharedT)}
                    </Badge>
                  </div>
                  <h3 className="mt-4 text-2xl font-bold tracking-tight text-content-strong">
                    {row.task_name}
                  </h3>
                </div>

                <TaskReviewActionGroup
                  busyAction={busyAction}
                  onApprove={() => void onAction(row, "approve")}
                  onReject={() => void onAction(row, "reject")}
                />
              </div>

              <p className="text-sm leading-7 text-content-muted">
                {getTaskIntroText(row.task_intro, sharedT)}
              </p>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <InfoTile
                  icon={<UserRound className="size-4 text-primary" />}
                  label={t("task.assigneeLabel")}
                  value={assigneeName}
                />
                <InfoTile
                  icon={<Mail className="size-4 text-primary" />}
                  label={t("task.emailLabel")}
                  value={assigneeEmail}
                />
                <InfoTile
                  icon={<ClipboardList className="size-4 text-primary" />}
                  label={t("task.scopeLabel")}
                  value={teamLabel}
                />
                <InfoTile
                  icon={<ClipboardList className="size-4 text-primary" />}
                  label={t("task.typeLabel")}
                  value={getTaskTypeLabel(row.task_type_name, row.task_type_code, sharedT)}
                />
                <InfoTile
                  icon={<Paperclip className="size-4 text-primary" />}
                  label={t("task.commissionLabel")}
                  value={formatTaskCommissionMoney(row.commission_amount_rmb, locale)}
                />
                <InfoTile
                  icon={<Paperclip className="size-4 text-primary" />}
                  label={t("task.submittedAtLabel")}
                  value={formatDateTime(row.submitted_at)}
                />
              </div>

              {normalizeOptionalString(row.submission_note) ? (
                <div className="rounded-control-large border border-border-subtle bg-surface-inset p-4">
                  <p className="text-sm font-semibold text-primary">
                    {t("task.submissionNoteLabel")}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-content-muted">{row.submission_note}</p>
                </div>
              ) : null}

              <div className="rounded-control-large border border-border-subtle bg-surface-inset p-4">
                <p className="text-sm font-semibold text-primary">{t("task.assetsLabel")}</p>

                {row.assets.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {row.assets.map((asset) => {
                      const nextAssetBusyKey = `${row.submission_id}:${asset.id}`;
                      const busy = assetBusyKey === nextAssetBusyKey;

                      return (
                        <DesignButton
                          className="inline-flex items-center gap-2 rounded-full bg-status-info-soft px-3 py-2 text-xs font-medium text-primary transition hover:bg-surface-inset disabled:cursor-not-allowed disabled:opacity-70"
                          disabled={busy}
                          key={asset.id}
                          onClick={() => onOpenAsset(row, asset)}
                          type="button"
                        >
                          {busy ? (
                            <LoaderCircle className="size-3.5 animate-spin" />
                          ) : (
                            <Eye className="size-3.5" />
                          )}
                          <span className="max-w-[180px] truncate">{asset.original_name}</span>
                          <span className="text-content-muted">
                            {formatFileSize(asset.file_size_bytes)}
                          </span>
                        </DesignButton>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-3 text-sm leading-7 text-content-muted">
                    {t("task.assetsEmpty")}
                  </p>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function TaskReviewActionGroup({
  busyAction,
  onApprove,
  onReject,
}: {
  busyAction?: AdminTaskReviewAction;
  onApprove: () => void;
  onReject: () => void;
}) {
  const t = useTranslations("ReviewsUI");

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
      <Button variant="success" size="compact" disabled={Boolean(busyAction)} onClick={onApprove}>
        {busyAction === "approve" ? (
          <LoaderCircle className="size-4 animate-spin" />
        ) : (
          <ClipboardList className="size-4" />
        )}
        {t("actions.approve")}
      </Button>
      <Button size="compact" disabled={Boolean(busyAction)} onClick={onReject} variant="danger">
        {busyAction === "reject" ? (
          <LoaderCircle className="size-4 animate-spin" />
        ) : (
          <XCircle className="size-4" />
        )}
        {t("actions.reject")}
      </Button>
    </div>
  );
}

function Badge({ children, tone }: { children: string; tone: "blue" | "gold" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
        tone === "blue" && "bg-surface-inset text-primary",
        tone === "gold" && "bg-status-warning-soft text-status-warning",
      )}
    >
      {children}
    </span>
  );
}

function InfoTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-surface-inset bg-surface-inset px-4 py-3">
      <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em] text-content-subtle uppercase">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-2 text-sm font-medium leading-7 text-content-strong">{value}</p>
    </div>
  );
}

function getDisplayName(name: string | null, email: string | null, fallbackLabel: string) {
  const normalizedName = normalizeOptionalString(name);

  if (normalizedName) {
    return normalizedName;
  }

  const normalizedEmail = normalizeOptionalString(email);

  if (normalizedEmail) {
    const [prefix] = normalizedEmail.split("@");
    const normalizedPrefix = normalizeOptionalString(prefix);

    if (normalizedPrefix) {
      return normalizedPrefix;
    }
  }

  return fallbackLabel;
}

function getDisplayEmail(email: string | null, fallbackLabel: string) {
  return normalizeOptionalString(email) ?? fallbackLabel;
}
