import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";

import { requireMailIdentity } from "@/lib/mail/mail-identity";
import { consumeOAuthTransaction } from "@/lib/mail/mail-integrations";
import { bindFeishuIdentity, getFeishuIdentity } from "@/lib/mail/mail-feishu-provider";
import { FeishuConnectionError } from "@/lib/mail/mail-feishu-feedback";
import { feishuFailureRedirect } from "@/lib/mail/mail-feishu-navigation";
import { MailConnectionError } from "@/lib/mail/mail-connection-feedback";
import type { MailIdentity } from "@/lib/mail/mail-types";

export async function GET(request: Request) {
  let identity: MailIdentity | null = null;
  try {
    identity = await requireMailIdentity();
    const url = new URL(request.url);
    if (url.searchParams.has("error")) throw new FeishuConnectionError("cancelled");
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) throw new FeishuConnectionError("incomplete");
    const transaction = await consumeOAuthTransaction({ state, provider: "feishu", identity });
    if (transaction.purpose !== "member_feishu") throw new FeishuConnectionError("state");
    const feishu = await getFeishuIdentity(code);
    await bindFeishuIdentity(identity, feishu.openId, feishu.displayName);
    // 写入回执已确认 user_id 与 open_id；页面刷新再从数据库展示真实绑定状态。
    const response = NextResponse.redirect(transaction.returnUrl);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    unstable_rethrow(error);
    const reason = error instanceof FeishuConnectionError ? error.reason
      : error instanceof MailConnectionError && error.reason === "state" ? "state" : "unavailable";
    return feishuFailureRedirect(identity, reason);
  }
}
