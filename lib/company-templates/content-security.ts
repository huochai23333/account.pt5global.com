/** 模板与个人文档共用响应级沙箱，不授予同源或联网权限。 */
export const TEMPLATE_CONTENT_SECURITY_POLICY = [
  "sandbox allow-scripts allow-forms allow-modals allow-downloads allow-popups", "default-src 'none'",
  "style-src 'unsafe-inline'", "script-src 'unsafe-inline'", "img-src data: blob: http: https:",
  "font-src data:", "connect-src 'none'", "frame-src 'none'", "object-src 'none'", "base-uri 'none'",
  "form-action 'none'", "frame-ancestors 'self'",
].join("; ");
