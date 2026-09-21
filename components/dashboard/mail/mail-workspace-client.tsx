"use client";

import { ArrowLeft, Mail } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { DashboardPageShell } from "@/components/dashboard/dashboard-page-shell";
import { DashboardSectionHeader } from "@/components/dashboard/dashboard-section-header";
import { buttonVariants } from "@/components/ui/button-variants";
import { Button } from "@/components/ui/button";
import type { AdminMailMetrics, MailAgentProfile, MailThreadListItem, MailWorkspaceSummary } from "@/lib/mail/mail-types";
import { cn } from "@/lib/utils";

import { MailAdminPanel } from "./mail-admin-panel";
import { MailThreadDetailPanel } from "./mail-thread-detail";
import { MailThreadList } from "./mail-thread-list";
import { useMailWorkspace } from "./use-mail-workspace";

export function MailWorkspaceClient(props: {
  backHref: string;
  initialSummary: MailWorkspaceSummary | null;
  initialThreads: MailThreadListItem[];
  initialAgents: MailAgentProfile[];
  initialMetrics: AdminMailMetrics | null;
  initialError: string | null;
  isAdmin: boolean;
}) {
  const t = useTranslations("MailWorkspace");
  const state = useMailWorkspace(props);
  return (
    <DashboardPageShell
      feedback={state.feedback ? { message: state.feedback, tone: /已|正常|完成/.test(state.feedback) ? "success" : "info" } : null}
      header={<DashboardSectionHeader
        actions={<><Link className={cn(buttonVariants({ variant: "outline", wrap: true }), "w-full sm:w-auto")} href={props.backHref}><ArrowLeft className="size-4" />{t("backToMy")}</Link>{state.summary && !state.summary.feishuBound ? <Button disabled={state.busy !== null} onClick={() => void state.connectFeishu()} type="button">{t("bindFeishu")}</Button> : null}</>}
        badge={t("sharedMailbox")}
        badgeIcon={<Mail className="size-4" />}
        description={t("workspaceDescription")}
        presentation="overview"
        title={t("title")}
      />}
    >
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(19rem,0.8fr)_minmax(0,1.6fr)]">
        <MailThreadList busy={state.busy === "threads"} filters={state.filters} isAdmin={props.isAdmin} onFilter={(filters) => void state.loadThreads(filters)} onNew={state.startNew} onOpen={(id) => void state.openThread(id)} selectedId={state.selected?.id ?? null} summary={state.summary} threads={state.threads} />
        <MailThreadDetailPanel agents={state.enabledAgents} aiDraft={state.aiDraft} busy={state.busy} canDelete={props.isAdmin} canSend={Boolean(state.summary?.senderProfileReady)} composer={state.composer} detail={state.selected} onAssign={(id) => void state.assign(id)} onComposer={state.setComposer} onDelete={() => void state.deleteSelected()} onFiles={(files) => void state.uploadFiles(files)} onSend={() => void state.send()} onState={(value) => void state.updateState(value)} onSuggest={() => void state.generateReply()} />
      </div>
      {props.isAdmin ? <MailAdminPanel agents={state.agents} busy={state.busy} metrics={state.metrics} onAgents={state.setAgents} onConnect={() => void state.connectMailbox()} onReport={(start, end) => void state.generateReport(start, end)} onSaveAgent={(agent) => void state.saveAgent(agent)} report={state.report} summary={state.summary} /> : null}
    </DashboardPageShell>
  );
}
