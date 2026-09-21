import { NextResponse } from "next/server";

import { requireMailIdentity, requireMailAdministrator } from "@/lib/mail/mail-identity";
import {
  consumeOAuthTransaction,
  exchangeGoogleCode,
  getGoogleProfile,
  saveSharedMailbox,
  startGmailWatch,
} from "@/lib/mail/mail-integrations";

export async function GET(request: Request) {
  try {
    const identity = await requireMailIdentity();
    requireMailAdministrator(identity);
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) throw new Error("Google 授权信息不完整。");
    const transaction = await consumeOAuthTransaction({ state, provider: "google", identity });
    if (transaction.purpose !== "shared_mailbox" || !transaction.pkceVerifier) {
      throw new Error("本次授权不是公司邮箱连接。");
    }
    const tokens = await exchangeGoogleCode(code, transaction.pkceVerifier);
    const profile = await getGoogleProfile(tokens.accessToken);
    const watch = await startGmailWatch(tokens.accessToken);
    await saveSharedMailbox({ subject: profile.subject, email: profile.email, tokens, watch });
    return NextResponse.redirect(transaction.returnUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "公司邮箱连接失败。";
    return NextResponse.redirect(new URL(`/admin/mail?connectionError=${encodeURIComponent(message)}`, request.url));
  }
}
