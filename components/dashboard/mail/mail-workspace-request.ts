export class MailWorkspaceRequestError extends Error {
  constructor(message: string, readonly code: string | null) {
    super(message);
    this.name = "MailWorkspaceRequestError";
  }
}

/** 网络中断时保留当前界面状态，并把浏览器异常转换为可理解的提示。 */
export async function requestMailJson<T>(url: string, init?: RequestInit) {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { "content-type": "application/json", ...init?.headers },
    });
  } catch {
    throw new Error("网络连接中断，请检查网络后重试。当前内容已保留。");
  }
  const result = await response.json().catch(() => null) as (T & { error?: string; code?: string }) | null;
  if (!response.ok || !result) throw new MailWorkspaceRequestError(result?.error ?? "操作没有完成，请稍后重试。", result?.code ?? null);
  return result;
}
