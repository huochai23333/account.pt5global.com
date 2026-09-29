import type { Locale } from "./locale";
import { resolveConfiguredPublicOrigin } from "./public-site-origin-policy";

export const companyConfig = {
  defaultPublicOrigin: "https://account.pt5global.com",
  // 旧统一系统本次发布只开放批发业务；旅游恢复必须同时配套新的数据库迁移和完整验收。
  enabledBusinessKeys: ["wholesale"],
  logoSrc: "/images/pt5-logo.png",
  supportEmail: "support@pt5global.com",
  text: {
    en: {
      accountName: "PT5 account",
      assistantName: "PT5 Assistant",
      brandSubtitle: "Curated Management Workspace",
      copyright: "© 2026 PT5 System",
      inviteAccessDescription:
        "An invite code is optional. Enter one to connect with your referrer, or continue directly without one.",
      productDescription:
        "Sign-in, registration and workspace flows for the PT5 System.",
      productName: "PT5 System",
      registerAsideTitle: "Request Access to<br></br>PT5 Workspace",
      registerHeaderTitle: "Create Your Account",
    },
    zh: {
      accountName: "PT5 账号",
      assistantName: "PT5 助手",
      brandSubtitle: "精选管理工作台",
      copyright: "© 2026 PT5 系统",
      inviteAccessDescription:
        "邀请码为选填项。有邀请码时可关联推荐人，没有邀请码也可以直接完成注册。",
      productDescription: "PT5 系统的登录、注册与业务工作台。",
      productName: "PT5 系统",
      registerAsideTitle: "申请加入<br></br>PT5 工作台",
      registerHeaderTitle: "注册 PT5 账号",
    },
  },
} as const;

export type EnabledCompanyBusinessKey =
  (typeof companyConfig.enabledBusinessKeys)[number];

export type CompanyText = (typeof companyConfig.text)[Locale];

export function getCompanyText(locale: Locale): CompanyText {
  return companyConfig.text[locale];
}

const reportedOriginReasons = new Set<string>();

/** 配置错误时保持认证入口可用；告警按原因去重，绝不输出原始环境变量。 */
export function getCompanyPublicOrigin() {
  const production = process.env.NODE_ENV === "production";
  const result = resolveConfiguredPublicOrigin(process.env.NEXT_PUBLIC_SITE_URL, companyConfig.defaultPublicOrigin, production);
  if (production && typeof window === "undefined" && result.reason && !reportedOriginReasons.has(result.reason)) {
    reportedOriginReasons.add(result.reason);
    console.warn("[public-site-origin]", { variable: "NEXT_PUBLIC_SITE_URL", reason: result.reason });
  }
  return result.origin;
}
