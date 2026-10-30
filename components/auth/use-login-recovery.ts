"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import { completeAccountSwitcherLogin } from "@/lib/account-switcher";
import { AuthFlowError } from "@/lib/auth-failure";
import { runWithAuthRequestSignal } from "@/lib/auth-request-transport";
import { clearCurrentBrowserSession } from "@/lib/browser-auth-session";
import { getVerifiedLoginContext } from "@/lib/login-context";
import { INITIAL_LOGIN_STATE, LoginRecoveryCoordinator } from "@/lib/login-recovery";
import { useSupabaseAuthSync } from "@/lib/use-supabase-auth-sync";

/** Hook 只接合 React 生命周期、SDK 事件和导航，状态机与权限读取各自独立。 */
export function useLoginRecovery(supabase: SupabaseClient | null) {
  const router = useRouter();
  const [state, setState] = useState(INITIAL_LOGIN_STATE);
  const coordinator = useRef<LoginRecoveryCoordinator | null>(null);

  useEffect(() => {
    if (!supabase) return;
    const current = new LoginRecoveryCoordinator({
      signIn: async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data.session;
      },
      readSession: async () => {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        return data.session;
      },
      verify: (session, email, onAuthenticated) => getVerifiedLoginContext(supabase, session, email, onAuthenticated),
      withSignal: (signal, task) => runWithAuthRequestSignal(supabase, signal, task),
      clearSession: () => clearCurrentBrowserSession(supabase),
      onVerified: async (context, session) => {
        // 权限已经确认后才完成账号切换，防止半途失败留下“已切换”的临时记录。
        const result = completeAccountSwitcherLogin({ role: context.role, session });
        if (result.status === "same-current-account" || result.status === "target-mismatch") {
          await clearCurrentBrowserSession(supabase);
          throw new AuthFlowError("accountMismatch");
        }
        if (result.status === "role-unavailable") throw new AuthFlowError("accessUnavailable");
        startTransition(() => router.replace(context.destination));
      },
      onState: setState,
      diagnose: (event) => console.warn(JSON.stringify(event)),
    });
    coordinator.current = current;
    const recoverOnline = () => current.onOnline();
    window.addEventListener("online", recoverOnline);
    return () => {
      window.removeEventListener("online", recoverOnline);
      current.dispose();
      coordinator.current = null;
    };
  }, [router, supabase]);

  useSupabaseAuthSync(supabase, {
    includeInitialSessionEvent: true,
    onAuthStateChange: ({ event, session }) => {
      if (event === "SIGNED_OUT") coordinator.current?.onSignedOut();
      if (["INITIAL_SESSION", "SIGNED_IN", "TOKEN_REFRESHED"].includes(event)) {
        coordinator.current?.onAuthSession(session);
      }
    },
  });

  return { state,
    signIn: (email: string, password: string) => coordinator.current?.signIn(email, password),
    recover: () => coordinator.current?.recover(),
  };
}
