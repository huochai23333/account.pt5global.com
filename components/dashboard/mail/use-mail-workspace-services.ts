"use client";

import { useCallback, useRef, type Dispatch, type SetStateAction } from "react";
import { useTranslations } from "next-intl";

import type { MailAgentProfile } from "@/lib/mail/mail-types";

import { requestMailJson } from "./mail-workspace-request";

type SetValue<T> = Dispatch<SetStateAction<T>>;

/** 发件人设置和外部账号连接独立维护，生成建议由专用 Hook 处理。 */
export function useMailWorkspaceServices(input: {
  isAdmin: boolean;
  setAgents: SetValue<MailAgentProfile[]>;
  setOwnProfile: SetValue<MailAgentProfile | null>;
  setBusy: SetValue<string | null>;
  setFeedback: SetValue<string | null>;
  refreshSummary: () => Promise<void>;
}) {
  const t = useTranslations("MailWorkspace");
  const savingAgent = useRef(false);
  const saveAgent = useCallback(
    async (profile: MailAgentProfile, resetToGenerated = false) => {
      // 连续点击可能发生在等待按钮渲染之前，因此先锁住提交。
      if (savingAgent.current) return;
      savingAgent.current = true;
      // 保存与恢复共用一张卡片，区分操作后才能只在被点击的按钮显示等待动画。
      input.setBusy(`agent:${resetToGenerated ? "reset" : "save"}:${profile.memberId}`);
      input.setFeedback(null);
      try {
        const receipt = await requestMailJson<{
          memberId: string;
          aliasLocalPart: string;
          refPrefix: string;
          version: number;
          enabled: boolean;
        }>("/api/mail/agents", {
          method: "PUT",
          body: JSON.stringify({
            memberId: profile.memberId,
            aliasLocalPart: profile.aliasLocalPart,
            refPrefix: profile.refPrefix,
            senderDisplayName: profile.senderDisplayName,
            signatureHtml: profile.signatureHtml,
            enabled: profile.enabled,
            version: profile.version,
            resetToGenerated,
          }),
        });
        const expectedAlias = resetToGenerated
          ? profile.suggestedAliasLocalPart
          : profile.aliasLocalPart.trim().toLowerCase();
        const expectedRef = resetToGenerated
          ? profile.suggestedRefPrefix
          : profile.refPrefix.trim().toUpperCase();
        if (
          receipt.memberId !== profile.memberId ||
          receipt.aliasLocalPart !== expectedAlias ||
          receipt.refPrefix !== expectedRef ||
          receipt.enabled !== profile.enabled ||
          receipt.version !== profile.version + 1
        ) {
          throw new Error(t("senderSaveUnconfirmed"));
        }
        const result = await requestMailJson<{ agents: MailAgentProfile[] }>("/api/mail/agents");
        const saved = result.agents.find((agent) => agent.memberId === receipt.memberId);
        // 写入响应和重读必须指向同一版本。其他标签页已写入时，不能继续宣告本次结果。
        if (!saved || saved.version !== receipt.version || saved.enabled !== receipt.enabled ||
            saved.aliasLocalPart !== receipt.aliasLocalPart || saved.refPrefix !== receipt.refPrefix) {
          throw new Error(t("senderSaveUnconfirmed"));
        }
        if (input.isAdmin) input.setAgents(result.agents);
        else input.setOwnProfile(saved);
        await input.refreshSummary();
        input.setFeedback(t("senderSaved"));
      } catch (error) {
        input.setFeedback(error instanceof Error ? error.message : "发件人配置没有保存。");
      } finally {
        savingAgent.current = false;
        input.setBusy(null);
      }
    },
    [input, t],
  );

  const connectMailbox = useCallback(async () => {
    input.setBusy("connect");
    input.setFeedback(null);
    try {
      const result = await requestMailJson<{ connectUrl: string }>("/api/mail/mailbox-connect", {
        method: "POST",
        body: "{}",
      });
      window.location.assign(result.connectUrl);
    } catch (error) {
      input.setFeedback(error instanceof Error ? error.message : "暂时无法连接公司邮箱。");
      input.setBusy(null);
    }
  }, [input]);

  const connectFeishu = useCallback(async () => {
    input.setBusy("feishu");
    input.setFeedback(null);
    try {
      const result = await requestMailJson<{ connectUrl: string }>("/api/mail/feishu-connect", {
        method: "POST",
        body: "{}",
      });
      window.location.assign(result.connectUrl);
    } catch (error) {
      input.setFeedback(error instanceof Error ? error.message : "暂时无法绑定飞书。");
      input.setBusy(null);
    }
  }, [input]);

  return { connectFeishu, connectMailbox, saveAgent };
}
