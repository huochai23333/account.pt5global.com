// 支持语言和偏好 Cookie 共用一处定义；这份配置不决定账号岗位或业务权限。
export const locales = ["zh", "en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "zh";
export const localeCookieName = "bs-locale";
