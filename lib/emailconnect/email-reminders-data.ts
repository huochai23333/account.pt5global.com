import {
  getAdminEmailConnectionHealth,
  getEmailConnectionSummary,
  getEmailPlatformRules,
} from "./emailconnect-client";
import type { EmailConnectIdentity } from "./emailconnect-types";

/** 页面查询只负责组合读取；授权、断开和规则保存分别走独立 mutation 接口。 */
export async function getEmailRemindersPageData(identity: EmailConnectIdentity) {
  try {
    const [summary, adminData] = await Promise.all([
      getEmailConnectionSummary(identity.externalUserId),
      identity.role === "administrator"
        ? Promise.all([
            getEmailPlatformRules(identity),
            getAdminEmailConnectionHealth(identity),
          ])
        : Promise.resolve(null),
    ]);
    return {
      summary,
      rules: adminData?.[0].rules ?? [],
      adminConnections: adminData?.[1].connections ?? [],
      loadError: null,
    };
  } catch (error) {
    return {
      summary: null,
      rules: [],
      adminConnections: [],
      loadError: error instanceof Error ? error.message : "邮件提醒状态暂时无法读取。",
    };
  }
}
