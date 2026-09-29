import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";

import { requireMailIdentity, requireMailAdministrator } from "@/lib/mail/mail-identity";
import { createGoogleAuthorizationUrl, createOAuthTransaction, createPkcePair } from "@/lib/mail/mail-integrations";
import { connectionRedirect, setConnectionCookie } from "@/lib/mail/mail-connection-navigation";

export async function GET(request: Request) {
  try {
    const identity = await requireMailIdentity();
    requireMailAdministrator(identity);
    const pkce = createPkcePair();
    const state = await createOAuthTransaction({
      identity,
      provider: "google",
      purpose: "shared_mailbox",
      returnUrl: new URL(request.url).searchParams.get("returnUrl"),
      pkceVerifier: pkce.verifier,
    });
    const response = NextResponse.redirect(createGoogleAuthorizationUrl(state, pkce.challenge));
    // 新授权清除上次成功凭证，避免这次未完成却沿用上次提示。
    setConnectionCookie(response);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    unstable_rethrow(error);
    return connectionRedirect({ result: "failed", reason: "unavailable" });
  }
}
