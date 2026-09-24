"use client";

import { useCallback, type Dispatch, type SetStateAction } from "react";

import type { MailAgentProfile, MailThreadDetail } from "@/lib/mail/mail-types";

import { readNdjsonText } from "./mail-display";
import { requestMailJson } from "./mail-workspace-request";
import type { ComposerState } from "./use-mail-workspace-composer";

type SetValue<T> = Dispatch<SetStateAction<T>>;

/** AI 辅助、发件人设置和外部账号连接与会话列表状态分开维护。 */
export function useMailWorkspaceServices(input: {
  isAdmin: boolean;
  selected: MailThreadDetail | null;
  setAgents: SetValue<MailAgentProfile[]>;
  setOwnProfile: SetValue<MailAgentProfile | null>;
  setComposer: SetValue<ComposerState>;
  setBusy: SetValue<string | null>;
  setFeedback: SetValue<string | null>;
  setAiDraft: SetValue<string>;
  setReport: SetValue<string>;
  markDraftDirty: () => void;
  refreshSummary: () => Promise<void>;
}) {
  const generateReply = useCallback(async () => {
    if (!input.selected) return;
    input.setBusy("ai-reply"); input.setFeedback(null); input.setAiDraft("");
    try {
      const response = await fetch("/api/mail/ai/reply", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ threadId: input.selected.id, requestId: crypto.randomUUID() }),
      });
      if (!response.ok) throw new Error("回复建议没有生成完成。");
      const draft = await readNdjsonText(response);
      input.setAiDraft(draft); input.setComposer((current) => ({ ...current, body: draft }));
      input.markDraftDirty();
      input.setFeedback("回复建议已生成，可以继续修改后再发送。");
    } catch (error) { input.setFeedback(error instanceof Error ? error.message : "回复建议没有生成完成。"); }
    finally { input.setBusy(null); }
  }, [input]);

  const generateReport = useCallback(async (start: string, end: string) => {
    input.setBusy("ai-report"); input.setFeedback(null); input.setReport("");
    try {
      const response = await fetch("/api/mail/ai/report", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ start: new Date(`${start}T00:00:00+08:00`).toISOString(), end: new Date(`${end}T23:59:59.999+08:00`).toISOString(), requestId: crypto.randomUUID() }),
      });
      if (!response.ok) throw new Error("邮件分析报告没有生成完成。");
      input.setReport(await readNdjsonText(response)); input.setFeedback("邮件分析报告已生成。");
    } catch (error) { input.setFeedback(error instanceof Error ? error.message : "邮件分析报告没有生成完成。"); }
    finally { input.setBusy(null); }
  }, [input]);

  const saveAgent = useCallback(async (profile: MailAgentProfile, resetToGenerated = false) => {
    input.setBusy(`agent:${profile.memberId}`); input.setFeedback(null);
    try {
      const receipt = await requestMailJson<{ memberId: string; aliasLocalPart: string; refPrefix: string; version: number }>("/api/mail/agents", { method: "PUT", body: JSON.stringify({
        memberId: profile.memberId, aliasLocalPart: profile.aliasLocalPart, refPrefix: profile.refPrefix,
        senderDisplayName: profile.senderDisplayName, signatureHtml: profile.signatureHtml, enabled: profile.enabled,
        version: profile.version, resetToGenerated,
      }) });
      const expectedAlias = resetToGenerated ? profile.suggestedAliasLocalPart : profile.aliasLocalPart.trim().toLowerCase();
      const expectedRef = resetToGenerated ? profile.suggestedRefPrefix : profile.refPrefix.trim().toUpperCase();
      if (receipt.memberId !== profile.memberId || receipt.aliasLocalPart !== expectedAlias || receipt.refPrefix !== expectedRef || receipt.version <= profile.version) {
        throw new Error("发件人配置保存结果没有确认完整。");
      }
      const result = await requestMailJson<{ agents: MailAgentProfile[] }>("/api/mail/agents");
      if (input.isAdmin) input.setAgents(result.agents);
      else input.setOwnProfile(result.agents[0] ?? null);
      await input.refreshSummary(); input.setFeedback("发件人配置已保存。");
    } catch (error) { input.setFeedback(error instanceof Error ? error.message : "发件人配置没有保存。"); }
    finally { input.setBusy(null); }
  }, [input]);

  const connectMailbox = useCallback(async () => {
    input.setBusy("connect"); input.setFeedback(null);
    try {
      const result = await requestMailJson<{ connectUrl: string }>("/api/mail/mailbox-connect", { method: "POST", body: "{}" });
      window.location.assign(result.connectUrl);
    } catch (error) { input.setFeedback(error instanceof Error ? error.message : "暂时无法连接公司邮箱。"); input.setBusy(null); }
  }, [input]);

  const connectFeishu = useCallback(async () => {
    input.setBusy("feishu"); input.setFeedback(null);
    try {
      const result = await requestMailJson<{ connectUrl: string }>("/api/mail/feishu-connect", { method: "POST", body: "{}" });
      window.location.assign(result.connectUrl);
    } catch (error) { input.setFeedback(error instanceof Error ? error.message : "暂时无法绑定飞书。"); input.setBusy(null); }
  }, [input]);

  return { connectFeishu, connectMailbox, generateReply, generateReport, saveAgent };
}
