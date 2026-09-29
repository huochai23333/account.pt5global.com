import "server-only";
import { NextResponse } from "next/server";
import { getConfiguredPublicOrigin } from "@/lib/public-site-origin";
import { getMailReturnPath } from "./mail-return-url";
import type { FeishuConnectionReason } from "./mail-feishu-feedback";
import type { MailIdentity } from "./mail-types";

/** 身份确认前的读取失败返回登录页；身份确认后才选择该角色的邮件页。 */
export function feishuFailureRedirect(identity: MailIdentity | null, reason: FeishuConnectionReason) {
  const url = new URL(identity ? getMailReturnPath("feishu", identity.role) : "/login", getConfiguredPublicOrigin());
  if (identity) {
    url.searchParams.set("feishuConnection", "failed");
    url.searchParams.set("feishuReason", reason);
  }
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
