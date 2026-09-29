import "server-only";
import { NextResponse } from "next/server";
import { getConfiguredPublicOrigin } from "@/lib/public-site-origin";
import { MAIL_CONNECTION_COOKIE, type MailConnectionFeedback } from "./mail-connection-feedback";

/** 固定使用公开站点地址；服务器监听的 0.0.0.0 不可作为浏览器返回地址。 */
export function connectionRedirect(feedback: MailConnectionFeedback, receipt?: string) {
  const url = new URL("/admin/mail", getConfiguredPublicOrigin());
  url.searchParams.set("mailConnection", feedback.result);
  if (feedback.result !== "success") url.searchParams.set("connectionReason", feedback.reason);
  const response = NextResponse.redirect(url);
  setConnectionCookie(response, receipt);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export function setConnectionCookie(response: NextResponse, receipt?: string) {
  response.cookies.set(MAIL_CONNECTION_COOKIE, receipt ?? "", { httpOnly: true, sameSite: "lax", path: "/",
    secure: getConfiguredPublicOrigin().startsWith("https:"), maxAge: receipt ? 600 : 0 });
}
