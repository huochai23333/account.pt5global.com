/**
 * 找回密码邮件接口只能证明 Auth 服务接受了请求，不能证明邮件已经投递。
 * 因此这里只返回“请求已接受”的凭证，界面必须继续使用提示色和进行中文案。
 */
export function requireAuthRequestAccepted(value: unknown, errorMessage: string) {
  if (!isRecord(value)) throw new Error(errorMessage);
  return value;
}

/**
 * 注册、验证码确认和密码更新都必须返回一个真实用户编号。
 * 如果传入预期邮箱，还会核对服务端返回的邮箱，避免串账号结果被当成完成。
 */
export function requireAuthUserReceipt(
  value: unknown,
  options: {
    errorMessage: string;
    expectedEmail?: string;
  },
) {
  if (!isRecord(value) || !isRecord(value.user)) {
    throw new Error(options.errorMessage);
  }

  const userId = readNonEmptyString(value.user.id);
  if (!userId) throw new Error(options.errorMessage);

  if (options.expectedEmail) {
    const returnedEmail = readNonEmptyString(value.user.email)?.toLowerCase();
    if (returnedEmail !== options.expectedEmail.trim().toLowerCase()) {
      throw new Error(options.errorMessage);
    }
  }

  return { user: value.user, userId };
}

/** 退出后必须重新读取本地 Auth 会话，并明确得到空会话。 */
export function requireSignedOutSessionReceipt(
  value: unknown,
  errorMessage: string,
) {
  if (!isRecord(value) || value.session !== null) {
    throw new Error(errorMessage);
  }
}

function readNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
