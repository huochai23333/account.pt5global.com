import { getMailAgentProfile, getMailWorkspace, queryMailThreads } from "./mail-service";
import { measureServerStage } from "../server-performance";
import type { MailIdentity } from "./mail-types";

/** 首屏只准备本人发件状态与会话；全员设置、统计、隔离区及规则由独立请求读取。 */
export function getMailPageData(identity: MailIdentity) {
  return measureServerStage("page.mail.core", async () => {
    try {
      const listPromise = measureServerStage("mail.threads", () => queryMailThreads(identity, {
        scope: identity.role === "administrator" ? "all" : "mine", limit: 40,
      })).then((value) => ({ value }), (error: unknown) => ({ error }));
      // 本人首次建档成功后再读取可发送状态，不必等待其他人员建档。
      let ownProfile: Awaited<ReturnType<typeof getMailAgentProfile>> | null = null;
      let loadError: string | null = null;
      try { ownProfile = await measureServerStage("mail.sender-profile", () => getMailAgentProfile(identity)); }
      catch { loadError = "发件设置暂时无法读取。"; }
      const [summary, list] = await Promise.all([
        measureServerStage("mail.summary", () => getMailWorkspace(identity)), listPromise,
      ]);
      if ("error" in list) throw list.error;
      return { summary, threads: list.value.threads, nextCursor: list.value.nextCursor, ownProfile, loadError };
    } catch {
      return { summary: null, threads: [], nextCursor: null, ownProfile: null, loadError: "公司邮箱暂时无法读取，请稍后重试。" };
    }
  });
}
