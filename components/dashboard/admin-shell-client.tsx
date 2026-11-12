/** 点击退出后先阻止重复提交，再由共享退出流程清理本地会话并提交服务端表单；按钮本身不宣称退出已经完成。 */
"use client";

import { InteractiveButton as DesignButton } from "@/components/ui/button";

import { useState } from "react";

import { LoaderCircle, LogOut } from "lucide-react";

import { signOutCurrentBrowserSession } from "@/lib/browser-auth-session";
import { getBrowserSupabaseClient } from "@/lib/supabase";

type AdminShellLogoutButtonProps = {
  label: string;
};

export function AdminShellLogoutButton({ label }: AdminShellLogoutButtonProps) {
  const supabase = getBrowserSupabaseClient();
  const [pending, setPending] = useState(false);

  const handleLogout = () => {
    if (pending) {
      return;
    }

    setPending(true);
    signOutCurrentBrowserSession(supabase);
  };

  return (
    <div className="mt-auto px-1">
      <DesignButton
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-surface-inset py-3 text-sm font-semibold text-content-muted transition-colors hover:bg-surface-inset disabled:cursor-not-allowed disabled:opacity-70"
        disabled={pending}
        onClick={handleLogout}
        type="button"
      >
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : <LogOut className="size-4" />}
        {label}
      </DesignButton>
    </div>
  );
}
