import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";

import { requireMailIdentity } from "@/lib/mail/mail-identity";
import { createFeishuAuthorizationUrl, createOAuthTransaction } from "@/lib/mail/mail-integrations";
import { feishuFailureRedirect } from "@/lib/mail/mail-feishu-navigation";
import type { MailIdentity } from "@/lib/mail/mail-types";

export async function GET(request: Request) {
  let identity: MailIdentity | null = null;
  try {
    identity = await requireMailIdentity();
    const state = await createOAuthTransaction({
      identity,
      provider: "feishu",
      purpose: "member_feishu",
      returnUrl: new URL(request.url).searchParams.get("returnUrl"),
    });
    const response = NextResponse.redirect(createFeishuAuthorizationUrl(state));
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    // redirect 是 Next.js 的流程控制信号，必须先交还框架，不能当作第三方授权失败。
    unstable_rethrow(error);
    return feishuFailureRedirect(identity, "unavailable");
  }
}
