"use client";

import Link from "next/link";
import { ArrowRight, Mail } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { FeedbackNotice } from "@/components/ui/feedback-notice";

import { AuthField } from "./auth-field";
import { AuthLoadingShell } from "./auth-loading-shell";
import { AuthPasswordField } from "./auth-password-field";
import {
  useForgotPasswordViewModel,
  type ForgotPasswordRecoveryState,
} from "./use-forgot-password-view-model";

/** 找回密码表单只呈现当前步骤，恢复会话和请求状态由 view-model 维护。 */
export function ForgotPasswordForm({
  initialRecoveryState,
}: {
  initialRecoveryState: ForgotPasswordRecoveryState;
}) {
  const t = useTranslations("ForgotPasswordForm");
  const reset = useForgotPasswordViewModel({ initialRecoveryState });

  if (reset.checkingRecovery) return <AuthLoadingShell variant="recovery" />;

  return (
    <div className="space-y-6">
      {reset.notice ? (
        <FeedbackNotice
          density="compact"
          tone={reset.mode === "sent" ? "info" : "success"}
        >
          {reset.notice}
        </FeedbackNotice>
      ) : null}
      {reset.error ? (
        <FeedbackNotice density="compact" tone="error">
          {reset.error}
        </FeedbackNotice>
      ) : null}

      {reset.mode === "reset" ? (
        reset.recoveryReady ? (
          <form
            aria-busy={reset.submitting}
            className="space-y-6"
            onSubmit={reset.handleUpdatePassword}
          >
            <AuthPasswordField
              autoComplete="new-password"
              disabled={reset.submitting}
              hidePasswordLabel={t("hidePassword")}
              hint={reset.passwordHint}
              hintTone={reset.passwordHintTone}
              label={t("newPassword")}
              name="password"
              onChange={(event) => reset.setPassword(event.target.value)}
              placeholder={t("newPasswordPlaceholder")}
              required
              showPasswordLabel={t("showPassword")}
              value={reset.password}
            />
            <AuthPasswordField
              autoComplete="new-password"
              disabled={reset.submitting}
              hidePasswordLabel={t("hidePassword")}
              label={t("confirmPassword")}
              name="confirmPassword"
              onChange={(event) =>
                reset.setConfirmPassword(event.target.value)
              }
              placeholder={t("confirmPasswordPlaceholder")}
              required
              showPasswordLabel={t("showPassword")}
              value={reset.confirmPassword}
            />
            <Button
              className="w-full"
              disabled={reset.submitting}
              size="large"
              type="submit"
            >
              {reset.submitting ? t("savingPassword") : t("savePassword")}
              <ArrowRight className="size-4" />
            </Button>
          </form>
        ) : (
          <AuthLoadingShell variant="recovery" />
        )
      ) : (
        <form
          aria-busy={reset.submitting}
          className="space-y-6"
          onSubmit={reset.handleSendResetEmail}
        >
          <AuthField
            autoComplete="email"
            disabled={reset.submitting}
            icon={<Mail className="size-4" />}
            label={t("email")}
            name="email"
            onChange={(event) => reset.setEmail(event.target.value)}
            placeholder={t("emailPlaceholder")}
            required
            type="email"
            value={reset.email}
          />
          <Button
            className="w-full"
            disabled={reset.submitting || reset.cooldownRemaining > 0}
            size="large"
            type="submit"
          >
            {reset.resetButtonLabel}
            <ArrowRight className="size-4" />
          </Button>
        </form>
      )}

      <div className="flex items-center justify-between gap-4 text-sm text-content-muted">
        <Link
          className="font-medium text-primary transition-colors hover:text-brand-hover"
          href="/login"
        >
          {t("backToLogin")}
        </Link>
      </div>
    </div>
  );
}
