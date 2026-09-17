"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { User } from "@supabase/supabase-js";
import { useTranslations } from "next-intl";

import type { AppRole } from "@/lib/auth-routing";
import {
  clearAccountSwitcherStorage,
  getStoredAlternateAccount,
  isStoredAccountExpired,
  isStoredAccountReauthenticationRequired,
  removeStoredAlternateAccount,
  type AccountSwitcherStoredAccount,
} from "@/lib/account-switcher";
import { executeAccountSwitcherAction } from "@/lib/account-switcher-actions";
import { signOutCurrentBrowserSession } from "@/lib/browser-auth-session";
import type { getBrowserSupabaseClient } from "@/lib/supabase";

import type { FeedbackTone } from "../dashboard-shared-ui";

type PageNoticeSetter = (notice: { tone: FeedbackTone; message: string } | null) => void;
type BusySetter = (busyKey: string | null) => void;

type UseDashboardAccountSwitcherOptions = {
  authUser: User | null;
  displayName: string;
  role: AppRole | null;
  setBusyKey: BusySetter;
  setPageNotice: PageNoticeSetter;
  supabase: ReturnType<typeof getBrowserSupabaseClient>;
};

export function useDashboardAccountSwitcher({
  authUser,
  displayName,
  role,
  setBusyKey,
  setPageNotice,
  supabase,
}: UseDashboardAccountSwitcherOptions) {
  const t = useTranslations("DashboardMy");
  const [storedAlternateAccount, setStoredAlternateAccount] =
    useState<AccountSwitcherStoredAccount | null>(null);

  const reloadAlternateAccount = useCallback(() => {
    setStoredAlternateAccount(getStoredAlternateAccount());
  }, []);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      reloadAlternateAccount();
    }, 0);

    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key.includes("account-switcher")) {
        reloadAlternateAccount();
      }
    };

    window.addEventListener("storage", handleStorage);

    return () => {
      window.clearTimeout(timerId);
      window.removeEventListener("storage", handleStorage);
    };
  }, [reloadAlternateAccount]);

  const currentAccount = useMemo(
    () =>
      authUser
        ? {
            displayName,
            email: authUser.email ?? t("accountSwitcherUnknownEmail"),
            role,
            userId: authUser.id,
          }
        : null,
    [authUser, displayName, role, t],
  );

  const hasSavedCurrentAccount =
    Boolean(authUser) && storedAlternateAccount?.userId === authUser?.id;
  const alternateAccount = hasSavedCurrentAccount ? null : storedAlternateAccount;

  const addAlternateAccount = useCallback(async () => {
    setBusyKey("account-switcher-add");
    setPageNotice(null);

    try {
      await executeAccountSwitcherAction({
        action: { kind: "add" },
        displayName,
        role,
        supabase,
      });
      signOutCurrentBrowserSession(supabase, "/login");
    } catch {
      setPageNotice({
        tone: "error",
        message: t("accountSwitcherUnavailable"),
      });
      setBusyKey(null);
    }
  }, [displayName, role, setBusyKey, setPageNotice, supabase, t]);

  const reauthenticateAlternateAccount = useCallback(async () => {
    if (!alternateAccount) {
      return;
    }

    setBusyKey("account-switcher-reauthenticate");
    setPageNotice(null);

    try {
      await executeAccountSwitcherAction({
        action: { kind: "reauthenticate", target: alternateAccount },
        displayName,
        role,
        supabase,
      });
      signOutCurrentBrowserSession(supabase, "/login");
    } catch {
      setPageNotice({
        tone: "error",
        message: t("accountSwitcherUnavailable"),
      });
      setBusyKey(null);
    }
  }, [
    alternateAccount,
    displayName,
    role,
    setBusyKey,
    setPageNotice,
    supabase,
    t,
  ]);

  const switchToAlternateAccount = useCallback(async () => {
    if (!alternateAccount) {
      return;
    }

    if (isStoredAccountReauthenticationRequired(alternateAccount)) {
      setStoredAlternateAccount(alternateAccount);
      setPageNotice({
        tone: "error",
        message: isStoredAccountExpired(alternateAccount)
          ? t("accountSwitcherExpiredNotice")
          : t("accountSwitcherSessionExpiredNotice"),
      });
      return;
    }

    setBusyKey("account-switcher-switch");
    setPageNotice(null);

    try {
      const result = await executeAccountSwitcherAction({
        action: { kind: "switch", target: alternateAccount },
        displayName,
        role,
        supabase,
      });
      if (result.status === "switched") {
        window.location.assign(result.destination);
        return;
      }

      setStoredAlternateAccount(getStoredAlternateAccount());
      setPageNotice({
        tone: "error",
        message: t("accountSwitcherSessionExpiredNotice"),
      });
      setBusyKey(null);
    } catch {
      setPageNotice({
        tone: "error",
        message: t("accountSwitcherUnavailable"),
      });
      setBusyKey(null);
    }
  }, [
    alternateAccount,
    displayName,
    role,
    setBusyKey,
    setPageNotice,
    supabase,
    t,
  ]);

  const removeAlternateAccount = useCallback(() => {
    removeStoredAlternateAccount();
    setStoredAlternateAccount(null);
    setPageNotice({
      tone: "success",
      message: t("accountSwitcherRemoved"),
    });
  }, [setPageNotice, t]);

  const clearSavedAccounts = useCallback(() => {
    clearAccountSwitcherStorage();
    setStoredAlternateAccount(null);
    setPageNotice({
      tone: "success",
      message: t("accountSwitcherCleared"),
    });
  }, [setPageNotice, t]);

  return {
    actions: {
      addAlternateAccount,
      clearSavedAccounts,
      reauthenticateAlternateAccount,
      removeAlternateAccount,
      switchToAlternateAccount,
    },
    alternateAccount,
    currentAccount,
    alternateNeedsReauthentication: alternateAccount
      ? isStoredAccountReauthenticationRequired(alternateAccount)
      : false,
    hasSavedAccountOnDevice: storedAlternateAccount !== null,
    hasSavedCurrentAccount,
  };
}
