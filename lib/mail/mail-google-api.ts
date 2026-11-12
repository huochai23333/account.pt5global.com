import "server-only";

/** Gmail 请求统一携带公司邮箱的访问凭据，并保留供应商状态供后台判断是否需要重试。 */
export async function gmailJson<T>(accessToken: string, path: string, init?: RequestInit) {
  // 测试环境可替换为本机故障注入边界；生产环境未配置时始终使用 Gmail 官方地址。
  const baseUrl = process.env.MAIL_GOOGLE_API_BASE_URL?.replace(/\/$/, "")
    ?? "https://gmail.googleapis.com/gmail/v1/users/me";
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const error = new Error(`Gmail API 返回 ${response.status}：${await response.text()}`);
    Object.assign(error, { status: response.status });
    throw error;
  }
  return (await response.json()) as T;
}
