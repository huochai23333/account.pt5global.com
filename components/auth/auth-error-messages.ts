type AuthErrorShape = {
  code: string;
  message: string;
  status: number | null;
};

export function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (isRecord(error) && typeof error.message === "string") {
    return error.message;
  }

  return fallback;
}

export function isWeakPasswordAuthError(error: unknown) {
  const { code, message } = normalizeAuthError(error);

  return (
    code === "weak_password" ||
    code === "password_too_short" ||
    hasAny(message, [
      "weak_password",
      "leaked",
      "pwned",
      "password is too weak",
      "password should not",
      "password should be at least",
      "password should contain",
      "haveibeenpwned",
    ])
  );
}

export function isInvalidEmailAuthError(error: unknown) {
  const { code, message } = normalizeAuthError(error);

  return (
    code === "email_address_invalid" ||
    hasAny(message, [
      "invalid email",
      "email address is invalid",
      "email is invalid",
      "invalid format",
      "unable to validate email address",
    ])
  );
}

export function isUserAlreadyRegisteredAuthError(error: unknown) {
  const { code, message } = normalizeAuthError(error);

  return (
    code === "user_already_exists" ||
    hasAny(message, [
      "user already registered",
      "user already exists",
      "already been registered",
      "email address already in use",
    ])
  );
}

export function isEmailNotConfirmedAuthError(error: unknown) {
  const { code, message } = normalizeAuthError(error);

  return code === "email_not_confirmed" || message.includes("email not confirmed");
}

export function isInvalidCredentialsAuthError(error: unknown) {
  const { code, message } = normalizeAuthError(error);

  return (
    code === "invalid_credentials" ||
    message.includes("invalid login credentials")
  );
}

export function isTooFrequentAuthError(error: unknown) {
  const { code, message, status } = normalizeAuthError(error);

  return (
    status === 429 ||
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit" ||
    code === "too_many_requests" ||
    code === "email_rate_limit_exceeded" ||
    hasAny(message, [
      "for security purposes",
      "rate limit",
      "too many requests",
      "email rate limit",
      "over email send rate",
    ])
  );
}

/** 连接等待超时不等同于密码错误，登录页应提示用户检查网络并允许再次操作。 */
export function isAuthConnectionTimeoutError(error: unknown) {
  const { code, status } = normalizeAuthError(error);
  return code === "request_timeout" || status === 408 || status === 504;
}

export function isSignupDisabledAuthError(error: unknown) {
  const { code, message } = normalizeAuthError(error);

  return (
    code === "signup_disabled" ||
    hasAny(message, ["signups not allowed", "signup is disabled"])
  );
}

export function isEmailDeliveryAuthError(error: unknown) {
  const { code, message } = normalizeAuthError(error);

  return (
    code === "email_provider_disabled" ||
    code === "email_address_not_authorized" ||
    hasAny(message, [
      "error sending confirmation email",
      "error sending magic link email",
      "error sending recovery email",
      "error sending email",
      "unable to send email",
      "sending email",
      "smtp",
    ])
  );
}

export function isSamePasswordAuthError(error: unknown) {
  const { code, message } = normalizeAuthError(error);

  return (
    code === "same_password" ||
    hasAny(message, [
      "same password",
      "new password should be different",
      "different from the old password",
    ])
  );
}

export function isAuthSessionMissingError(error: unknown) {
  const { code, message } = normalizeAuthError(error);

  return (
    code === "session_not_found" ||
    code === "session_missing" ||
    message.includes("auth session missing")
  );
}

export function isUserNotFoundAuthError(error: unknown) {
  const { code, message } = normalizeAuthError(error);

  return code === "user_not_found" || message.includes("user not found");
}

function normalizeAuthError(error: unknown): AuthErrorShape {
  const message = getErrorMessage(error, "").toLowerCase();
  const code = getStringProperty(error, "code").toLowerCase();
  const status = getNumberProperty(error, "status");

  return { code, message, status };
}

function hasAny(message: string, fragments: string[]) {
  return fragments.some((fragment) => message.includes(fragment));
}

function getStringProperty(value: unknown, key: string) {
  if (!isRecord(value)) {
    return "";
  }

  const property = value[key];
  return typeof property === "string" ? property : "";
}

function getNumberProperty(value: unknown, key: string) {
  if (!isRecord(value)) {
    return null;
  }

  const property = value[key];
  return typeof property === "number" ? property : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
