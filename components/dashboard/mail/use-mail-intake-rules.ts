"use client";

import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import type { MailIntakeRule, MailIntakeRuleAction, MailIntakeRuleMatcher } from "@/lib/mail/mail-types";

import { requestMailJson } from "./mail-client-request";

/** 规则草稿、读取和增删改集中在这里；隔离面板仅在写入后要求规则重读。 */
export function useMailIntakeRules(
  initialRules: MailIntakeRule[],
  setBusy: Dispatch<SetStateAction<string | null>>,
  setFeedback: Dispatch<SetStateAction<string | null>>,
) {
  const [rules, setRules] = useState(initialRules);

  const reloadRules = useCallback(async () => {
    const result = await requestMailJson<{ rules: MailIntakeRule[] }>("/api/mail/intake-rules");
    setRules(result.rules);
  }, []);

  const createRule = useCallback(
    async (rule: {
      matchType: MailIntakeRuleMatcher;
      action: MailIntakeRuleAction;
      pattern: string;
    }) => {
      setBusy("rule:create");
      setFeedback(null);
      try {
        const receipt = await requestMailJson<{
          ruleId: string;
          version: number;
          created: boolean;
        }>("/api/mail/intake-rules", {
          method: "POST",
          body: JSON.stringify({ ...rule, enabled: true }),
        });
        if (!receipt.created || !receipt.ruleId || receipt.version < 1)
          throw new Error("规则创建结果没有确认完整。");
        await reloadRules();
        setFeedback("收件规则已创建。");
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "收件规则没有创建。");
      } finally {
        setBusy(null);
      }
    },
    [reloadRules, setBusy, setFeedback],
  );

  const updateRule = useCallback(
    async (rule: MailIntakeRule) => {
      setBusy(`rule:save:${rule.id}`);
      setFeedback(null);
      try {
        const receipt = await requestMailJson<{
          ruleId: string;
          version: number;
          updated: boolean;
        }>("/api/mail/intake-rules", {
          method: "PUT",
          body: JSON.stringify({ ...rule, expectedVersion: rule.version }),
        });
        if (!receipt.updated || receipt.ruleId !== rule.id || receipt.version <= rule.version)
          throw new Error("规则保存结果没有确认完整。");
        await reloadRules();
        setFeedback("收件规则已保存。");
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "收件规则没有保存。");
      } finally {
        setBusy(null);
      }
    },
    [reloadRules, setBusy, setFeedback],
  );

  const deleteRule = useCallback(async (rule: MailIntakeRule) => {
    setBusy(`rule:delete:${rule.id}`);
    setFeedback(null);
    try {
      const receipt = await requestMailJson<{ ruleId: string; deleted: boolean; auditId: number }>(
        "/api/mail/intake-rules",
        {
          method: "DELETE",
          body: JSON.stringify({ ruleId: rule.id, expectedVersion: rule.version }),
        },
      );
      if (!receipt.deleted || receipt.ruleId !== rule.id || !receipt.auditId)
        throw new Error("规则删除结果没有确认完整。");
      setRules((current) => current.filter((candidate) => candidate.id !== rule.id));
      setFeedback("收件规则已删除。");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "收件规则没有删除。");
    } finally {
      setBusy(null);
    }
  }, [setBusy, setFeedback]);

  return { rules, setRules, reloadRules, createRule, updateRule, deleteRule };
}
