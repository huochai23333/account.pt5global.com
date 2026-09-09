"use client";

import { useTranslations } from "next-intl";

import { DashboardSectionPanel } from "@/components/dashboard/dashboard-section-panel";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import type { AdminEmailConnectionHealth } from "@/lib/emailconnect/emailconnect-types";

import { formatEmailReminderTime } from "./email-reminders-display";

function healthTone(health: string): StatusTone {
  if (health === "active") return "success";
  if (health === "reauthorization_required") return "danger";
  if (health === "paused") return "warning";
  return "neutral";
}

export function AdminEmailHealthSection({ connections }: { connections: AdminEmailConnectionHealth[] }) {
  const t = useTranslations("EmailReminders");
  return (
    <DashboardSectionPanel ariaLabel={t("adminHealthTitle")}>
      <h3 className="text-xl font-bold text-content-strong">{t("adminHealthTitle")}</h3>
      <p className="mt-1 text-sm leading-6 text-content-muted">{t("adminHealthDescription")}</p>
      <div className="mt-5 grid gap-3">
        {connections.length ? connections.map((connection, index) => (
          <article className="grid min-w-0 gap-3 rounded-surface-inset border border-border-subtle p-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.4fr)]" key={`${connection.externalUserId}-${connection.maskedEmail ?? index}`}>
            <div className="min-w-0">
              <p className="break-words font-semibold text-content-strong">{connection.displayName}</p>
              <p className="mt-1 break-all text-sm text-content-muted">{connection.maskedEmail ?? t("noGmail")}</p>
            </div>
            <div className="min-w-0">
              <StatusBadge tone={healthTone(connection.health)}>{t(`health.${connection.health}`)}</StatusBadge>
              <p className="mt-2 break-words text-xs leading-5 text-content-muted">
                {connection.watchExpiresAt ? t("watchExpires", { time: formatEmailReminderTime(connection.watchExpiresAt) }) : t("noWatch")}
              </p>
            </div>
            <div className="min-w-0 text-xs leading-5 text-content-muted">
              <p className="break-words">{connection.lastHealthyAt ? t("lastHealthy", { time: formatEmailReminderTime(connection.lastHealthyAt) }) : t("waitingForFirstMail")}</p>
              {connection.lastError ? <p className="mt-1 break-words text-status-danger">{connection.lastError}</p> : null}
            </div>
          </article>
        )) : (
          <p className="rounded-surface-inset border border-dashed border-border-subtle p-6 text-center text-sm text-content-muted">{t("noAdminConnections")}</p>
        )}
      </div>
    </DashboardSectionPanel>
  );
}
