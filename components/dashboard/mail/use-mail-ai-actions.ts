"use client";

import { useRef, type Dispatch, type SetStateAction } from "react";
import { useTranslations } from "next-intl";

import { readAssistantEventStream } from "@/lib/ai-assistant/assistant-event-stream";

type SetValue<T> = Dispatch<SetStateAction<T>>;

/** 两种生成入口共用严格流校验。只有完整结束且正文长度一致才交给界面。 */
async function requestMailAiText(path: "reply" | "report", input: Record<string, string>) {
  const response = await fetch(`/api/mail/ai/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...input, requestId: crypto.randomUUID() }),
    signal: AbortSignal.timeout(35_000),
  });
  if (!response.ok || !response.body) throw new Error("mail_ai_response_unavailable");
  return (await readAssistantEventStream(response.body, () => {})).trim();
}

/** 回复建议绑定打开的会话与当时的编辑版本，报告单独更新自己的显示区域。 */
export function useMailAiActions(input: {
  threadId: string | null;
  getViewVersion: () => number;
  getViewThreadId: () => string | null;
  getDraftEditVersion: () => number;
  applyReply: (draft: string) => void;
  setAiDraft: SetValue<string>;
  setReport: SetValue<string>;
  setBusy: SetValue<string | null>;
  setFeedback: SetValue<string | null>;
}) {
  const { threadId, getViewVersion, getViewThreadId, getDraftEditVersion, applyReply, setAiDraft, setReport, setBusy, setFeedback } = input;
  const t = useTranslations("MailWorkspace");
  const reply = useRef<{ view: number } | null>(null);
  const reporting = useRef(false);

  async function generateReply() {
    const view = getViewVersion();
    if (!threadId || getViewThreadId() !== threadId || reply.current?.view === view) return;
    const request = { view };
    reply.current = request;
    const edited = getDraftEditVersion();
    const isCurrent = () => reply.current === request && getViewVersion() === view
      && getViewThreadId() === threadId && getDraftEditVersion() === edited;
    setBusy("ai-reply");
    setFeedback(null);
    setAiDraft("");
    try {
      const draft = await requestMailAiText("reply", { threadId });
      // 即使后台已生成，另一封邮件或较新的手动输入也不能被旧建议替换。
      if (!isCurrent()) return;
      setAiDraft(draft);
      applyReply(draft);
      setFeedback(t("replySuggestionReady"));
    } catch {
      if (isCurrent()) setFeedback(t("replySuggestionFailed"));
    } finally {
      if (reply.current === request) {
        reply.current = null;
        setBusy((current) => current === "ai-reply" ? null : current);
      }
    }
  }

  async function generateReport(start: string, end: string) {
    if (reporting.current) return;
    reporting.current = true;
    setBusy("ai-report");
    setFeedback(null);
    setReport("");
    try {
      setReport(await requestMailAiText("report", {
        start: new Date(`${start}T00:00:00+08:00`).toISOString(),
        end: new Date(`${end}T23:59:59.999+08:00`).toISOString(),
      }));
      setFeedback(t("aiReportReady"));
    } catch {
      setFeedback(t("aiReportFailed"));
    } finally {
      reporting.current = false;
      setBusy((current) => current === "ai-report" ? null : current);
    }
  }

  return { generateReply, generateReport };
}
