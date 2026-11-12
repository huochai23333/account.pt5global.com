"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { useDashboardConfirm } from "@/components/dashboard/dashboard-confirm-provider";
import type {
  MailIntakeRule,
  MailQuarantineItem,
  MailQuarantineReceipt,
  MailThreadDetail,
} from "@/lib/mail/mail-types";

import { useDashboardQueryPage } from "@/lib/use-dashboard-query-page";
import { matchesQuarantineUpdates } from "@/lib/mail/mail-quarantine-receipt";

import { requestMailJson } from "./mail-client-request";
import { useMailIntakeRules } from "./use-mail-intake-rules";

export function useMailIntake(input: {
  isAdmin: boolean;
  selectionScope: string;
  initialQuarantine: MailQuarantineItem[];
  initialRules: MailIntakeRule[];
  onThreadsRemoved: (threadIds: string[]) => void;
  onSummaryRefresh: () => Promise<void>;
}) {
  const confirm = useDashboardConfirm();
  const t = useTranslations("MailWorkspace");
  const quarantineInFlight = useRef(false);
  const quarantineQuery = useDashboardQueryPage({
    initialData: { items: input.initialQuarantine, totalCount: input.initialQuarantine.length },
    queryKey: "quarantine",
    queryPage: (page) =>
      requestMailJson<{ items: MailQuarantineItem[]; totalCount: number }>(
        `/api/mail/quarantine?page=${page}`,
      ),
    totalItems: (data) => data.totalCount,
    errorMessage: "隔离邮件暂时无法读取，请稍后重试。",
  });
  const quarantine = quarantineQuery.data?.items ?? [];
  const setQuarantineData = quarantineQuery.setData;
  // 次要面板首批读取和翻页复用同一份分页结果，不能丢掉完整数量。
  const acceptQuarantinePage = useCallback(
    (page: { items: MailQuarantineItem[]; totalCount: number }) => setQuarantineData(page),
    [setQuarantineData],
  );
  const setQuarantine = useCallback(
    (update: (rows: MailQuarantineItem[]) => MailQuarantineItem[]) => {
      setQuarantineData((current) =>
        current ? { ...current, items: update(current.items) } : current,
      );
    },
    [setQuarantineData],
  );
  const [selectedQuarantine, setSelectedQuarantine] = useState<MailThreadDetail | null>(null);
  const [selectedActiveIds, setSelectedActiveIds] = useState<string[]>([]);
  const [selectionScope, setSelectionScope] = useState(input.selectionScope);
  // 新页首次渲染前清除旧页勾选；首次打开页面不能在延迟 effect 中清掉用户刚勾选的邮件。
  if (selectionScope !== input.selectionScope) {
    setSelectionScope(input.selectionScope);
    setSelectedActiveIds([]);
  }
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const { rules, setRules, reloadRules, createRule, updateRule, deleteRule } = useMailIntakeRules(input.initialRules, setBusy, setFeedback);

  const reloadQuarantine = quarantineQuery.refresh;

  const refreshQuarantine = useCallback(async () => {
    // 手动刷新需要独立的等待状态；内部写操作后的重新读取仍沿用原操作的状态。
    setBusy("quarantine:refresh");
    setFeedback(null);
    try {
      await reloadQuarantine();
    } catch {
      setFeedback("隔离邮件暂时无法刷新。");
    } finally {
      setBusy(null);
    }
  }, [reloadQuarantine]);

  const toggleActiveSelection = useCallback((threadId: string) => {
    setSelectedActiveIds((current) =>
      current.includes(threadId) ? current.filter((id) => id !== threadId) : [...current, threadId],
    );
  }, []);

  const quarantineThreads = useCallback(
    async (
      threads: Array<{ threadId: string; expectedVersion: number }>,
      options?: {
        reason?: string;
        createRule?: "none" | "sender" | "domain";
      },
    ) => {
      // 状态更新前的连击也要被拦住，避免同一批会话产生两个并行请求。
      if (quarantineInFlight.current) return;
      quarantineInFlight.current = true;
      setBusy("quarantine");
      setFeedback(null);
      try {
        const receipt = await requestMailJson<MailQuarantineReceipt>("/api/mail/quarantine", {
          method: "POST",
          body: JSON.stringify({
            threads,
            reason: options?.reason ?? "手动移入隔离区",
            createRule: options?.createRule ?? "none",
          }),
        });
        const hasValidOutcome = Array.isArray(receipt.failed) &&
          ((receipt.status === "completed" && receipt.failed.length === 0) ||
            (receipt.status === "partial_failed" && receipt.failed.length > 0));
        if (!hasValidOutcome || !matchesQuarantineUpdates(threads, receipt.updated))
          throw new Error(t("quarantineUnconfirmed"));
        const updatedIds = receipt.updated.map((item) => item.threadId);
        input.onThreadsRemoved(updatedIds);
        setSelectedActiveIds((current) => current.filter((id) => !updatedIds.includes(id)));
        await Promise.all([
          input.isAdmin ? reloadQuarantine() : Promise.resolve(),
          input.isAdmin ? reloadRules() : Promise.resolve(),
          input.onSummaryRefresh(),
        ]);
        setFeedback(
          receipt.status === "completed"
            ? "邮件已移入隔离区，Gmail 原件仍然保留。"
            : `邮件已隔离，但长期规则未全部创建：${receipt.failed.map((item) => item.error).join("；")}`,
        );
        return receipt;
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "邮件没有移入隔离区。");
      } finally {
        quarantineInFlight.current = false;
        setBusy(null);
      }
    },
    [input, reloadQuarantine, reloadRules, t],
  );

  const openQuarantine = useCallback(async (threadId: string) => {
    setBusy(`quarantine:${threadId}`);
    setFeedback(null);
    try {
      setSelectedQuarantine(
        await requestMailJson<MailThreadDetail>(`/api/mail/quarantine/${threadId}`),
      );
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "隔离邮件暂时无法读取。");
    } finally {
      setBusy(null);
    }
  }, []);

  const restore = useCallback(
    async (item: MailQuarantineItem) => {
      setBusy(`restore:${item.id}`);
      setFeedback(null);
      try {
        const receipt = await requestMailJson<{
          threadId: string;
          version: number;
          refCode: string;
        }>(`/api/mail/quarantine/${item.id}`, {
          method: "PATCH",
          body: JSON.stringify({ expectedVersion: item.version }),
        });
        if (receipt.threadId !== item.id || !receipt.refCode || receipt.version <= item.version)
          throw new Error("恢复结果没有确认完整。");
        setQuarantine((current) => current.filter((candidate) => candidate.id !== item.id));
        if (selectedQuarantine?.id === item.id) setSelectedQuarantine(null);
        await Promise.all([input.onSummaryRefresh(), reloadQuarantine()]);
        setFeedback("邮件已恢复到工作台。");
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "隔离邮件没有恢复。");
      } finally {
        setBusy(null);
      }
    },
    [input, reloadQuarantine, selectedQuarantine, setQuarantine],
  );

  const deleteQuarantine = useCallback(
    async (item: MailQuarantineItem) => {
      if (
        !(await confirm({
          title: "删除隔离邮件的系统副本？",
          description: "只会删除 PT5 中的加密副本和附件，Gmail 原件仍然保留。",
          tone: "danger",
        }))
      )
        return;
      setBusy(`delete:${item.id}`);
      setFeedback(null);
      try {
        const receipt = await requestMailJson<{
          threadId: string;
          deleted: boolean;
          gmailCopyPreserved: boolean;
          auditId: string;
        }>(`/api/mail/threads/${item.id}`, { method: "DELETE" });
        if (
          !receipt.deleted ||
          !receipt.gmailCopyPreserved ||
          receipt.threadId !== item.id ||
          !receipt.auditId
        )
          throw new Error("删除结果没有确认完整。");
        setQuarantine((current) => current.filter((candidate) => candidate.id !== item.id));
        if (selectedQuarantine?.id === item.id) setSelectedQuarantine(null);
        await Promise.all([input.onSummaryRefresh(), reloadQuarantine()]);
        setFeedback("系统副本已删除，Gmail 原件仍然保留。");
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "隔离邮件没有删除完成。");
      } finally {
        setBusy(null);
      }
    },
    [confirm, input, reloadQuarantine, selectedQuarantine, setQuarantine],
  );

  return {
    quarantine,
    rules,
    selectedQuarantine,
    selectedActiveIds,
    quarantinePagination: quarantineQuery.pagination,
    onQuarantinePage: async (page: number) => {
      if (await quarantineQuery.loadPage(page)) setSelectedQuarantine(null);
    },
    busy: quarantineQuery.loading ? "quarantine:refresh" : busy,
    feedback: quarantineQuery.error ?? feedback,
    setQuarantine: acceptQuarantinePage,
    setRules,
    reloadQuarantine,
    refreshQuarantine,
    reloadRules,
    toggleActiveSelection,
    quarantineThreads,
    openQuarantine,
    restore,
    deleteQuarantine,
    createRule,
    updateRule,
    deleteRule,
  };
}
