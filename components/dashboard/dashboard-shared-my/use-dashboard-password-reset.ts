"use client";

import { useCallback, useEffect, useState } from "react";

import type { SupabaseClient, User } from "@supabase/supabase-js";

import type {
  DashboardSharedCopy,
  DashboardSharedMyStateCopy,
} from "./dashboard-shared-my-state-copy";
import { requireAuthRequestAccepted } from "@/lib/auth-operation-receipts";
import { toErrorMessage, type FeedbackTone } from "../dashboard-shared-ui";

const PASSWORD_RESET_COOLDOWN_SECONDS = 60;

type PageNotice = {
  tone: FeedbackTone;
  message: string;
} | null;

type UseDashboardPasswordResetArgs = {
  authUser: Pick<User, "email"> | null;
  copy: Pick<DashboardSharedMyStateCopy, "missingEmailForReset" | "resetSent">;
  setBusyKey: (busyKey: string | null) => void;
  setPageNotice: (notice: PageNotice) => void;
  sharedCopy: DashboardSharedCopy;
  supabase: SupabaseClient | null;
};

export function useDashboardPasswordReset({
  authUser,
  copy,
  setBusyKey,
  setPageNotice,
  sharedCopy,
  supabase,
}: UseDashboardPasswordResetArgs) {
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  useEffect(() => {
    if (cooldownRemaining <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setCooldownRemaining((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [cooldownRemaining]);

  const sendPasswordReset = useCallback(async () => {
    if (cooldownRemaining > 0) {
      return;
    }

    const email = authUser?.email?.trim();

    if (!supabase || !email) {
      setPageNotice({ tone: "error", message: copy.missingEmailForReset });
      return;
    }

    setBusyKey("password");
    setPageNotice(null);

    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/forgot-password`
        : undefined;

    try {
      // Supabase only confirms the reset request was accepted; the mailbox result is checked with the mail provider.
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (error) {
        throw error;
      }
      requireAuthRequestAccepted(data, "password_reset_request_invalid");

      setCooldownRemaining(PASSWORD_RESET_COOLDOWN_SECONDS);
      setPageNotice({ tone: "info", message: copy.resetSent });
    } catch (error) {
      setPageNotice({ tone: "error", message: toErrorMessage(error, sharedCopy) });
    } finally {
      setBusyKey(null);
    }
  }, [
    authUser?.email,
    cooldownRemaining,
    copy.missingEmailForReset,
    copy.resetSent,
    setBusyKey,
    setPageNotice,
    sharedCopy,
    supabase,
  ]);

  return {
    passwordResetCooldownRemaining: cooldownRemaining,
    sendPasswordReset,
  };
}
