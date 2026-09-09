"use client";

import { useState } from "react";

import type {
  EmailConnectionSummary,
  EmailPlatformRule,
} from "@/lib/emailconnect/emailconnect-types";

export function useEmailRemindersViewModel(input: {
  initialSummary: EmailConnectionSummary | null;
  initialRules: EmailPlatformRule[];
  initialLoadError: string | null;
  workspace: string;
}) {
  const [summary, setSummary] = useState(input.initialSummary);
  const [rules, setRules] = useState(input.initialRules);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(input.initialLoadError);
  const [feedbackTone, setFeedbackTone] = useState<"error" | "success">(
    input.initialLoadError ? "error" : "success",
  );

  async function startConnection() {
    setBusyKey("connect");
    setFeedback(null);
    try {
      const response = await fetch("/api/email-reminders/connect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspace: input.workspace }),
      });
      const result = (await response.json()) as { connectUrl?: string; error?: string };
      if (!response.ok || !result.connectUrl) throw new Error(result.error ?? "暂时无法开始连接。");
      window.location.assign(result.connectUrl);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "暂时无法开始连接。");
      setFeedbackTone("error");
      setBusyKey(null);
    }
  }

  async function disconnect(connectionId: string) {
    setBusyKey(connectionId);
    setFeedback(null);
    try {
      const response = await fetch(`/api/email-reminders/connections/${connectionId}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspace: input.workspace }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "暂时无法断开邮箱。");
      setSummary((current) => current
        ? { ...current, connections: current.connections.filter((item) => item.id !== connectionId) }
        : current);
      setFeedback("邮箱连接已断开。");
      setFeedbackTone("success");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "暂时无法断开邮箱。");
      setFeedbackTone("error");
    } finally {
      setBusyKey(null);
    }
  }

  function updateRule(ruleId: string, patch: Partial<EmailPlatformRule>) {
    setRules((current) => current.map((rule) => rule.id === ruleId ? { ...rule, ...patch } : rule));
  }

  async function saveRules() {
    setBusyKey("rules");
    setFeedback(null);
    try {
      const response = await fetch("/api/email-reminders/rules", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspace: input.workspace, rules }),
      });
      const result = (await response.json()) as { rules?: EmailPlatformRule[]; error?: string };
      if (!response.ok || !result.rules) throw new Error(result.error ?? "规则暂时无法保存。");
      setRules(result.rules);
      setFeedback("提醒规则已保存。");
      setFeedbackTone("success");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "规则暂时无法保存。");
      setFeedbackTone("error");
    } finally {
      setBusyKey(null);
    }
  }

  return { busyKey, disconnect, feedback, feedbackTone, rules, saveRules, startConnection, summary, updateRule };
}
