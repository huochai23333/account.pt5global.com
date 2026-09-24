import type { OutboundMessageInput } from "@/lib/mail/mail-types";

import { fingerprintMailMessage, readMailSendIntent, type MailSendIntent } from "./mail-send-intent";
import { MailWorkspaceRequestError, requestMailJson } from "./mail-workspace-request";

export type MailSendFlowResult = "sent" | "partial_failed" | "pending";

/** 同一草稿的查询、入队和结果轮询必须共用一个标识，断网时也不能生成第二个任务。 */
export async function runMailSendFlow({
  draft,
  pendingIntent,
  saveIntent,
  viewerId,
}: {
  draft: Omit<OutboundMessageInput, "idempotencyKey">;
  pendingIntent: MailSendIntent | null;
  saveIntent: (intent: MailSendIntent | null) => void;
  viewerId: string;
}): Promise<MailSendFlowResult> {
  const fingerprint = await fingerprintMailMessage(draft);
  let intent = pendingIntent ?? readMailSendIntent(viewerId);
  if (!intent) {
    intent = { key: crypto.randomUUID(), fingerprint, jobId: null };
    saveIntent(intent);
  }
  if (!intent.jobId) {
    // 服务端可能已经建好任务，但浏览器丢失了响应；先按原标识查找。
    const found = await requestMailJson<{ jobId: string | null }>(`/api/mail/outbound?key=${encodeURIComponent(intent.key)}`);
    if (found.jobId) {
      intent = { ...intent, jobId: found.jobId };
      saveIntent(intent);
    } else {
      if (intent.fingerprint !== fingerprint) {
        throw new Error("上一封邮件的发送结果尚未确认，请恢复原稿后继续核对。");
      }
      const message: OutboundMessageInput = { ...draft, idempotencyKey: intent.key };
      let queued: { jobId: string };
      try {
        queued = await requestMailJson<{ jobId: string }>("/api/mail/outbound", {
          method: "POST",
          body: JSON.stringify(message),
        });
      } catch (error) {
        // 只有服务端明确确认任务未创建，才能允许用户修改草稿后重新发送。
        if (error instanceof MailWorkspaceRequestError && error.code === "confirmed_rejection") saveIntent(null);
        throw error;
      }
      intent = { ...intent, jobId: queued.jobId };
      saveIntent(intent);
    }
  }
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const status = await requestMailJson<{ status: string; lastError: string | null }>(`/api/mail/outbound/${intent.jobId}`);
    if (status.status === "sent") {
      saveIntent(null);
      return "sent";
    }
    if (status.status === "failed") {
      saveIntent(null);
      throw new Error("邮件未能发送，请检查内容后重试。");
    }
    if (status.status === "partial_failed") return "partial_failed";
  }
  return "pending";
}
