export type EmailConnectConfig = {
  baseUrl: string;
  installationId: string;
  signingSecret: string;
};

/** 插件未配置时页面仍能显示友好说明，但不会伪造连接状态或尝试外部请求。 */
export function getEmailConnectConfig(): EmailConnectConfig | null {
  const baseUrl = process.env.EMAILCONNECT_BASE_URL;
  const installationId = process.env.EMAILCONNECT_INSTALLATION_ID;
  const signingSecret = process.env.EMAILCONNECT_SIGNING_SECRET;
  if (!baseUrl || !installationId || !signingSecret) return null;
  return { baseUrl, installationId, signingSecret };
}
