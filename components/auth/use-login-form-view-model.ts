"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { getAccountSwitcherLoginIntent, type AccountSwitcherLoginIntent } from "@/lib/account-switcher";
import { getBrowserSupabaseClient } from "@/lib/supabase";

import { getLoginFeedbackKey } from "./login-feedback";
import { useLoginRecovery } from "./use-login-recovery";

/** 表单模型只维护输入与消息；认证、权限和导航由独立恢复流程处理。 */
export function useLoginFormViewModel() {
  const t = useTranslations("LoginForm");
  const [supabase] = useState(() => typeof window !== "undefined" ? getBrowserSupabaseClient() : null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountSwitcherIntent, setAccountSwitcherIntent] = useState<AccountSwitcherLoginIntent | null>(null);
  const recovery = useLoginRecovery(supabase);

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

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!recovery.state.busy) void recovery.signIn(email, password);
  };
  const feedbackKey = getLoginFeedbackKey(recovery.state);
  const accountSwitcherNotice = accountSwitcherIntent?.kind === "add"
    ? t("accountSwitcherAddNotice")
    : accountSwitcherIntent?.kind === "reauthenticate"
      ? t("accountSwitcherReauthenticateNotice", { email: accountSwitcherIntent.targetAccount?.email ?? "" }) : null;

  return {
    accountSwitcherNotice, email, password, handleSubmit, setEmail, setPassword,
    // 首次服务端渲染和浏览器渲染都保持空反馈，不能因服务端没有浏览器客户端而制造错误提示。
    error: feedbackKey ? t(feedbackKey) : null,
    submitting: recovery.state.busy,
    submittingLabel: recovery.state.phase === "password" ? t("submitting") : t("checkingSession"),
    checkingSession: recovery.state.busy && recovery.state.phase !== "password",
    canRecover: recovery.state.canRecover,
    recover: () => { void recovery.recover(); },
  };
}
