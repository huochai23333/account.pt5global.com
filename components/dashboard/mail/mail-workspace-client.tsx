"use client";

import { ArrowLeft, Mail } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { DashboardPageShell } from "@/components/dashboard/dashboard-page-shell";
import { DashboardSectionHeader } from "@/components/dashboard/dashboard-section-header";
import { buttonVariants } from "@/components/ui/button-variants";
import { Button } from "@/components/ui/button";
import type { AdminMailMetrics, MailAgentProfile, MailIntakeRule, MailQuarantineItem, MailThreadListItem, MailWorkspaceSummary } from "@/lib/mail/mail-types";
import { cn } from "@/lib/utils";

import { MailAdminPanel } from "./mail-admin-panel";
import { MailIntakeRulesPanel } from "./mail-intake-rules-panel";
import { MailOwnSettingsPanel } from "./mail-own-settings-panel";
import { MailQuarantinePanel } from "./mail-quarantine-panel";
import { MailThreadDetailPanel } from "./mail-thread-detail";
import { MailThreadList } from "./mail-thread-list";
import { MailWorkspaceTabs, type MailWorkspaceView } from "./mail-workspace-tabs";
import { useMailIntake } from "./use-mail-intake";
import { useMailWorkspace } from "./use-mail-workspace";

export function MailWorkspaceClient(props: {
  backHref: string;
  initialSummary: MailWorkspaceSummary | null;
  initialThreads: MailThreadListItem[];
  initialAgents: MailAgentProfile[];
  initialOwnProfile: MailAgentProfile | null;
  initialQuarantine: MailQuarantineItem[];
  initialRules: MailIntakeRule[];
  initialMetrics: AdminMailMetrics | null;
  initialError: string | null;
  isAdmin: boolean;
}) {
  const t = useTranslations("MailWorkspace");
  const state = useMailWorkspace(props);
  const [view, setView] = useState<MailWorkspaceView>("inbox");
  const [bulkRuleOption, setBulkRuleOption] = useState<"none" | "sender" | "domain">("none");
  const intake = useMailIntake({
    isAdmin: props.isAdmin,
    initialQuarantine: props.initialQuarantine,
    initialRules: props.initialRules,
    onThreadsRemoved: state.removeThreads,
    onSummaryRefresh: () => state.loadThreads(state.filters),
  });
  const feedback = intake.feedback ?? state.feedback;
  const busy = intake.busy ?? state.busy;
  const startNewMessage = () => {
    state.startNew();
    /*
      窄屏会把邮件列表和编辑器上下排列。状态更新完成后的下一帧再滚动，
      可以保证目标面板已经渲染；减少动态效果的用户则使用即时滚动。
    */
    window.requestAnimationFrame(() => {
      const panel = document.querySelector<HTMLElement>('[data-testid="mail-new-message-panel"]');
      if (!panel) return;
      const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
      panel.scrollIntoView({ behavior, block: "start" });
    });
  };
  return (
    <DashboardPageShell
      feedback={feedback ? { message: feedback, tone: /已|正常|完成/.test(feedback) && !/没有|未全部/.test(feedback) ? "success" : "info" } : null}
      header={<DashboardSectionHeader
        actions={<><Link className={cn(buttonVariants({ variant: "outline", wrap: true }), "w-full sm:w-auto")} href={props.backHref}><ArrowLeft className="size-4" />{t("backToMy")}</Link>{state.summary && !state.summary.feishuBound ? <Button disabled={state.busy !== null} onClick={() => void state.connectFeishu()} type="button">{t("bindFeishu")}</Button> : null}</>}
        badge={t("sharedMailbox")}
        badgeIcon={<Mail className="size-4" />}
        description={t("workspaceDescription")}
        presentation="overview"
        title={t("title")}
      />}
    >
      <MailWorkspaceTabs isAdmin={props.isAdmin} onChange={setView} quarantineCount={state.summary?.counts.quarantined ?? 0} value={view} />
      {view === "inbox" ? <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(19rem,0.8fr)_minmax(0,1.6fr)]">
        <MailThreadList
          bulkRuleOption={bulkRuleOption}
          busy={state.busy === "threads"}
          filters={state.filters}
          isAdmin={props.isAdmin}
          onBulkQuarantine={() => {
            const threads = state.threads.filter((thread) => intake.selectedActiveIds.includes(thread.id)).map((thread) => ({ threadId: thread.id, expectedVersion: thread.version }));
            void intake.quarantineThreads(threads, { createRule: bulkRuleOption });
          }}
          onBulkRuleOption={setBulkRuleOption}
          onFilter={(filters) => void state.loadThreads(filters)}
          onNew={startNewMessage}
          onOpen={(id) => void state.openThread(id)}
          onToggleSelected={intake.toggleActiveSelection}
          selectedId={state.selected?.id ?? null}
          selectedIds={intake.selectedActiveIds}
          summary={state.summary}
          threads={state.threads}
        />
        <MailThreadDetailPanel agents={state.enabledAgents} aiDraft={state.aiDraft} busy={busy} canDelete={props.isAdmin} canSend={Boolean(state.summary?.senderProfileReady)} composer={state.composer} detail={state.selected} onAssign={(id) => void state.assign(id)} onComposer={state.setComposer} onDelete={() => void state.deleteSelected()} onFiles={(files) => void state.uploadFiles(files)} onQuarantine={() => state.selected ? void intake.quarantineThreads([{ threadId: state.selected.id, expectedVersion: state.selected.version }]) : undefined} onSend={() => void state.send()} onState={(value) => void state.updateState(value)} onSuggest={() => void state.generateReply()} />
      </div> : null}
      {view === "quarantine" && props.isAdmin ? <MailQuarantinePanel busy={intake.busy} detail={intake.selectedQuarantine} items={intake.quarantine} onDelete={(item) => void intake.deleteQuarantine(item)} onOpen={(id) => void intake.openQuarantine(id)} onRefresh={() => void intake.reloadQuarantine()} onRestore={(item) => void intake.restore(item)} /> : null}
      {view === "rules" && props.isAdmin ? <MailIntakeRulesPanel busy={intake.busy} onCreate={(rule) => void intake.createRule(rule)} onDelete={(rule) => void intake.deleteRule(rule)} onRules={intake.setRules} onSave={(rule) => void intake.updateRule(rule)} rules={intake.rules} /> : null}
      {view === "settings" && props.isAdmin ? <MailAdminPanel agents={state.agents} busy={state.busy} metrics={state.metrics} onAgents={state.setAgents} onConnect={() => void state.connectMailbox()} onReport={(start, end) => void state.generateReport(start, end)} onSaveAgent={(agent, reset) => void state.saveAgent(agent, reset)} report={state.report} summary={state.summary} /> : null}
      {view === "settings" && !props.isAdmin ? <MailOwnSettingsPanel busy={state.busy !== null} onChange={state.setOwnProfile} onSave={(reset) => state.ownProfile ? void state.saveAgent(state.ownProfile, reset) : undefined} profile={state.ownProfile} /> : null}
    </DashboardPageShell>
  );
}
