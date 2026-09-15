"use client";

import Link from "next/link";
import { ArrowRight, LoaderCircle, Mail } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { FeedbackNotice } from "@/components/ui/feedback-notice";

import { AuthField } from "./auth-field";
import { AuthPasswordField } from "./auth-password-field";
import { useLoginFormViewModel } from "./use-login-form-view-model";

/** 登录表单只渲染字段和反馈，认证请求及账号切换由 view-model 负责。 */
export function LoginForm({
  registered = false,
  passwordReset = false,
}: {
  registered?: boolean;
  passwordReset?: boolean;
}) {
  const t = useTranslations("LoginForm");
  const login = useLoginFormViewModel();

  return (
    <form
      aria-busy={login.submitting}
      className="space-y-6"
      onSubmit={login.handleSubmit}
    >
      {registered ? (
        <FeedbackNotice density="compact" tone="info">
          {t("registeredNotice")}
        </FeedbackNotice>
      ) : null}
      {passwordReset ? (
        <FeedbackNotice density="compact" tone="success">
          {t("passwordResetNotice")}
        </FeedbackNotice>
      ) : null}
      {login.accountSwitcherNotice ? (
        <FeedbackNotice density="compact" tone="success">
          {login.accountSwitcherNotice}
        </FeedbackNotice>
      ) : null}
      {login.error ? (
        <FeedbackNotice density="compact" tone="error">
          {login.error}
        </FeedbackNotice>
      ) : null}

      <AuthField
        autoComplete="email"
        disabled={login.submitting}
        icon={<Mail className="size-4" />}
        label={t("email")}
        name="email"
        onChange={(event) => login.setEmail(event.target.value)}
        placeholder="name@example.com"
        required
        type="email"
        value={login.email}
      />

      <AuthPasswordField
        autoComplete="current-password"
        disabled={login.submitting}
        hidePasswordLabel={t("hidePassword")}
        label={t("password")}
        labelAction={
          <Link
            aria-disabled={login.submitting}
            className={`text-xs font-medium text-content-muted transition-colors hover:text-primary ${
              login.submitting ? "pointer-events-none opacity-60" : ""
            }`}
            href="/forgot-password"
            onClick={(event) => {
              if (login.submitting) event.preventDefault();
            }}
            tabIndex={login.submitting ? -1 : undefined}
          >
            {t("forgotPassword")}
          </Link>
        }
        name="password"
        onChange={(event) => login.setPassword(event.target.value)}
        placeholder={t("passwordPlaceholder")}
        required
        showPasswordLabel={t("showPassword")}
        value={login.password}
      />

      <Button
        className="mt-2 w-full"
        disabled={login.submitting}
        size="large"
        type="submit"
      >
        {login.submitting ? t("submitting") : t("submit")}
        {login.submitting ? (
          <LoaderCircle className="size-4 shrink-0 animate-spin" />
        ) : (
          <ArrowRight className="size-4 shrink-0" />
        )}
      </Button>
    </form>
  );
}
