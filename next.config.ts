import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const securityHeaders = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "::1"],
  experimental: {
    // 托管构建机可能报告远高于套餐限额的 CPU 数量；限制页面构建进程，避免耗尽可创建的线程。
    // 仅影响构建阶段的并行度，线上请求仍由原有 Node.js 服务处理。
    cpus: 2,
  },
  async headers() {
    return [
      {
        // 所有页面和接口都使用同一组基础浏览器安全响应头。
        headers: securityHeaders,
        source: "/:path*",
      },
      {
        // 报价单正文只允许本站嵌入；此规则必须排在全站 DENY 后面，才能覆盖同名响应头。
        // 正文接口仍会用 frame-ancestors 和 iframe 沙箱限制来源与脚本权限。
        headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }],
        source: "/api/company-templates/:templateId/content",
      },
      {
        // 本人的文档正文与指南仍然只允许本站嵌入，正文响应继续提供 CSP 沙箱。
        headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }],
        source: "/api/company-template-documents/:documentId/content",
      },
    ];
  },
  images: {
    qualities: [70, 75, 78, 90],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ehzveltsktfusrhtgzqt.supabase.co",
        pathname: "/**",
      },
    ],
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default withNextIntl(nextConfig);
