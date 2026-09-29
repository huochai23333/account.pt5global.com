import { unstable_rethrow } from "next/navigation";
import type { NextRequest } from "next/server";

import { requireMailIdentity, requireMailAdministrator } from "@/lib/mail/mail-identity";
import { consumeOAuthTransaction } from "@/lib/mail/mail-integrations";
import { exchangeGoogleCode, getGoogleProfile, saveSharedMailbox, startGmailWatch, validateCompanyMailbox } from "@/lib/mail/mail-google-connection";
import { MailConnectionError, MAIL_CONNECTION_COOKIE, type MailConnectionReason } from "@/lib/mail/mail-connection-feedback";
import { createConnectionReceipt, verifyConnectionReceipt } from "@/lib/mail/mail-connection-receipt";
import { connectionRedirect } from "@/lib/mail/mail-connection-navigation";

export async function GET(request: NextRequest) {
  let stage: MailConnectionReason = "unavailable";
  let watchStarted = false;
  try {
    const identity = await requireMailIdentity();
    requireMailAdministrator(identity);
    const url = new URL(request.url);
    if (url.searchParams.has("error")) throw new MailConnectionError("cancelled");
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) throw new MailConnectionError("incomplete");
    const previous = request.cookies.get(MAIL_CONNECTION_COOKIE)?.value;
    // 刷新已完成的回调只核对原凭证，不再交换令牌或重复开启通知。
    if (await verifyConnectionReceipt(identity, previous, state)) {
      return connectionRedirect({ result: "success", reason: "unconfirmed" }, previous);
    }
    const transaction = await consumeOAuthTransaction({ state, provider: "google", identity });
    if (transaction.purpose !== "shared_mailbox" || !transaction.pkceVerifier) throw new MailConnectionError("state");
    stage = "tokens";
    const tokens = await exchangeGoogleCode(code, transaction.pkceVerifier);
    stage = "profile";
    const profile = await getGoogleProfile(tokens.accessToken);
    // 先检查邮箱与权限，防止选错个人邮箱后仍替它开启收件通知。
    validateCompanyMailbox(profile.email, tokens);
    stage = "watch";
    const watch = await startGmailWatch(tokens.accessToken);
    watchStarted = true;
    stage = "save";
    const mailboxId = await saveSharedMailbox({ subject: profile.subject, email: profile.email, tokens, watch });
    stage = "unconfirmed";
    const receipt = await createConnectionReceipt(identity, state, mailboxId);
    if (!await verifyConnectionReceipt(identity, receipt, state)) throw new MailConnectionError("unconfirmed");
    return connectionRedirect({ result: "success", reason: "unconfirmed" }, receipt);
  } catch (error) {
    unstable_rethrow(error);
    // 日志只保留步骤和固定原因，不能写入授权码、令牌或第三方完整错误内容。
    const reason = error instanceof MailConnectionError ? error.reason : stage;
    console.warn("[mail/google-connection]", { stage, reason, result: watchStarted ? "partial_failed" : "failed" });
    return connectionRedirect({ result: watchStarted ? "partial_failed" : "failed",
      reason });
  }
}
