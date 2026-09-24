"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { useDashboardConfirm } from "@/components/dashboard/dashboard-confirm-provider";

import type {
  AdminMailMetrics,
  MailAgentProfile,
  MailThreadDetail,
  MailThreadListItem,
  MailThreadQuery,
  MailThreadState,
  MailWorkspaceSummary,
} from "@/lib/mail/mail-types";

import { requestMailJson as requestJson } from "./mail-workspace-request";
import { useMailDraftGuard } from "./use-mail-draft-guard";
import { useMailWorkspaceServices } from "./use-mail-workspace-services";
import { EMPTY_COMPOSER, useMailWorkspaceComposer } from "./use-mail-workspace-composer";

export type { ComposerState } from "./use-mail-workspace-composer";

export function useMailWorkspace(input: {
  initialSummary: MailWorkspaceSummary | null;
  initialThreads: MailThreadListItem[];
  initialNextCursor: string | null;
  initialAgents: MailAgentProfile[];
  initialOwnProfile: MailAgentProfile | null;
  initialMetrics: AdminMailMetrics | null;
  initialError: string | null;
  isAdmin: boolean;
  viewerId: string;
}) {
  const confirm = useDashboardConfirm();
  const draftGuard = useMailDraftGuard();
  const t = useTranslations("MailWorkspace");
  const [summary, setSummary] = useState(input.initialSummary);
  const [threads, setThreads] = useState(input.initialThreads);
  const [nextCursor, setNextCursor] = useState(input.initialNextCursor);
  const threadRequestVersion = useRef(0);
  const threadCursorRef = useRef(input.initialNextCursor);
  const [agents, setAgents] = useState(input.initialAgents);
  const [ownProfile, setOwnProfile] = useState(input.initialOwnProfile);
  const [metrics, setMetrics] = useState(input.initialMetrics);
  const [selected, setSelected] = useState<MailThreadDetail | null>(null);
  const [filters, setFilters] = useState<MailThreadQuery>({ scope: input.isAdmin ? "all" : "mine", limit: 40 });
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(input.initialError);
  const [aiDraft, setAiDraft] = useState("");
  const [report, setReport] = useState("");

  const refreshSummary = useCallback(async () => {
    const [nextSummary, nextMetrics] = await Promise.all([
      requestJson<MailWorkspaceSummary>("/api/mail/workspace"),
      input.isAdmin ? requestJson<AdminMailMetrics>("/api/mail/metrics") : Promise.resolve(null),
    ]);
    setSummary(nextSummary);
    setMetrics(nextMetrics);
  }, [input.isAdmin]);

  const loadThreads = useCallback(async (
    nextFilters: MailThreadQuery = filters,
    options?: { skipDraftGuard?: boolean },
  ) => {
    // 发送成功后程序会自动刷新列表，此时草稿已经提交，不能弹出“丢弃草稿”的确认框。
    if (!options?.skipDraftGuard && !await draftGuard.canDiscard()) return;
    const requestVersion = ++threadRequestVersion.current;
    setBusy("threads"); setFeedback(null);
    try {
      const result = await requestJson<{ threads: MailThreadListItem[]; nextCursor: string | null }>("/api/mail/threads", {
        method: "POST", body: JSON.stringify({ ...nextFilters, cursor: undefined }),
      });
      if (requestVersion !== threadRequestVersion.current) return;
      draftGuard.setDirty(false);
      setFilters(nextFilters); setThreads(result.threads); setSelected(null);
      threadCursorRef.current = result.nextCursor;
      setNextCursor(result.nextCursor);
      await refreshSummary();
    } catch (error) { if (requestVersion === threadRequestVersion.current) setFeedback(error instanceof Error ? error.message : "邮件列表暂时无法读取。"); }
    finally { if (requestVersion === threadRequestVersion.current) setBusy(null); }
  }, [draftGuard, filters, refreshSummary]);

  const loadMoreThreads = useCallback(async () => {
    const cursor = threadCursorRef.current;
    if (!cursor || busy) return;
    const requestVersion = threadRequestVersion.current;
    setBusy("threads-more"); setFeedback(null);
    try {
      const result = await requestJson<{ threads: MailThreadListItem[]; nextCursor: string | null }>("/api/mail/threads", {
        method: "POST", body: JSON.stringify({ ...filters, cursor }),
      });
      // 筛选改变或另一页已提交时，旧响应不能混入当前列表。
      if (requestVersion !== threadRequestVersion.current || cursor !== threadCursorRef.current) return;
      setThreads((current) => {
        const known = new Set(current.map((item) => item.id));
        return [...current, ...result.threads.filter((item) => !known.has(item.id))];
      });
      threadCursorRef.current = result.nextCursor;
      setNextCursor(result.nextCursor);
    } catch (error) { if (requestVersion === threadRequestVersion.current) setFeedback(error instanceof Error ? error.message : "更多邮件暂时无法读取。"); }
    finally { if (requestVersion === threadRequestVersion.current) setBusy(null); }
  }, [busy, filters]);

  const { composer, pendingSend, send, setComposer, startNew, updateComposer, uploadFiles } = useMailWorkspaceComposer({
    viewerId: input.viewerId,
    selected,
    setSelected,
    filters,
    loadThreads,
    draftGuard,
    setBusy,
    setFeedback,
    setAiDraft,
  });

  const openThread = useCallback(async (threadId: string) => {
    if (!await draftGuard.canDiscard()) return;
    setBusy(`thread:${threadId}`); setFeedback(null);
    try {
      const detail = await requestJson<MailThreadDetail>(`/api/mail/threads/${threadId}`);
      draftGuard.setDirty(false);
      setSelected(detail);
      setComposer({ ...EMPTY_COMPOSER, mode: "reply", to: detail.customerEmail, subject: detail.subject });
      const lastMessage = detail.messages.at(-1);
      if (lastMessage && detail.unread) {
        await requestJson(`/api/mail/threads/${threadId}/read`, { method: "POST", body: JSON.stringify({ messageId: lastMessage.id }) });
        setThreads((current) => current.map((item) => item.id === threadId ? { ...item, unread: false } : item));
      }
    } catch (error) { setFeedback(error instanceof Error ? error.message : "邮件详情暂时无法读取。"); }
    finally { setBusy(null); }
  }, [draftGuard, setComposer]);

  const updateState = useCallback(async (state: MailThreadState) => {
    if (!selected) return;
    setBusy("state"); setFeedback(null);
    try {
      const receipt = await requestJson<{ version: number }>(`/api/mail/threads/${selected.id}/state`, {
        method: "POST", body: JSON.stringify({ state, expectedVersion: selected.version }),
      });
      setSelected({ ...selected, state, version: receipt.version });
      setThreads((current) => current.map((item) => item.id === selected.id ? { ...item, state, version: receipt.version } : item));
      setFeedback("会话状态已保存。");
    } catch (error) { setFeedback(error instanceof Error ? error.message : "会话状态没有保存。"); }
    finally { setBusy(null); }
  }, [selected]);

  const assign = useCallback(async (assignedMemberId: string) => {
    if (!selected) return;
    setBusy("assign"); setFeedback(null);
    try {
      const receipt = await requestJson<{ version: number }>(`/api/mail/threads/${selected.id}/assign`, {
        method: "POST", body: JSON.stringify({ assignedMemberId, expectedVersion: selected.version }),
      });
      const agent = agents.find((item) => item.memberId === assignedMemberId);
      setSelected({ ...selected, assignedMemberId, assignedDisplayName: agent?.displayName ?? null, version: receipt.version });
      setThreads((current) => current.map((item) => item.id === selected.id
        ? { ...item, assignedMemberId, assignedDisplayName: agent?.displayName ?? null, version: receipt.version }
        : item));
      setFeedback("会话已转交。");
    } catch (error) { setFeedback(error instanceof Error ? error.message : "会话没有转交。"); }
    finally { setBusy(null); }
  }, [agents, selected]);

  const { connectFeishu, connectMailbox, generateReply, generateReport, saveAgent } = useMailWorkspaceServices({
    isAdmin: input.isAdmin,
    selected,
    setAgents,
    setOwnProfile,
    setComposer,
    setBusy,
    setFeedback,
    setAiDraft,
    setReport,
    markDraftDirty: () => draftGuard.setDirty(true),
    refreshSummary,
  });
  const deleteSelected = useCallback(async () => {
    if (!selected || !await confirm({
      description: t("deleteConfirmDescription"),
      title: t("deleteConfirmTitle"),
      tone: "danger",
    })) return;
    setBusy("delete"); setFeedback(null);
    try {
      const receipt = await requestJson<{ deleted: boolean; gmailCopyPreserved: boolean }>(`/api/mail/threads/${selected.id}`, { method: "DELETE" });
      if (!receipt.deleted || !receipt.gmailCopyPreserved) throw new Error("删除结果没有确认完整。");
      setFeedback("系统副本已删除，Gmail 原件仍然保留。");
      setSelected(null); setThreads((current) => current.filter((item) => item.id !== selected.id));
      draftGuard.setDirty(false);
      await refreshSummary();
    } catch (error) { setFeedback(error instanceof Error ? error.message : "邮件副本没有删除完成。"); }
    finally { setBusy(null); }
  }, [confirm, draftGuard, refreshSummary, selected, t]);
  // 发件设置包含管理员，但客户会话仍只允许转交给启用的业务员。
  const enabledAgents = useMemo(() => agents.filter((agent) => agent.enabled && agent.role === "salesman"), [agents]);
  const removeThreads = useCallback((threadIds: string[]) => {
    setThreads((current) => current.filter((item) => !threadIds.includes(item.id)));
    setSelected((current) => current && threadIds.includes(current.id) ? null : current);
  }, []);

  return {
    summary, threads, nextCursor, agents, ownProfile, enabledAgents, metrics, selected, filters, composer, busy, feedback, aiDraft, report, pendingSend,
    setComposer: updateComposer, setAgents, setOwnProfile, loadThreads, loadMoreThreads, openThread, updateState, assign, uploadFiles, send, generateReply,
    generateReport, saveAgent, connectMailbox, connectFeishu, startNew, deleteSelected, refreshSummary, removeThreads,
  };
}
