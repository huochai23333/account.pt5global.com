import type { LoginRecoveryState } from "@/lib/login-recovery";

/** 技术类别在这里转换成日常语言消息键，表单不读取 SDK 异常或内部状态码。 */
export function getLoginFeedbackKey(state: LoginRecoveryState): string | null {
  if (!state.failure) return null;
  if (state.outcome === "partial_failed") return "finishPending";
  switch (state.failure) {
  case "connection": return "connectionInterrupted";
  case "timeout": return "connectionTimeout";
  case "invalidSession": return "sessionExpired";
  case "accountInactive": return "accountInactive";
  case "accountMismatch": return "accountMismatch";
  case "accessUnavailable": return "accessUnavailable";
  case "busy": return "recoveryBusy";
  default: return state.failure;
  }
}
