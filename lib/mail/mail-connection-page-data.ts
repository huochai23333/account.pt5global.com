import "server-only";
import { cookies } from "next/headers";
import { MAIL_CONNECTION_COOKIE, parseConnectionReason, type MailConnectionFeedback } from "./mail-connection-feedback";
import { verifyConnectionReceipt } from "./mail-connection-receipt";
import type { MailIdentity } from "./mail-types";

/** 页面只读取固定结果与受签名保护的凭证；真正的成功依据由独立核对模块提供。 */
export async function getMailConnectionFeedback(identity: MailIdentity, params: Record<string, string | string[] | undefined>): Promise<MailConnectionFeedback | null> {
  if (identity.role !== "administrator") return null;
  const result = params.mailConnection;
  if (result === "success") {
    const receipt = (await cookies()).get(MAIL_CONNECTION_COOKIE)?.value;
    try {
      if (await verifyConnectionReceipt(identity, receipt)) return { result: "success", reason: "unconfirmed" };
    } catch { /* 页面仍可查看邮箱；核对失败时仅撤回成功提示。 */ }
    return { result: "failed", reason: "unconfirmed" };
  }
  if (result === "failed" || result === "partial_failed") return { result, reason: parseConnectionReason(params.connectionReason) };
  return null;
}
