import {
  getAdminMailMetrics,
  getMailWorkspace,
  listAssignableMailAgents,
  listMailAgents,
  queryMailThreads,
} from "./mail-service";
import type { MailIdentity } from "./mail-types";

/** 页面只组合首屏查询；筛选、写操作和弹窗状态分别由对应模块负责。 */
export async function getMailPageData(identity: MailIdentity) {
  try {
    const [summary, list] = await Promise.all([
      getMailWorkspace(identity),
      queryMailThreads(identity, { scope: identity.role === "administrator" ? "all" : "mine", limit: 40 }),
    ]);
    let agents: Awaited<ReturnType<typeof listMailAgents>>["agents"] = [];
    let metrics: Awaited<ReturnType<typeof getAdminMailMetrics>> | null = null;
    let secondaryError: string | null = null;
    try {
      // 管理指标或人员配置偶发不可用时仍要保留核心会话，避免整个工作台显示为空。
      if (identity.role === "administrator") {
        const admin = await Promise.all([listMailAgents(identity), getAdminMailMetrics(identity)]);
        agents = admin[0].agents;
        metrics = admin[1];
      } else {
        const result = await listAssignableMailAgents(identity);
        agents = result.agents.map((agent) => ({
          ...agent,
          aliasLocalPart: "",
          refPrefix: "",
          senderDisplayName: "",
          signatureHtml: "",
          feishuBound: false,
          enabled: true,
        }));
      }
    } catch (error) {
      secondaryError = error instanceof Error ? error.message : "邮件管理资料暂时无法读取。";
    }
    return {
      summary,
      threads: list.threads,
      agents,
      metrics,
      loadError: secondaryError,
    };
  } catch (error) {
    return {
      summary: null,
      threads: [],
      agents: [],
      metrics: null,
      loadError: error instanceof Error ? error.message : "公司邮箱暂时无法读取。",
    };
  }
}
