import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import {
  createPasswordRecoveryProof,
  PASSWORD_RECOVERY_PROOF_COOKIE,
} from "@/lib/password-recovery-session";
import { requireAuthUserReceipt } from "@/lib/auth-operation-receipts";
import { getRequestPublicOrigin } from "@/lib/public-site-origin";
import { getServerSupabaseClient } from "@/lib/supabase-server";

const EMAIL_CONFIRMATION_TYPE = "email" satisfies EmailOtpType;
const PASSWORD_RECOVERY_TYPE = "recovery" satisfies EmailOtpType;
const DEFAULT_REDIRECT_PATH = "/login";
const DEFAULT_RECOVERY_REDIRECT_PATH = "/forgot-password?type=recovery";
const INVALID_RECOVERY_REDIRECT_PATH =
  "/forgot-password?type=recovery&error=invalid";

export async function GET(request: NextRequest) {
  const requestUrl = request.nextUrl;
  const publicOrigin = getRequestPublicOrigin(request);
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = getSupportedEmailOtpType(requestUrl.searchParams.get("type"));
  // Recovery verification creates the reset session; always land on the reset form.
  const nextPath =
    type === PASSWORD_RECOVERY_TYPE
      ? DEFAULT_RECOVERY_REDIRECT_PATH
      : getSafeRedirectPath(requestUrl.searchParams.get("next"), publicOrigin);

  if (!tokenHash || !type) {
    return NextResponse.redirect(new URL(DEFAULT_REDIRECT_PATH, publicOrigin));
  }

  const supabase = await getServerSupabaseClient();
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error) {
    const errorPath =
      type === PASSWORD_RECOVERY_TYPE
        ? INVALID_RECOVERY_REDIRECT_PATH
        : DEFAULT_REDIRECT_PATH;

    return NextResponse.redirect(new URL(errorPath, publicOrigin));
  }

  try {
    requireAuthUserReceipt(data, { errorMessage: "auth_confirmation_invalid" });
  } catch {
    const errorPath =
      type === PASSWORD_RECOVERY_TYPE
        ? INVALID_RECOVERY_REDIRECT_PATH
        : DEFAULT_REDIRECT_PATH;
    return NextResponse.redirect(new URL(errorPath, publicOrigin));
  }

  const response = NextResponse.redirect(new URL(nextPath, publicOrigin));

  if (type === PASSWORD_RECOVERY_TYPE) {
    const accessToken = data.session?.access_token;
    const { data: claimsData, error: claimsError } = accessToken
      ? await supabase.auth.getClaims(accessToken)
      : { data: null, error: null };
    const sessionId = claimsData?.claims.session_id;
    const recoveryProof = sessionId
      ? createPasswordRecoveryProof(sessionId)
      : null;

    if (claimsError || !recoveryProof) {
      return NextResponse.redirect(new URL(DEFAULT_REDIRECT_PATH, publicOrigin));
    }

    response.cookies.set(PASSWORD_RECOVERY_PROOF_COOKIE, recoveryProof, {
      httpOnly: true,
      maxAge: 15 * 60,
      path: "/forgot-password",
      sameSite: "lax",
      secure: publicOrigin.startsWith("https://"),
    });
  }

  return response;
}

function getSupportedEmailOtpType(value: string | null): EmailOtpType | null {
  if (value === EMAIL_CONFIRMATION_TYPE || value === PASSWORD_RECOVERY_TYPE) {
    return value;
  }

  return null;
}

function getSafeRedirectPath(value: string | null, origin: string) {
  if (!value) {
    return DEFAULT_REDIRECT_PATH;
  }

  try {
    const url = new URL(value, origin);

    if (url.origin !== origin) {
      return DEFAULT_REDIRECT_PATH;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return DEFAULT_REDIRECT_PATH;
  }
}
