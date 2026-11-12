"use client";

import { getDashboardPaginationState } from "@/lib/dashboard-pagination";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { useDashboardConfirm } from "@/components/dashboard/dashboard-confirm-provider";

import type {
  AdminMailMetrics,
  MailAgentProfile,
  MailThreadDetail,
  MailThreadListItem,
  MailThreadQuery,
  MailWorkspaceSummary,
} from "@/lib/mail/mail-types";

import { requestMailJson as requestJson } from "./mail-workspace-request";
import { useMailAiActions } from "./use-mail-ai-actions";
import { useMailThreadOpening } from "./use-mail-thread-opening";
import { useMailThreadAccess } from "./use-mail-thread-access";
import { useMailThreadMutations } from "./use-mail-thread-mutations";
import { useMailDraftGuard } from "./use-mail-draft-guard";
import { useMailWorkspaceServices } from "./use-mail-workspace-services";
import { EMPTY_COMPOSER, useMailWorkspaceComposer } from "./use-mail-workspace-composer";

export type { ComposerState } from "./use-mail-workspace-composer";

export function useMailWorkspace(input: {
  initialSummary: MailWorkspaceSummary | null;
  initialThreads: MailThreadListItem[];
  initialTotalCount: number;
  initialAgents: MailAgentProfile[];
  initialOwnProfile: MailAgentProfile | null;
  initialMetrics: AdminMailMetrics | null;
  initialError: string | null;
  isAdmin: boolean;
  viewerId: string;
  watchOpenThread: boolean;
}) {
  const confirm = useDashboardConfirm();
  const draftGuard = useMailDraftGuard();
  const t = useTranslations("MailWorkspace");
  const [summary, setSummary] = useState(input.initialSummary);
  const [threads, setThreads] = useState(input.initialThreads);
  const [totalCount, setTotalCount] = useState(input.initialTotalCount);
  const threadRequestVersion = useRef(0);
  const [agents, setAgents] = useState(input.initialAgents);
  const [ownProfile, setOwnProfile] = useState(input.initialOwnProfile);
  const [metrics, setMetrics] = useState(input.initialMetrics);
  const [selected, setSelected] = useState<MailThreadDetail | null>(null);
  const [filters, setFilters] = useState<MailThreadQuery>({
    scope: input.isAdmin ? "all" : "mine",
    page: 1,
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(input.initialError);
  const [aiDraft, setAiDraft] = useState("");
  const [report, setReport] = useState("");
  const opening = useMailThreadOpening({ draftGuard, setSelected, setThreads, setBusy, setFeedback });
  const { startViewChange, isCurrentView, cancelRemoved, getViewThreadId, getViewVersion } = opening;
  const showUnavailable = useCallback(() => setFeedback(t("threadUnavailable")), [t]);
  const removeThreads = useCallback((threadIds: string[]) => {
    cancelRemoved(threadIds);
    setThreads((current) => current.filter((item) => !threadIds.includes(item.id)));
    setSelected((current) => (current && threadIds.includes(current.id) ? null : current));
  }, [cancelRemoved]);

  const refreshSummary = useCallback(async () => {
    const [nextSummary, nextMetrics] = await Promise.all([
      requestJson<MailWorkspaceSummary>("/api/mail/workspace"),
      input.isAdmin ? requestJson<AdminMailMetrics>("/api/mail/metrics") : Promise.resolve(null),
    ]);
    setSummary(nextSummary);
    setMetrics(nextMetrics);
  }, [input.isAdmin]);

  const loadThreads = useCallback(
    async (nextFilters: MailThreadQuery = filters, options?: { skipDraftGuard?: boolean }) => {
      // 发送成功后程序会自动刷新列表，此时草稿已经提交，不能弹出“丢弃草稿”的确认框。
      if (!options?.skipDraftGuard && !(await draftGuard.canDiscard())) return;
      const requestVersion = ++threadRequestVersion.current;
      const selectionVersion = startViewChange();
      setBusy("threads");
      setFeedback(null);
      try {
        let result = await requestJson<{ threads: MailThreadListItem[]; totalCount: number }>(
          "/api/mail/threads",
          {
            method: "POST",
            body: JSON.stringify(nextFilters),
          },
        );
        // 删除或隔离导致末页越界时，再读取最后一个有效页。
        const validPage = getDashboardPaginationState(
          result.totalCount,
          nextFilters.page ?? 1,
        ).page;
        if (validPage !== (nextFilters.page ?? 1)) {
          nextFilters = { ...nextFilters, page: validPage };
          result = await requestJson<{ threads: MailThreadListItem[]; totalCount: number }>(
            "/api/mail/threads",
            {
              method: "POST",
              body: JSON.stringify(nextFilters),
            },
          );
        }
        if (requestVersion !== threadRequestVersion.current) return;
        // 过滤请求等待时也可打开一封邮件，列表完成后保留这次更新的选择。
        if (isCurrentView(selectionVersion)) {
          draftGuard.setDirty(false);
          setSelected(null);
        }
        setFilters(nextFilters);
        setThreads(result.threads);
        setTotalCount(result.totalCount);
        await refreshSummary();
      } catch (error) {
        if (requestVersion === threadRequestVersion.current)
          setFeedback(error instanceof Error ? error.message : "邮件列表暂时无法读取。");
      } finally {
        if (requestVersion === threadRequestVersion.current) {
          setBusy((current) => current === "threads" ? null : current);
        }
      }
    },
    [draftGuard, filters, isCurrentView, refreshSummary, startViewChange],
  );

  const { composer, pendingSend, send, setComposer, startNew, updateComposer, uploadFiles, getDraftEditVersion, clearReply } =
    useMailWorkspaceComposer({
      viewerId: input.viewerId,
      selected,
      setSelected,
      filters,
      loadThreads,
      onStartNew: startViewChange,
      restoreThread: opening.restoreThread,
      getViewVersion,
      onUnavailable: showUnavailable,
      draftGuard,
      setBusy,
      setFeedback,
      setAiDraft,
    });

  async function openThread(threadId: string) {
    const result = await opening.openThread(threadId, (detail) => {
      setAiDraft("");
      setComposer({
        ...EMPTY_COMPOSER,
        mode: "reply",
        to: detail.customerEmail,
        subject: detail.subject,
      });
    });
    if (result === "unavailable") {
      removeThreads([threadId]);
      showUnavailable();
    }
  }

  const removeUnavailable = useCallback((threadId: string) => {
    if (getViewThreadId() === threadId) {
      clearReply();
      showUnavailable();
    }
    removeThreads([threadId]);
  }, [clearReply, getViewThreadId, removeThreads, showUnavailable]);

  useMailThreadAccess({
    threadId: input.watchOpenThread ? selected?.id ?? null : null,
    getViewThreadId,
    getViewVersion,
    onUnavailable: removeUnavailable,
  });
  const { updateState, assign } = useMailThreadMutations({
    selected, agents, setSelected, setThreads, setBusy, setFeedback,
    onAssigned: (threadId, memberId) => {
      // 业务员自己转交时，版本回执已证明归属改变，不必等下一次权限检查。
      if (!input.isAdmin && memberId !== input.viewerId) removeUnavailable(threadId);
    },
  });

  const { generateReply, generateReport } = useMailAiActions({
    threadId: selected?.id ?? null,
    getViewVersion: opening.getViewVersion,
    getViewThreadId: opening.getViewThreadId,
    getDraftEditVersion,
    applyReply: (body) => {
      setComposer((current) => ({ ...current, body }));
      draftGuard.setDirty(true);
    },
    setAiDraft, setReport, setBusy, setFeedback,
  });
  const { connectFeishu, connectMailbox, saveAgent } = useMailWorkspaceServices({
    isAdmin: input.isAdmin,
    setAgents, setOwnProfile, setBusy, setFeedback, refreshSummary,
  });
  const deleteSelected = useCallback(async () => {
    if (
      !selected ||
      !(await confirm({
        description: t("deleteConfirmDescription"),
        title: t("deleteConfirmTitle"),
        tone: "danger",
      }))
    )
      return;
    setBusy("delete");
    setFeedback(null);
    try {
      const receipt = await requestJson<{ deleted: boolean; gmailCopyPreserved: boolean }>(
        `/api/mail/threads/${selected.id}`,
        { method: "DELETE" },
      );
      if (!receipt.deleted || !receipt.gmailCopyPreserved)
        throw new Error("删除结果没有确认完整。");
      setFeedback("系统副本已删除，Gmail 原件仍然保留。");
      setSelected(null);
      setThreads((current) => current.filter((item) => item.id !== selected.id));
      draftGuard.setDirty(false);
      // 当前页删除后重新补满二十条；若末页被删空，列表读取会自动退回有效页。
      await loadThreads(filters, { skipDraftGuard: true });
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "邮件副本没有删除完成。");
    } finally {
      setBusy(null);
    }
  }, [confirm, draftGuard, filters, loadThreads, selected, t]);
  // 发件设置包含管理员，但客户会话仍只允许转交给启用的业务员。
  const enabledAgents = useMemo(
    () => agents.filter((agent) => agent.enabled && agent.role === "salesman"),
    [agents],
  );
  return {
    summary,
    threads,
    pagination: getDashboardPaginationState(totalCount, filters.page ?? 1),
    agents,
    ownProfile,
    enabledAgents,
    metrics,
    selected,
    filters,
    composer,
    busy,
    feedback,
    aiDraft,
    report,
    pendingSend,
    setComposer: updateComposer,
    setAgents,
    setOwnProfile,
    setMetrics,
    loadThreads,
    openThread,
    updateState,
    assign,
    uploadFiles,
    send,
    generateReply,
    generateReport,
    saveAgent,
    connectMailbox,
    connectFeishu,
    startNew,
    deleteSelected,
    refreshSummary,
    removeThreads,
  };
}
