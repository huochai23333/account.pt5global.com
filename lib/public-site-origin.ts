import type { NextRequest } from "next/server";

import { companyConfig, getCompanyPublicOrigin } from "./company-config";
import { resolveRequestPublicOrigin } from "./public-site-origin-policy";

/**
 * 读取部署平台提供的公开地址，并把它收敛成只有协议和域名的 origin。
 * 部署人员如果漏写 https://、误填路径或加入账号密码，系统会退回公司默认域名，
 * 避免确认邮件和退出登录页面因为 new URL 收到无效基础地址而直接返回 500。
 */
export function getConfiguredPublicOrigin() {
  return getCompanyPublicOrigin();
}

/** 生产统一使用配置地址；开发环境才根据受限请求来源选择本机地址。 */
export function getRequestPublicOrigin(request: NextRequest) {
  // 生产环境忽略 Host 和转发头；只有本地开发可以切换到明确允许的本机地址。
  return resolveRequestPublicOrigin(request.headers, getConfiguredPublicOrigin(), companyConfig.defaultPublicOrigin, process.env.NODE_ENV === "production");
}
