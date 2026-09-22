"use client";

import { useCallback, useMemo, useState } from "react";
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
  OutboundMessageInput,
} from "@/lib/mail/mail-types";

import { readNdjsonText } from "./mail-display";

async function requestJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const result = await response.json().catch(() => null) as (T & { error?: string }) | null;
  if (!response.ok || !result) throw new Error(result?.error ?? "操作没有完成，请稍后重试。");
  return result;
}

export type ComposerState = {
  mode: "new" | "reply";
  to: string; cc: string; bcc: string; subject: string; body: string;
  attachmentIds: string[]; attachments: Array<{ id: string; name: string; status: string }>;
};

const EMPTY_COMPOSER: ComposerState = { mode: "new", to: "", cc: "", bcc: "", subject: "", body: "", attachmentIds: [], attachments: [] };

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

export function useMailWorkspace(input: {
  initialSummary: MailWorkspaceSummary | null;
  initialThreads: MailThreadListItem[];
  initialAgents: MailAgentProfile[];
  initialOwnProfile: MailAgentProfile | null;
  initialMetrics: AdminMailMetrics | null;
  initialError: string | null;
  isAdmin: boolean;
}) {
  const confirm = useDashboardConfirm();
  const t = useTranslations("MailWorkspace");
  const [summary, setSummary] = useState(input.initialSummary);
  const [threads, setThreads] = useState(input.initialThreads);
  const [agents, setAgents] = useState(input.initialAgents);
  const [ownProfile, setOwnProfile] = useState(input.initialOwnProfile);
  const [metrics, setMetrics] = useState(input.initialMetrics);
  const [selected, setSelected] = useState<MailThreadDetail | null>(null);
  const [filters, setFilters] = useState<MailThreadQuery>({ scope: input.isAdmin ? "all" : "mine", limit: 40 });
  const [composer, setComposer] = useState<ComposerState>(EMPTY_COMPOSER);
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

  const loadThreads = useCallback(async (nextFilters: MailThreadQuery = filters) => {
    setBusy("threads"); setFeedback(null);
    try {
      const result = await requestJson<{ threads: MailThreadListItem[] }>("/api/mail/threads", {
        method: "POST", body: JSON.stringify(nextFilters),
      });
      setFilters(nextFilters); setThreads(result.threads); setSelected(null);
      await refreshSummary();
    } catch (error) { setFeedback(error instanceof Error ? error.message : "邮件列表暂时无法读取。"); }
    finally { setBusy(null); }
  }, [filters, refreshSummary]);

  const openThread = useCallback(async (threadId: string) => {
    setBusy(`thread:${threadId}`); setFeedback(null);
    try {
      const detail = await requestJson<MailThreadDetail>(`/api/mail/threads/${threadId}`);
      setSelected(detail);
      setComposer({ ...EMPTY_COMPOSER, mode: "reply", to: detail.customerEmail, subject: detail.subject });
      const lastMessage = detail.messages.at(-1);
      if (lastMessage && detail.unread) {
        await requestJson(`/api/mail/threads/${threadId}/read`, { method: "POST", body: JSON.stringify({ messageId: lastMessage.id }) });
        setThreads((current) => current.map((item) => item.id === threadId ? { ...item, unread: false } : item));
      }
    } catch (error) { setFeedback(error instanceof Error ? error.message : "邮件详情暂时无法读取。"); }
    finally { setBusy(null); }
  }, []);

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

  const uploadFiles = useCallback(async (files: File[]) => {
    if (!files) return;
    if (composer.attachments.length + files.length > 10) { setFeedback("一封邮件最多添加 10 个附件。"); return; }
    setBusy("attachment"); setFeedback(null);
    try {
      const uploaded = [] as ComposerState["attachments"];
      for (const file of Array.from(files)) {
        const base64 = await fileToBase64(file);
        const receipt = await requestJson<{ attachmentId: string; filename: string; status: string }>("/api/mail/attachments", {
          method: "POST", body: JSON.stringify({ filename: file.name, contentType: file.type, base64 }),
        });
        uploaded.push({ id: receipt.attachmentId, name: receipt.filename, status: receipt.status });
      }
      setComposer((current) => ({ ...current, attachments: [...current.attachments, ...uploaded], attachmentIds: [...current.attachmentIds, ...uploaded.map((item) => item.id)] }));
      if (uploaded.some((item) => item.status !== "clean")) setFeedback("附件已保存，正在等待安全检查，暂时不能发送。");
    } catch (error) { setFeedback(error instanceof Error ? error.message : "附件没有上传完成。"); }
    finally { setBusy(null); }
  }, [composer.attachments.length]);

  const send = useCallback(async () => {
    setBusy("send"); setFeedback(null);
    try {
      const message: OutboundMessageInput = {
        threadId: composer.mode === "reply" ? selected?.id : undefined,
        to: composer.to.split(/[;,\n]/).map((item) => item.trim()).filter(Boolean),
        cc: composer.cc.split(/[;,\n]/).map((item) => item.trim()).filter(Boolean),
        bcc: composer.bcc.split(/[;,\n]/).map((item) => item.trim()).filter(Boolean),
        subject: composer.subject,
        textBody: composer.body,
        htmlBody: "",
        attachmentIds: composer.attachmentIds,
        idempotencyKey: crypto.randomUUID(),
      };
      const queued = await requestJson<{ jobId: string }>("/api/mail/outbound", { method: "POST", body: JSON.stringify(message) });
      setFeedback("邮件正在发送，请稍候…");
      for (let attempt = 0; attempt < 40; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const status = await requestJson<{ status: string; lastError: string | null }>(`/api/mail/outbound/${queued.jobId}`);
        if (status.status === "sent") {
          setComposer(EMPTY_COMPOSER); setAiDraft("");
          await loadThreads(filters);
          setFeedback("邮件已在公司邮箱的“已发送”中确认。");
          return;
        }
        if (["failed", "partial_failed"].includes(status.status)) throw new Error(status.lastError ?? "邮件没有发送完成。");
      }
      throw new Error("发送确认超时，请稍后在发件状态中核对。");
    } catch (error) { setFeedback(error instanceof Error ? error.message : "邮件没有发送完成。"); }
    finally { setBusy(null); }
  }, [composer, filters, loadThreads, selected]);

  const generateReply = useCallback(async () => {
    if (!selected) return;
    setBusy("ai-reply"); setFeedback(null); setAiDraft("");
    try {
      const response = await fetch("/api/mail/ai/reply", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ threadId: selected.id, requestId: crypto.randomUUID() }),
      });
      if (!response.ok) throw new Error("回复建议没有生成完成。");
      const draft = await readNdjsonText(response);
      setAiDraft(draft); setComposer((current) => ({ ...current, body: draft }));
      setFeedback("回复建议已生成，可以继续修改后再发送。");
    } catch (error) { setFeedback(error instanceof Error ? error.message : "回复建议没有生成完成。"); }
    finally { setBusy(null); }
  }, [selected]);

  const generateReport = useCallback(async (start: string, end: string) => {
    setBusy("ai-report"); setFeedback(null); setReport("");
    try {
      const response = await fetch("/api/mail/ai/report", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ start: new Date(`${start}T00:00:00+08:00`).toISOString(), end: new Date(`${end}T23:59:59.999+08:00`).toISOString(), requestId: crypto.randomUUID() }),
      });
      if (!response.ok) throw new Error("邮件分析报告没有生成完成。");
      setReport(await readNdjsonText(response)); setFeedback("邮件分析报告已生成。");
    } catch (error) { setFeedback(error instanceof Error ? error.message : "邮件分析报告没有生成完成。"); }
    finally { setBusy(null); }
  }, []);

  const saveAgent = useCallback(async (profile: MailAgentProfile, resetToGenerated = false) => {
    setBusy(`agent:${profile.memberId}`); setFeedback(null);
    try {
      const receipt = await requestJson<{ memberId: string; aliasLocalPart: string; refPrefix: string; version: number }>("/api/mail/agents", { method: "PUT", body: JSON.stringify({
        memberId: profile.memberId, aliasLocalPart: profile.aliasLocalPart, refPrefix: profile.refPrefix,
        senderDisplayName: profile.senderDisplayName, signatureHtml: profile.signatureHtml, enabled: profile.enabled,
        version: profile.version, resetToGenerated,
      }) });
      const expectedAlias = resetToGenerated ? profile.suggestedAliasLocalPart : profile.aliasLocalPart.trim().toLowerCase();
      const expectedRef = resetToGenerated ? profile.suggestedRefPrefix : profile.refPrefix.trim().toUpperCase();
      if (receipt.memberId !== profile.memberId || receipt.aliasLocalPart !== expectedAlias || receipt.refPrefix !== expectedRef || receipt.version <= profile.version) {
        throw new Error("发件人配置保存结果没有确认完整。");
      }
      const result = await requestJson<{ agents: MailAgentProfile[] }>("/api/mail/agents");
      if (input.isAdmin) setAgents(result.agents);
      else setOwnProfile(result.agents[0] ?? null);
      await refreshSummary(); setFeedback("发件人配置已保存。");
    } catch (error) { setFeedback(error instanceof Error ? error.message : "发件人配置没有保存。"); }
    finally { setBusy(null); }
  }, [input.isAdmin, refreshSummary]);

  const connectMailbox = useCallback(async () => {
    setBusy("connect"); setFeedback(null);
    try {
      const result = await requestJson<{ connectUrl: string }>("/api/mail/mailbox-connect", { method: "POST", body: "{}" });
      window.location.assign(result.connectUrl);
    } catch (error) { setFeedback(error instanceof Error ? error.message : "暂时无法连接公司邮箱。"); setBusy(null); }
  }, []);

  const connectFeishu = useCallback(async () => {
    setBusy("feishu"); setFeedback(null);
    try {
      const result = await requestJson<{ connectUrl: string }>("/api/mail/feishu-connect", { method: "POST", body: "{}" });
      window.location.assign(result.connectUrl);
    } catch (error) { setFeedback(error instanceof Error ? error.message : "暂时无法绑定飞书。"); setBusy(null); }
  }, []);

  const startNew = useCallback(() => { setSelected(null); setComposer(EMPTY_COMPOSER); setAiDraft(""); }, []);
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
      await refreshSummary();
    } catch (error) { setFeedback(error instanceof Error ? error.message : "邮件副本没有删除完成。"); }
    finally { setBusy(null); }
  }, [confirm, refreshSummary, selected, t]);
  // 发件设置包含管理员，但客户会话仍只允许转交给启用的业务员。
  const enabledAgents = useMemo(() => agents.filter((agent) => agent.enabled && agent.role === "salesman"), [agents]);
  const removeThreads = useCallback((threadIds: string[]) => {
    setThreads((current) => current.filter((item) => !threadIds.includes(item.id)));
    setSelected((current) => current && threadIds.includes(current.id) ? null : current);
  }, []);

  return {
    summary, threads, agents, ownProfile, enabledAgents, metrics, selected, filters, composer, busy, feedback, aiDraft, report,
    setComposer, setAgents, setOwnProfile, loadThreads, openThread, updateState, assign, uploadFiles, send, generateReply,
    generateReport, saveAgent, connectMailbox, connectFeishu, startNew, deleteSelected, refreshSummary, removeThreads,
  };
}
