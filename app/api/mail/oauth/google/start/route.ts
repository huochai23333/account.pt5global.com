import { NextResponse } from "next/server";

import { requireMailIdentity, requireMailAdministrator } from "@/lib/mail/mail-identity";
import { createGoogleAuthorizationUrl, createOAuthTransaction, createPkcePair } from "@/lib/mail/mail-integrations";

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
    return NextResponse.redirect(createGoogleAuthorizationUrl(state, pkce.challenge));
  } catch (error) {
    const message = error instanceof Error ? error.message : "无法开始 Google 授权。";
    return NextResponse.redirect(new URL(`/admin/mail?connectionError=${encodeURIComponent(message)}`, request.url));
  }
}
