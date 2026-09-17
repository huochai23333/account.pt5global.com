"use client";

import { useRef, useState } from "react";

import { getStoredAlternateAccount, isStoredAccountReauthenticationRequired } from "@/lib/account-switcher";
import { executeAccountSwitcherAction } from "@/lib/account-switcher-actions";
import type { AppRole } from "@/lib/auth-routing";
import { signOutCurrentBrowserSession } from "@/lib/browser-auth-session";
import { getBrowserSupabaseClient } from "@/lib/supabase";

type SwitchError = "session-expired" | "unavailable" | null;

/** 菜单只保存显示状态；添加、重新登录和切换的实际步骤与个人页共用。 */
export function useWorkspaceAccountSwitch(role: AppRole) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<SwitchError>(null);
  const pendingRef = useRef(false);

  const switchAccount = async () => {
    // ref 立即拦截同一渲染帧内的连击，pending 则负责按钮的可见禁用状态。
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setError(null);
    let navigationStarted = false;

    try {
      const supabase = getBrowserSupabaseClient();
      if (!supabase) throw new Error("account-switcher-unavailable");

      const { data, error: sessionError } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (sessionError || !user) throw new Error("account-switcher-session-missing");

      const alternate = getStoredAlternateAccount();
      const target = alternate?.userId === user.id ? null : alternate;
      const action = !target
        ? ({ kind: "add" } as const)
        : isStoredAccountReauthenticationRequired(target)
          ? ({ kind: "reauthenticate", target } as const)
          : ({ kind: "switch", target } as const);

      const result = await executeAccountSwitcherAction({
        action,
        // 显示名只用于菜单中的备用账号文字；角色权限始终来自已校验的工作区。
        displayName: typeof user.user_metadata?.name === "string"
          ? user.user_metadata.name
          : user.email ?? "",
        role,
        supabase,
      });

      if (result.status === "login-required") {
        signOutCurrentBrowserSession(supabase, "/login");
        navigationStarted = true;
        return;
      }

      if (result.status === "switched") {
        window.location.assign(result.destination);
        navigationStarted = true;
        return;
      }

      setError("session-expired");
    } catch {
      setError("unavailable");
    } finally {
      // 页面开始跳转后保持按钮禁用，避免新页面出现前再次提交同一切换。
      if (!navigationStarted) {
        pendingRef.current = false;
        setPending(false);
      }
    }
  };

  return { error, pending, setError, switchAccount };
}
