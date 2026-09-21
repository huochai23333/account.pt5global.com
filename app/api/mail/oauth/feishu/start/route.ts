import { NextResponse } from "next/server";

import { requireMailIdentity } from "@/lib/mail/mail-identity";
import { createFeishuAuthorizationUrl, createOAuthTransaction } from "@/lib/mail/mail-integrations";

export async function GET(request: Request) {
  try {
    const identity = await requireMailIdentity();
    const state = await createOAuthTransaction({
      identity,
      provider: "feishu",
      purpose: "member_feishu",
      returnUrl: new URL(request.url).searchParams.get("returnUrl"),
    });
    return NextResponse.redirect(createFeishuAuthorizationUrl(state));
  } catch (error) {
    const message = error instanceof Error ? error.message : "无法开始飞书授权。";
    return NextResponse.redirect(new URL(`/salesman/mail?connectionError=${encodeURIComponent(message)}`, request.url));
  }
}
