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
    let currentProfile: Awaited<ReturnType<typeof getMailAgentProfile>> | null = null;
    let preparedAgents: Awaited<ReturnType<typeof listMailAgents>>["agents"] = [];
    let profileError: string | null = null;
    try {
      // 先确认当前账号的发件资料，再读取概况，保证首次打开页面即可获得真实的发信状态。
      // 管理员列表本身会完成全员建档，因此这里只查询一次，避免同一请求重复触发首次创建。
      if (identity.role === "administrator") {
        preparedAgents = (await listMailAgents(identity)).agents;
        currentProfile = preparedAgents.find((agent) => agent.memberId === identity.userId) ?? null;
      } else {
        currentProfile = await getMailAgentProfile(identity);
      }
    } catch (error) {
      profileError = error instanceof Error ? error.message : "发件设置暂时无法读取。";
    }
    const [summary, list] = await Promise.all([
      getMailWorkspace(identity),
      queryMailThreads(identity, { scope: identity.role === "administrator" ? "all" : "mine", limit: 40 }),
    ]);
    let agents: Awaited<ReturnType<typeof listMailAgents>>["agents"] = preparedAgents;
    let metrics: Awaited<ReturnType<typeof getAdminMailMetrics>> | null = null;
    const ownProfile: Awaited<ReturnType<typeof getMailAgentProfile>> | null = identity.role === "administrator" ? null : currentProfile;
    let quarantine: Awaited<ReturnType<typeof queryMailQuarantine>>["items"] = [];
    let intakeRules: Awaited<ReturnType<typeof listMailIntakeRules>>["rules"] = [];
    let secondaryError: string | null = profileError;
    try {
      // 管理指标或人员配置偶发不可用时仍要保留核心会话，避免整个工作台显示为空。
      if (identity.role === "administrator") {
        const admin = await Promise.all([
          getAdminMailMetrics(identity),
          queryMailQuarantine(identity, { limit: 40 }),
          listMailIntakeRules(identity),
        ]);
        metrics = admin[0];
        quarantine = admin[1].items;
        intakeRules = admin[2].rules;
      } else {
        const result = await listAssignableMailAgents(identity);
        agents = result.agents.map((agent) => ({
          ...agent,
          role: "salesman" as const,
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
      nextCursor: list.nextCursor,
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
      nextCursor: null,
      agents: [],
      metrics: null,
      ownProfile: null,
      quarantine: [],
      intakeRules: [],
      loadError: error instanceof Error ? error.message : "公司邮箱暂时无法读取。",
    };
  }
}
