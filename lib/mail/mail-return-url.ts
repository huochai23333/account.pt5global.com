import type { AppRole } from "../auth-routing";

/** 返回路径由已验证角色决定，不能让用户输入把业务员送进管理员邮件页。 */
export function getMailReturnPath(provider: "google" | "feishu", role: AppRole) {
  return provider === "google" || role === "administrator" ? "/admin/mail" : "/salesman/mail";
}

/** 仅接受对应邮件页；清除查询及片段，授权结果由后台凭证和实际绑定状态决定。 */
export function getSafeMailReturnUrl(value: string | null, origin: string, provider: "google" | "feishu", role: AppRole) {
  const fallback = new URL(getMailReturnPath(provider, role), origin);
  if (!value || value.includes("\\") || value.startsWith("//")) return fallback.toString();
  try {
    const candidate = new URL(value, origin);
    if (candidate.origin !== fallback.origin || candidate.pathname !== fallback.pathname || candidate.username || candidate.password) return fallback.toString();
    return fallback.toString();
  } catch { return fallback.toString(); }
}
