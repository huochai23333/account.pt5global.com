"use client";

import { Mail, Plus, Unplug } from "lucide-react";
import { useTranslations } from "next-intl";

import { DashboardSectionPanel } from "@/components/dashboard/dashboard-section-panel";
import { Button } from "@/components/ui/button";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import type { EmailConnectionSummary } from "@/lib/emailconnect/emailconnect-types";

import { formatEmailReminderTime } from "./email-reminders-display";

const HEALTH_DISPLAY: Record<string, { key: "active" | "paused" | "reauthorize"; tone: StatusTone }> = {
  active: { key: "active", tone: "success" },
  paused: { key: "paused", tone: "warning" },
  needs_reauthorization: { key: "reauthorize", tone: "danger" },
};

export function EmailConnectionsSection({
  busyKey,
  onConnect,
  onDisconnect,
  summary,
}: {
  busyKey: string | null;
  onConnect: () => void;
  onDisconnect: (connectionId: string) => void;
  summary: EmailConnectionSummary | null;
}) {
  const t = useTranslations("EmailReminders");
  return (
    <DashboardSectionPanel ariaLabel={t("connectionsTitle")}>
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-xl font-bold text-content-strong">{t("connectionsTitle")}</h3>
          <p className="mt-1 text-sm leading-6 text-content-muted">{t("connectionsDescription")}</p>
        </div>
        <Button className="w-full sm:w-auto" disabled={busyKey !== null} onClick={onConnect} wrap>
          <Plus className="size-4" />
          {summary?.connections.length ? t("addGmail") : t("connectNow")}
        </Button>
      </div>

      <div className="mt-5 rounded-surface-inset border border-border-subtle bg-surface-inset p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-content-strong">{t("feishuIdentity")}</span>
          <StatusBadge tone={summary?.feishuBound ? "success" : "neutral"}>
            {summary?.feishuBound ? t("bound") : t("notBound")}
          </StatusBadge>
        </div>
        {summary?.feishuName ? <p className="mt-2 break-words text-sm text-content-muted">{summary.feishuName}</p> : null}
      </div>

      {summary?.connections.length ? (
        <div className="mt-4 grid gap-3">
          {summary.connections.map((connection) => {
            const display = HEALTH_DISPLAY[connection.health] ?? { key: "paused" as const, tone: "warning" as const };
            return (
              <article className="flex min-w-0 flex-col gap-4 rounded-surface-inset border border-border-subtle p-4 sm:flex-row sm:items-center sm:justify-between" key={connection.id}>
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <Mail className="size-4 shrink-0 text-content-muted" />
                    <span className="break-all font-semibold text-content-strong">{connection.maskedEmail}</span>
                    <StatusBadge tone={display.tone}>{t(display.key)}</StatusBadge>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-content-muted">
                    {connection.lastHealthyAt ? t("lastHealthy", { time: formatEmailReminderTime(connection.lastHealthyAt) }) : t("waitingForFirstMail")}
                  </p>
                </div>
                <Button className="w-full sm:w-auto" disabled={busyKey !== null} onClick={() => onDisconnect(connection.id)} variant="outline" wrap>
                  <Unplug className="size-4" />
                  {t("disconnect")}
                </Button>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 rounded-surface-inset border border-dashed border-border-subtle p-6 text-center text-sm leading-6 text-content-muted">
          {t("emptyConnections")}
        </div>
      )}
    </DashboardSectionPanel>
  );
}
