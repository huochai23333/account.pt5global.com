/** 只保留可控类别，原始异常和请求正文不能进入界面或诊断日志。 */
export type AuthFailureKind =
  | "connection" | "timeout" | "invalidCredentials" | "emailNotConfirmed"
  | "invalidEmail" | "tooFrequent" | "invalidSession" | "accountInactive"
  | "accountMismatch" | "accessUnavailable" | "serviceUnavailable" | "busy";

export class AuthFlowError extends Error {
  constructor(public readonly kind: AuthFailureKind) {
    super(kind);
    this.name = "AuthFlowError";
  }
}

/** 网络失败没有可信的认证结论；只有明确失效才能触发会话清理。 */
export function classifyAuthFailure(error: unknown): AuthFailureKind {
  if (error instanceof AuthFlowError) return error.kind;
  const value = typeof error === "object" && error !== null
    ? error as Record<string, unknown> : {};
  const code = String(value.code ?? "").toLowerCase();
  const name = String(value.name ?? "");
  const message = String(value.message ?? "").toLowerCase();
  const status = typeof value.status === "number" ? value.status : null;
  if (code === "invalid_credentials" || message.includes("invalid login credentials")) return "invalidCredentials";
  if (code === "email_not_confirmed") return "emailNotConfirmed";
  if (code === "email_address_invalid") return "invalidEmail";
  if (status === 429 || /rate_limit|too_many_requests/.test(code)) return "tooFrequent";
  if (code === "request_timeout" || status === 408 || status === 504 || name === "TimeoutError" ||
    (name === "AuthRetryableFetchError" && message === "timeout")) return "timeout";
  if (name === "AuthSessionMissingError" || status === 401 || [
    "session_not_found", "session_missing", "bad_jwt", "jwt_expired",
    "refresh_token_not_found", "refresh_token_already_used", "invalid_refresh_token",
  ].includes(code)) return "invalidSession";
  if ((name === "AuthRetryableFetchError" && status === 0) ||
    /failed to fetch|network request failed|err_connection_reset|fetch failed/.test(message)) return "connection";
  return "serviceUnavailable";
}

export function isDefinitiveSessionFailure(error: unknown) {
  return classifyAuthFailure(error) === "invalidSession";
}

export function isRetryableAuthFailure(error: unknown) {
  return ["connection", "timeout", "serviceUnavailable"].includes(classifyAuthFailure(error));
}
