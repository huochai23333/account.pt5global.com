/** 沙箱文档只能发送就绪消息，父页面同时核对窗口来源与本次打开的随机标识。 */
export const COMPANY_TEMPLATE_READY = "pt5.company-template.ready";
export const COMPANY_TEMPLATE_LOAD_TOKEN = "loadToken";
export const COMPANY_TEMPLATE_LOAD_TIMEOUT_MS = 15_000;

export function isCompanyTemplateReadyMessage(value: unknown, token: string) {
  if (typeof value !== "object" || value === null) return false;
  const message = value as Record<string, unknown>;
  return message.type === COMPANY_TEMPLATE_READY && message.token === token;
}
