import { NextResponse } from "next/server";

import { requireMailIdentity } from "@/lib/mail/mail-identity";
import { bindFeishuIdentity, consumeOAuthTransaction, getFeishuIdentity } from "@/lib/mail/mail-integrations";

export async function GET(request: Request) {
  try {
    const identity = await requireMailIdentity();
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) throw new Error("飞书授权信息不完整。");
    const transaction = await consumeOAuthTransaction({ state, provider: "feishu", identity });
    if (transaction.purpose !== "member_feishu") throw new Error("本次授权不是飞书绑定。");
    const feishu = await getFeishuIdentity(code);
    await bindFeishuIdentity(identity, feishu.openId, feishu.displayName);
    return NextResponse.redirect(transaction.returnUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "飞书绑定失败。";
    return NextResponse.redirect(new URL(`/salesman/mail?connectionError=${encodeURIComponent(message)}`, request.url));
  }
}
