"use client";

import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { useTranslations } from "next-intl";

import type { MailThreadDetail, MailThreadListItem } from "@/lib/mail/mail-types";

import { MailWorkspaceRequestError, requestMailJson } from "./mail-workspace-request";
import type { useMailDraftGuard } from "./use-mail-draft-guard";

type Opening = { threadId: string; controller: AbortController };
type SetValue<T> = Dispatch<SetStateAction<T>>;

/** 打开详情和记录已读共用一个选择凭证。迟到结果不能改变另一封邮件或新邮件表单。 */
export function useMailThreadOpening(input: {
  draftGuard: ReturnType<typeof useMailDraftGuard>;
  setSelected: SetValue<MailThreadDetail | null>;
  setThreads: SetValue<MailThreadListItem[]>;
  setBusy: SetValue<string | null>;
  setFeedback: SetValue<string | null>;
}) {
  const { draftGuard: { canDiscard, setDirty }, setSelected, setThreads, setBusy, setFeedback } = input;
  const t = useTranslations("MailWorkspace");
  const active = useRef<Opening | null>(null);
  const viewVersion = useRef(0);
  const viewThread = useRef<string | null>(null);

  const startViewChange = useCallback(() => {
    const version = ++viewVersion.current;
    viewThread.current = null;
    const previous = active.current;
    active.current = null;
    if (previous) {
      previous.controller.abort();
    }
    // 后台仍可完成已开始的建议，新视图可继续操作自己的草稿。
    setBusy((current) => current === "ai-reply" || (previous && current === `thread:${previous.threadId}`) ? null : current);
    return version;
  }, [setBusy]);
  const isCurrentView = useCallback((version: number) => version === viewVersion.current, []);
  const getViewVersion = useCallback(() => viewVersion.current, []);
  const getViewThreadId = useCallback(() => viewThread.current, []);
  const cancelRemoved = useCallback((threadIds: string[]) => {
    const pending = active.current?.threadId;
    const shown = viewThread.current;
    if ((pending && threadIds.includes(pending)) || (shown && threadIds.includes(shown))) startViewChange();
  }, [startViewChange]);

  useEffect(() => () => {
    active.current?.controller.abort();
    active.current = null;
    viewVersion.current += 1;
    viewThread.current = null;
  }, []);

  const loadThread = useCallback(async (threadId: string, onOpened?: (detail: MailThreadDetail) => void) => {
    startViewChange();
    const request = { threadId, controller: new AbortController() };
    active.current = request;
    const key = `thread:${threadId}`;
    const endpoint = `/api/mail/threads/${threadId}`;
    setBusy(key);
    if (onOpened) setFeedback(null);
    try {
      const detail = await requestMailJson<MailThreadDetail>(endpoint, {
        signal: AbortSignal.any([request.controller.signal, AbortSignal.timeout(30_000)]),
      });
      if (active.current !== request) return;
      if (detail.id !== threadId || !Array.isArray(detail.messages)) {
        throw new Error(t("threadOpenFailed"));
      }
      viewThread.current = threadId;
      setSelected(detail);
      // 自动恢复只补齐会话上下文。用户原草稿及已读位置都应保留。
      if (!onOpened) return;
      setDirty(false);
      onOpened(detail);

      const messageId = detail.readMessageId;
      if (!messageId || !detail.unread) return;
      const receipt = await requestMailJson<{ threadId: string; messageId: string; unread: boolean }>(`${endpoint}/read`, {
        method: "POST",
        body: JSON.stringify({ messageId }),
        signal: AbortSignal.any([request.controller.signal, AbortSignal.timeout(30_000)]),
      });
      if (active.current !== request) return;
      // 只有本会话实际读到的消息回执才可移除未读标记，错误回执保留原提示。
      if (receipt.threadId !== threadId || receipt.messageId !== messageId || typeof receipt.unread !== "boolean") {
        throw new Error(t("threadReadFailed"));
      }
      setThreads((current) => current.map((item) =>
        item.id === threadId && item.version === detail.version ? { ...item, unread: receipt.unread } : item,
      ));
      setSelected((current) =>
        current?.id === threadId && current.version === detail.version ? { ...current, unread: receipt.unread } : current,
      );
    } catch (error) {
      if (active.current === request) {
        if (error instanceof MailWorkspaceRequestError && error.code === "thread_unavailable") {
          return "unavailable" as const;
        }
        setFeedback(onOpened
          ? error instanceof Error ? error.message : t("threadOpenFailed")
          : t("threadDraftRestoreFailed"));
      }
    } finally {
      if (active.current === request) {
        active.current = null;
        setBusy((current) => current === key ? null : current);
      }
    }
  }, [setBusy, setDirty, setFeedback, setSelected, setThreads, startViewChange, t]);

  async function openThread(threadId: string, onOpened: (detail: MailThreadDetail) => void) {
    if (await canDiscard()) return loadThread(threadId, onOpened);
  }

  return { openThread, restoreThread: loadThread, startViewChange, isCurrentView, getViewVersion, getViewThreadId, cancelRemoved };
}
