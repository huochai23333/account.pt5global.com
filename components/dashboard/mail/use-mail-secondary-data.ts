"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { AdminMailMetrics, MailAgentProfile, MailIntakeRule, MailQuarantineItem } from "@/lib/mail/mail-types";
import { requestMailJson } from "./mail-workspace-request";
import type { MailWorkspaceView } from "./mail-workspace-tabs";

type Resource = "agents" | "metrics" | "quarantine" | "rules";
type LoadState = { state: "loading" | "ready" | "failed" };
type Setter<T> = Dispatch<SetStateAction<T>>;

/**
 * 次要资料在首屏出现后独立加载。各请求独立结束，失败不清空已显示的会话或已加载的面板。
 * 离开页面会取消请求；重试仅重读失败项，避免覆盖其他面板中尚未保存的编辑。
 */
export function useMailSecondaryData(input: {
  isAdmin: boolean; view: MailWorkspaceView;
  setAgents: Setter<MailAgentProfile[]>; setMetrics: Setter<AdminMailMetrics | null>;
  setQuarantine: (page: { items: MailQuarantineItem[]; totalCount: number }) => void; setRules: Setter<MailIntakeRule[]>;
}) {
  const { isAdmin, view, setAgents, setMetrics, setQuarantine, setRules } = input;
  const loaded = useRef(new Set<Resource>());
  const [attempt, setAttempt] = useState(0);
  const [states, setStates] = useState<Record<Resource, LoadState>>({
    agents: { state: "loading" }, metrics: { state: "loading" },
    quarantine: { state: "loading" }, rules: { state: "loading" },
  });
  useEffect(() => {
    const controller = new AbortController();
    const resources: Resource[] = isAdmin ? ["agents", "metrics", "quarantine", "rules"] : ["agents"];
    const load = async (resource: Resource) => {
      if (loaded.current.has(resource)) return;
      setStates((current) => ({ ...current, [resource]: { state: "loading" } }));
      try {
        // 每项请求单独限时；某个管理查询停住时，其他面板和核心邮件仍可使用。
        const init = { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]) };
        if (resource === "agents" && isAdmin) {
          const result = await requestMailJson<{ agents: MailAgentProfile[] }>("/api/mail/agents", init);
          if (!controller.signal.aborted) setAgents(result.agents);
        } else if (resource === "agents") {
          const result = await requestMailJson<{ agents: Pick<MailAgentProfile, "memberId" | "displayName">[] }>("/api/mail/assignable-agents", init);
          if (!controller.signal.aborted) setAgents(result.agents.map((agent) => ({ ...agent,
            role: "salesman", aliasLocalPart: "", refPrefix: "", senderDisplayName: "", signatureHtml: "",
            feishuBound: false, enabled: true, version: 1, suggestedAliasLocalPart: "", suggestedRefPrefix: "",
          })));
        } else if (resource === "metrics") {
          const metrics = await requestMailJson<AdminMailMetrics>("/api/mail/metrics", init);
          if (!controller.signal.aborted) setMetrics(metrics);
        } else if (resource === "quarantine") {
          const result = await requestMailJson<{ items: MailQuarantineItem[]; totalCount: number }>("/api/mail/quarantine?page=1", init);
          if (!controller.signal.aborted) setQuarantine(result);
        } else {
          const result = await requestMailJson<{ rules: MailIntakeRule[] }>("/api/mail/intake-rules", init);
          if (!controller.signal.aborted) setRules(result.rules);
        }
        if (controller.signal.aborted) return;
        loaded.current.add(resource);
        setStates((current) => ({ ...current, [resource]: { state: "ready" } }));
      } catch {
        if (!controller.signal.aborted) setStates((current) => ({ ...current, [resource]: { state: "failed" } }));
      }
    };
    resources.forEach((resource) => { void load(resource); });
    return () => controller.abort();
  }, [isAdmin, attempt, setAgents, setMetrics, setQuarantine, setRules]);
  // 收件箱也需要负责人名单。名单失败时在当前页提供重试，避免业务员只能刷新整页。
  const panelResources: Resource[] = view === "settings" && isAdmin ? ["agents", "metrics"]
    : view === "quarantine" ? ["quarantine"] : view === "rules" ? ["rules"]
      : view === "inbox" && states.agents.state === "failed" ? ["agents"] : [];
  const panelState = panelResources.some((key) => states[key].state === "failed") ? "failed"
    : panelResources.some((key) => states[key].state === "loading") ? "loading" : "ready";
  return { panelState, agentsState: states.agents.state, retry: () => setAttempt((value) => value + 1) };
}
