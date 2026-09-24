"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

import type { MailThreadDetail, MailThreadQuery, OutboundMessageInput } from "@/lib/mail/mail-types";

import { readMailDraft, writeMailDraft } from "./mail-draft-storage";
import { readMailSendIntent, writeMailSendIntent, type MailSendIntent } from "./mail-send-intent";
import { runMailSendFlow } from "./mail-send-flow";
import { requestMailJson } from "./mail-workspace-request";
import type { useMailDraftGuard } from "./use-mail-draft-guard";

export type ComposerState = {
  mode: "new" | "reply";
  to: string; cc: string; bcc: string; subject: string; body: string;
  attachmentIds: string[]; attachments: Array<{ id: string; name: string; status: string }>;
};

export const EMPTY_COMPOSER: ComposerState = { mode: "new", to: "", cc: "", bcc: "", subject: "", body: "", attachmentIds: [], attachments: [] };
type SetValue<T> = Dispatch<SetStateAction<T>>;

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("附件内容无法读取。"));
    reader.onload = () => {
      const value = typeof reader.result === "string" ? reader.result : "";
      resolve(value.includes(",") ? value.slice(value.indexOf(",") + 1) : value);
    };
    reader.readAsDataURL(file);
  });
}

/** 草稿、附件和发送标识共用一份撰写状态，失败时才能安全恢复原任务。 */
export function useMailWorkspaceComposer(input: {
  viewerId: string;
  selected: MailThreadDetail | null;
  setSelected: SetValue<MailThreadDetail | null>;
  filters: MailThreadQuery;
  loadThreads: (filters: MailThreadQuery, options?: { skipDraftGuard?: boolean }) => Promise<void>;
  draftGuard: ReturnType<typeof useMailDraftGuard>;
  setBusy: SetValue<string | null>;
  setFeedback: SetValue<string | null>;
  setAiDraft: SetValue<string>;
}) {
  const { draftGuard, filters, loadThreads, selected, setAiDraft, setBusy, setFeedback, setSelected, viewerId } = input;
  const { setDirty } = draftGuard;
  const [composer, setComposer] = useState<ComposerState>(EMPTY_COMPOSER);
  const [pendingSend, setPendingSend] = useState(false);
  const pendingIntentRef = useRef<MailSendIntent | null>(null);
  const draftThreadIdRef = useRef<string | null>(null);
  const [draftReady, setDraftReady] = useState(false);

  useEffect(() => {
    // 刷新后继续查询同一个任务；不会把邮件正文存入持久数据库。
    pendingIntentRef.current = readMailSendIntent(viewerId);
    setPendingSend(Boolean(pendingIntentRef.current));
  }, [viewerId]);

  useEffect(() => {
    const saved = readMailDraft(viewerId);
    if (saved) {
      draftThreadIdRef.current = saved.threadId;
      setComposer(saved.composer);
      setDirty(true);
      if (saved.composer.mode === "reply" && saved.threadId) {
        void requestMailJson<MailThreadDetail>(`/api/mail/threads/${saved.threadId}`)
          .then(setSelected)
          .catch(() => setFeedback("草稿已恢复，请重新打开原会话后再发送回复。"));
      }
    }
    setDraftReady(true);
  }, [viewerId, setDirty, setSelected, setFeedback]);

  useEffect(() => {
    if (!draftReady) return;
    if (draftGuard.dirty) writeMailDraft(viewerId, { composer, threadId: selected?.id ?? draftThreadIdRef.current });
    else writeMailDraft(viewerId, null);
  }, [composer, draftGuard.dirty, draftReady, viewerId, selected?.id]);

  const saveSendIntent = useCallback((intent: MailSendIntent | null) => {
    pendingIntentRef.current = intent;
    writeMailSendIntent(viewerId, intent);
    setPendingSend(Boolean(intent));
  }, [viewerId]);

  const uploadFiles = useCallback(async (files: File[]) => {
    if (!files) return;
    if (composer.attachments.length + files.length > 10) { setFeedback("一封邮件最多添加 10 个附件。"); return; }
    setBusy("attachment"); setFeedback(null);
    try {
      const uploaded = [] as ComposerState["attachments"];
      for (const file of Array.from(files)) {
        const base64 = await fileToBase64(file);
        const receipt = await requestMailJson<{ attachmentId: string; filename: string; status: string }>("/api/mail/attachments", {
          method: "POST", body: JSON.stringify({ filename: file.name, contentType: file.type, base64 }),
        });
        uploaded.push({ id: receipt.attachmentId, name: receipt.filename, status: receipt.status });
      }
      setComposer((current) => ({ ...current, attachments: [...current.attachments, ...uploaded], attachmentIds: [...current.attachmentIds, ...uploaded.map((item) => item.id)] }));
      if (uploaded.length > 0) draftGuard.setDirty(true);
      if (uploaded.some((item) => item.status !== "clean")) setFeedback("附件已保存，正在等待安全检查，暂时不能发送。");
    } catch (error) { setFeedback(error instanceof Error ? error.message : "附件没有上传完成。"); }
    finally { setBusy(null); }
  }, [composer.attachments.length, draftGuard, setBusy, setFeedback]);

  const send = useCallback(async () => {
    setBusy("send"); setFeedback("邮件正在发送，请稍候…");
    try {
      if (composer.mode === "reply" && !selected) throw new Error("请先打开原会话，再发送这封回复。");
      const draft: Omit<OutboundMessageInput, "idempotencyKey"> = {
        threadId: composer.mode === "reply" ? selected?.id : undefined,
        to: composer.to.split(/[;,\n]/).map((item) => item.trim()).filter(Boolean),
        cc: composer.cc.split(/[;,\n]/).map((item) => item.trim()).filter(Boolean),
        bcc: composer.bcc.split(/[;,\n]/).map((item) => item.trim()).filter(Boolean),
        subject: composer.subject,
        textBody: composer.body,
        htmlBody: "",
        attachmentIds: composer.attachmentIds,
      };
      const result = await runMailSendFlow({ draft, pendingIntent: pendingIntentRef.current, saveIntent: saveSendIntent, viewerId });
      if (result === "sent") {
        draftGuard.setDirty(false);
        setComposer(EMPTY_COMPOSER); setAiDraft("");
        await loadThreads(filters, { skipDraftGuard: true });
        setFeedback("邮件已在公司邮箱的“已发送”中确认。");
      } else if (result === "partial_failed") {
        setFeedback("公司邮箱的发送结果需要人工核对，请勿再次发送这封邮件。");
      } else {
        setFeedback("发送结果仍在确认中，点击“继续核对”可查看原任务。");
      }
    } catch (error) { setFeedback(error instanceof Error ? error.message : "邮件没有发送完成。"); }
    finally { setBusy(null); }
  }, [composer, draftGuard, filters, loadThreads, saveSendIntent, selected, setAiDraft, setBusy, setFeedback, viewerId]);

  const startNew = useCallback(async () => {
    if (!await draftGuard.canDiscard()) return false;
    draftGuard.setDirty(false);
    setSelected(null); setComposer(EMPTY_COMPOSER); setAiDraft("");
    return true;
  }, [draftGuard, setAiDraft, setSelected]);

  const updateComposer = useCallback((next: ComposerState) => {
    draftGuard.setDirty(true);
    setComposer(next);
    writeMailDraft(viewerId, { composer: next, threadId: selected?.id ?? draftThreadIdRef.current });
  }, [draftGuard, viewerId, selected?.id]);

  return { composer, pendingSend, send, setComposer, startNew, updateComposer, uploadFiles };
}
