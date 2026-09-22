import {
  getAdminMailMetrics,
  getMailAgentProfile,
  getMailWorkspace,
  listMailIntakeRules,
  listAssignableMailAgents,
  listMailAgents,
  queryMailQuarantine,
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
    let ownProfile: Awaited<ReturnType<typeof getMailAgentProfile>> | null = null;
    let quarantine: Awaited<ReturnType<typeof queryMailQuarantine>>["items"] = [];
    let intakeRules: Awaited<ReturnType<typeof listMailIntakeRules>>["rules"] = [];
    let secondaryError: string | null = null;
    try {
      // 管理指标或人员配置偶发不可用时仍要保留核心会话，避免整个工作台显示为空。
      if (identity.role === "administrator") {
        const admin = await Promise.all([
          listMailAgents(identity),
          getAdminMailMetrics(identity),
          queryMailQuarantine(identity, { limit: 40 }),
          listMailIntakeRules(identity),
        ]);
        agents = admin[0].agents;
        metrics = admin[1];
        quarantine = admin[2].items;
        intakeRules = admin[3].rules;
      } else {
        const [result, profile] = await Promise.all([listAssignableMailAgents(identity), getMailAgentProfile(identity)]);
        ownProfile = profile;
        agents = result.agents.map((agent) => ({
          ...agent,
          aliasLocalPart: "",
          refPrefix: "",
          senderDisplayName: "",
          signatureHtml: "",
          feishuBound: false,
          enabled: true,
          version: 1,
          suggestedAliasLocalPart: "",
          suggestedRefPrefix: "",
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
      ownProfile,
      quarantine,
      intakeRules,
      loadError: secondaryError,
    };
  } catch (error) {
    return {
      summary: null,
      threads: [],
      agents: [],
      metrics: null,
      ownProfile: null,
      quarantine: [],
      intakeRules: [],
      loadError: error instanceof Error ? error.message : "公司邮箱暂时无法读取。",
    };
  }
}
