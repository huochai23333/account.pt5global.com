"use client";

import { startTransition, useEffect, useState } from "react";

import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { useTranslations } from "next-intl";

import {
  completeAccountSwitcherLogin,
  getAccountSwitcherLoginIntent,
  type AccountSwitcherLoginIntent,
} from "@/lib/account-switcher";
import {
  getRoleFromAuthClaims,
  getRoleFromAuthSession,
} from "@/lib/auth-session-client";
import { clearCurrentBrowserSession } from "@/lib/browser-auth-session";
import { getBrowserSupabaseClient } from "@/lib/supabase";
import { useSupabaseAuthSync } from "@/lib/use-supabase-auth-sync";
import { getCurrentWorkspaceBusinessAccess } from "@/lib/workspace-business-access";
import { getSignedInWorkspaceDestination } from "@/lib/workspace-business-availability";

import {
  isEmailNotConfirmedAuthError,
  isAuthConnectionTimeoutError,
  isInvalidCredentialsAuthError,
  isInvalidEmailAuthError,
  isTooFrequentAuthError,
} from "./auth-error-messages";

/**
 * 登录 view-model 统一处理 Supabase 会话、账号切换和跳转。
 * 展示组件只绑定返回的字段与事件，避免一份文件同时维护业务流程和大段表单结构。
 */
export function useLoginFormViewModel() {
  const router = useRouter();
  const t = useTranslations("LoginForm");
  const [supabase] = useState<ReturnType<typeof getBrowserSupabaseClient>>(
    () => (typeof window !== "undefined" ? getBrowserSupabaseClient() : null),
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountSwitcherIntent, setAccountSwitcherIntent] =
    useState<AccountSwitcherLoginIntent | null>(null);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      const intent = getAccountSwitcherLoginIntent();
      const targetEmail = intent?.targetAccount?.email;

      setAccountSwitcherIntent(intent);
      if (intent?.kind === "reauthenticate" && targetEmail) {
        setEmail((currentEmail) => currentEmail || targetEmail);
      }
    }, 0);

    return () => window.clearTimeout(timerId);
  }, []);

  const redirectToWorkspace = async (session?: Session | null) => {
    const role =
      (supabase
        ? await getRoleFromAuthClaims(supabase, session?.user)
        : null) ?? getRoleFromAuthSession(session);
    const result = completeAccountSwitcherLogin({ role, session });

    if (result.status === "same-current-account") {
      await clearCurrentBrowserSession(supabase);
      resetAfterAccountMismatch(t("accountSwitcherDifferentAccountRequired"));
      return;
    }

    if (result.status === "target-mismatch") {
      await clearCurrentBrowserSession(supabase);
      setEmail(result.targetEmail);
      resetAfterAccountMismatch(
        t("accountSwitcherTargetMismatch", { email: result.targetEmail }),
      );
      return;
    }

    if (result.status === "role-unavailable") {
      await clearCurrentBrowserSession(supabase);
      resetAfterAccountMismatch(t("serviceUnavailable"));
      return;
    }

    const businesses = supabase
      ? await getCurrentWorkspaceBusinessAccess(supabase)
      : [];
    const nextPath = role
      ? getSignedInWorkspaceDestination(role, businesses)
      : "/";

    startTransition(() => router.replace(nextPath));
  };

  function resetAfterAccountMismatch(message: string) {
    setPassword("");
    setSubmitting(false);
    setAccountSwitcherIntent(getAccountSwitcherLoginIntent());
    setError(message);
  }

  useSupabaseAuthSync(supabase, {
    includeInitialSessionEvent: true,
    onAuthStateChange: async ({ event, isMounted, session }) => {
      if (event !== "INITIAL_SESSION" || !isMounted() || !session?.user) {
        return;
      }
      await redirectToWorkspace(session);
    },
  });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);

    if (!supabase) {
      setSubmitting(false);
      setError(t("serviceUnavailable"));
      return;
    }

    try {
      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
      if (signInError) throw signInError;
      await redirectToWorkspace(data.session);
    } catch (signInError) {
      setError(formatLoginError(signInError, t));
      setSubmitting(false);
    }
  };

  const accountSwitcherNotice =
    accountSwitcherIntent?.kind === "add"
      ? t("accountSwitcherAddNotice")
      : accountSwitcherIntent?.kind === "reauthenticate"
        ? t("accountSwitcherReauthenticateNotice", {
            email: accountSwitcherIntent.targetAccount?.email ?? "",
          })
        : null;

  return {
    accountSwitcherNotice,
    email,
    error,
    handleSubmit,
    password,
    setEmail,
    setPassword,
    submitting,
  };
}

function formatLoginError(
  error: unknown,
  t: (key: string) => string,
) {
  if (isInvalidCredentialsAuthError(error)) return t("invalidCredentials");
  if (isEmailNotConfirmedAuthError(error)) return t("emailNotConfirmed");
  if (isInvalidEmailAuthError(error)) return t("invalidEmail");
  if (isTooFrequentAuthError(error)) return t("tooFrequent");
  if (isAuthConnectionTimeoutError(error)) return t("connectionTimeout");
  return t("serviceUnavailable");
}
