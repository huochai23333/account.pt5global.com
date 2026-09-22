"use client";

import { Bot, Cable, LoaderCircle, Settings2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Field } from "@/components/ui/form-controls";
import { Surface } from "@/components/ui/surface";
import type { AdminMailMetrics, MailAgentProfile, MailWorkspaceSummary } from "@/lib/mail/mail-types";

import { MailAgentProfileCard } from "./mail-agent-profile-card";

function today(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

export function MailAdminPanel(props: {
  summary: MailWorkspaceSummary | null;
  agents: MailAgentProfile[];
  metrics: AdminMailMetrics | null;
  busy: string | null;
  report: string;
  onAgents: (agents: MailAgentProfile[]) => void;
  onSaveAgent: (agent: MailAgentProfile, resetToGenerated?: boolean) => void;
  onConnect: () => void;
  onReport: (start: string, end: string) => void;
}) {
  const t = useTranslations("MailWorkspace");
  const [start, setStart] = useState(today(-30));
  const [end, setEnd] = useState(today());
  const metricItems = useMemo(() => props.metrics ? [
    [t("syncQueue"), props.metrics.synchronizationQueue], [t("sending"), props.metrics.outboundQueue],
    [t("sendFailed"), props.metrics.outboundFailures], [t("notificationQueue"), props.metrics.notificationQueue],
    [t("unassigned"), props.metrics.unassigned], [t("waitingPt5"), props.metrics.waitingPt5],
    [t("quarantine"), props.metrics.quarantined],
  ] as const : [], [props.metrics, t]);
  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-2" data-testid="mail-admin-panel">
      <Surface>
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="flex items-center gap-2 text-xl font-bold text-content-strong"><Cable className="size-5" />{t("companyMailbox")}</h2><p className="mt-1 break-words text-sm text-content-muted">{props.summary?.mailbox.maskedEmail ?? t("notConnected")} · {props.summary?.mailbox.health === "active" ? t("healthy") : t("needsAttention")}</p></div><Button disabled={props.busy !== null} onClick={props.onConnect} type="button" variant="outline">{t("connectShared")}</Button></div>
        {props.summary?.mailbox.lastError ? <p className="mt-3 break-words text-sm text-status-danger">{props.summary.mailbox.lastError}</p> : null}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">{metricItems.map(([label, value]) => <div className="rounded-surface-inset border border-border-subtle bg-surface-inset p-3" key={label}><p className="text-xs text-content-muted">{label}</p><p className="mt-1 text-2xl font-bold text-content-strong">{value}</p></div>)}</div>
        <p className="mt-4 text-sm text-content-muted">{t("averageFirstReply")}{props.metrics?.averageFirstReplyMinutes == null ? t("noData") : t("minutes", { count: Math.round(props.metrics.averageFirstReplyMinutes) })}</p>
      </Surface>
      <Surface>
        <h2 className="flex items-center gap-2 text-xl font-bold text-content-strong"><Bot className="size-5" />{t("reportTitle")}</h2>
        <p className="mt-1 text-sm leading-6 text-content-muted">{t("reportDescription")}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label={t("startDate")}><DatePicker onValueChange={setStart} value={start} /></Field><Field label={t("endDate")}><DatePicker onValueChange={setEnd} value={end} /></Field></div>
        <Button className="mt-4 w-full sm:w-auto" disabled={props.busy !== null} onClick={() => props.onReport(start, end)} type="button">{props.busy === "ai-report" ? <LoaderCircle className="size-4 animate-spin" /> : <Bot className="size-4" />}{t("generateReport")}</Button>
        {props.report ? <div className="mt-4 whitespace-pre-wrap break-words rounded-surface-inset border border-border-subtle bg-surface-inset p-4 text-sm leading-7 text-content-strong">{props.report}</div> : null}
      </Surface>
      <Surface className="xl:col-span-2">
        <h2 className="flex items-center gap-2 text-xl font-bold text-content-strong"><Settings2 className="size-5" />{t("agentSettings")}</h2>
        <p className="mt-1 text-sm leading-6 text-content-muted">{t("agentSettingsDescription")}</p>
        <div className="mt-5 grid min-w-0 gap-4 lg:grid-cols-2">{props.agents.length === 0 ? <p className="text-sm text-content-muted">{t("emptyAgents")}</p> : props.agents.map((agent, index) => (
          <MailAgentProfileCard
            busy={props.busy !== null}
            canToggle
            key={agent.memberId}
            onChange={(next) => props.onAgents(props.agents.map((item, itemIndex) => itemIndex === index ? next : item))}
            onSave={(reset) => props.onSaveAgent(agent, reset)}
            profile={agent}
          />
        ))}</div>
      </Surface>
    </div>
  );
}
