"use client";

import { useTranslations } from "next-intl";
import { FeedbackNotice } from "../dashboard-shared-ui";
import type { MailConnectionFeedback } from "@/lib/mail/mail-connection-feedback";

/** 授权结果使用明确的提示颜色，避免把“已使用”的失败文字误认成成功。 */
export function MailConnectionNotice({ feedback }: { feedback: MailConnectionFeedback | null }) {
  const t = useTranslations("MailWorkspace.connection");
  if (!feedback) return null;
  return <div data-testid="mail-connection-notice" data-result={feedback.result}>
    <FeedbackNotice tone={feedback.result === "success" ? "success" : "error"}>
      {t(feedback.result === "success" ? "success" : feedback.result === "partial_failed" ? "partialFailed" : feedback.reason)}
    </FeedbackNotice>
  </div>;
}
