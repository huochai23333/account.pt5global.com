import type { Session, SupabaseClient } from "@supabase/supabase-js";

import { AuthFlowError } from "./auth-failure";
import { getCurrentAppAccessContext } from "./current-app-access-context";
import { getVerifiedWorkspaceBusinesses } from "./verified-workspace-business";
import { getSignedInWorkspaceDestination } from "./workspace-business-availability";

/** 身份由 Auth 服务核验；邮箱只检查本次目标一致性，不能用作权限来源。 */
export async function getVerifiedLoginContext(supabase: SupabaseClient, session: Session, expectedEmail?: string,
  onAuthenticated?: () => void) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new AuthFlowError("invalidSession");
  if (user.id !== session.user.id) throw new AuthFlowError("accountMismatch");
  if (expectedEmail && user.email?.trim().toLowerCase() !== expectedEmail.trim().toLowerCase()) {
    throw new AuthFlowError("accountMismatch");
  }
  onAuthenticated?.();
  const [access, businesses] = await Promise.all([
    getCurrentAppAccessContext(supabase), getVerifiedWorkspaceBusinesses(supabase),
  ]);
  if (access.status === "inactive" || access.status === "suspended") throw new AuthFlowError("accountInactive");
  if (access.status !== "active" || !access.role) throw new AuthFlowError("accessUnavailable");
  const { data: latest, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  // 跨标签切换账号可能发生在两个权限读取之间，不能把前后不同账号的结果拼在一起。
  if (!latest.session || latest.session.user.id !== user.id) throw new AuthFlowError("accountMismatch");
  return { user, role: access.role, businesses, destination: getSignedInWorkspaceDestination(access.role, businesses) };
}

export type VerifiedLoginContext = Awaited<ReturnType<typeof getVerifiedLoginContext>>;
