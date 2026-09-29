"use client";
import { useTranslations } from "next-intl";
import { FeedbackNotice } from "../dashboard-shared-ui";
import type { FeishuConnectionReason } from "@/lib/mail/mail-feishu-feedback";

/** 飞书失败提示独立映射固定原因，不把服务器异常或网址中的任意文字带进页面。 */
export function MailFeishuNotice({ reason }: { reason: FeishuConnectionReason | null }) {
  const t = useTranslations("MailWorkspace.feishuConnection");
  if (!reason) return null;
  return <div data-testid="mail-feishu-notice" data-reason={reason}><FeedbackNotice tone="error">{t(reason)}</FeedbackNotice></div>;
}
