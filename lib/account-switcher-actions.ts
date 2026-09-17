import type { SupabaseClient } from "@supabase/supabase-js";

import type { AppRole } from "./auth-routing";
import {
  createStoredAccountFromCurrentSession,
  isStoredAccountReauthenticationRequired,
  markStoredAlternateAccountNeedsReauthentication,
  restoreStoredAccountSession,
  saveStoredAlternateAccount,
  startAddAlternateAccount,
  startAlternateAccountReauthentication,
  type AccountSwitcherStoredAccount,
} from "./account-switcher";

type AccountSwitcherAction =
  | { kind: "add" }
  | { kind: "reauthenticate"; target: AccountSwitcherStoredAccount }
  | { kind: "switch"; target: AccountSwitcherStoredAccount };

export type AccountSwitcherActionResult =
  | { status: "login-required" }
  | { status: "reauthentication-required" }
  | { destination: string; status: "switched"; userId: string };

/**
 * 顶栏和个人页共用同一组账号动作。这里先读取当前会话的真实用户，
 * 再保存临时登录意图或恢复备用会话；页面提示和跳转留给各自的视图处理。
 */
export async function executeAccountSwitcherAction({
  action,
  displayName,
  role,
  supabase,
}: {
  action: AccountSwitcherAction;
  displayName: string;
  role: AppRole | null;
  supabase: SupabaseClient | null;
}): Promise<AccountSwitcherActionResult> {
  const current = await createStoredAccountFromCurrentSession({
    displayName,
    role,
    supabase,
  });

  if (action.kind === "add") {
    startAddAlternateAccount(current);
    return { status: "login-required" };
  }

  // 存储中的账号若恰好是当前本人，就不能把它当作可切换的另一个账号。
  if (current.userId === action.target.userId) {
    throw new Error("account-switcher-same-account");
  }

  if (action.kind === "reauthenticate") {
    startAlternateAccountReauthentication({
      currentAccount: current,
      targetAccount: action.target,
    });
    return { status: "login-required" };
  }

  if (isStoredAccountReauthenticationRequired(action.target)) {
    return { status: "reauthentication-required" };
  }

  let switchedUserId: string;
  try {
    const session = await restoreStoredAccountSession({
      account: action.target,
      supabase,
    });
    switchedUserId = session.user.id;
  } catch {
    // 只有目标会话确实恢复失败，才把该账号标记成需要重新登录。
    markStoredAlternateAccountNeedsReauthentication(action.target);
    return { status: "reauthentication-required" };
  }

  // 先确认 setSession 返回的身份，再保存原账号供下次切回。
  saveStoredAlternateAccount(current);
  return {
    destination: action.target.defaultPath,
    status: "switched",
    userId: switchedUserId,
  };
}
