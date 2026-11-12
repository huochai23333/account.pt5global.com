"use client";

import { useRef, type Dispatch, type SetStateAction } from "react";
import { useTranslations } from "next-intl";

import type { MailAgentProfile, MailThreadDetail, MailThreadListItem, MailThreadState } from "@/lib/mail/mail-types";

import { requestMailJson } from "./mail-workspace-request";

type ThreadChange =
  | { action: "state"; state: MailThreadState }
  | { action: "assign"; assignedMemberId: string };

type ThreadReceipt = {
  threadId: string;
  version: number;
  state?: MailThreadState;
  assignedMemberId?: string;
};

/** 负责状态和负责人修改；用同一会话、目标和版本核对回执后再更新界面。 */
export function useMailThreadMutations(input: {
  selected: MailThreadDetail | null;
  agents: MailAgentProfile[];
  setSelected: Dispatch<SetStateAction<MailThreadDetail | null>>;
  setThreads: Dispatch<SetStateAction<MailThreadListItem[]>>;
  setBusy: Dispatch<SetStateAction<string | null>>;
  setFeedback: Dispatch<SetStateAction<string | null>>;
  onAssigned: (threadId: string, memberId: string) => void;
}) {
  const t = useTranslations("MailWorkspace");
  const inFlight = useRef(false);

  async function change({ action, ...target }: ThreadChange) {
    const { selected, agents, setSelected, setThreads, setBusy, setFeedback } = input;
    if (!selected || inFlight.current) return;
    // 同一个界面帧可能多次触发按钮，先加同步锁，再设置显示状态。
    inFlight.current = true;
    const pendingKey = "state" in target ? `state:${target.state}` : "assign";
    const failed = t(action === "state" ? "threadStateFailed" : "threadAssignFailed");
    setBusy(pendingKey);
    setFeedback(null);
    try {
      const receipt = await requestMailJson<ThreadReceipt>(`/api/mail/threads/${selected.id}/${action}`, {
        method: "POST",
        body: JSON.stringify({ ...target, expectedVersion: selected.version }),
        signal: AbortSignal.timeout(30_000),
      });
      const targetMatches = "state" in target
        ? receipt.state === target.state
        : receipt.assignedMemberId === target.assignedMemberId;
      if (receipt.threadId !== selected.id || receipt.version !== selected.version + 1 || !targetMatches) {
        throw new Error(failed);
      }
      const patch = "state" in target ? target : {
        ...target,
        assignedDisplayName: agents.find((agent) => agent.memberId === target.assignedMemberId)?.displayName ?? null,
      };
      // 等待期间可能已打开另一封邮件，回执只更新原会话和未追上版本的行。
      const apply = <T extends MailThreadListItem>(thread: T): T =>
        thread.id === selected.id && thread.version < receipt.version
          ? { ...thread, ...patch, version: receipt.version }
          : thread;
      setSelected((current) => current ? apply(current) : null);
      setThreads((current) => current.map(apply));
      setFeedback(t(action === "state" ? "threadStateSaved" : "threadAssigned"));
      if ("assignedMemberId" in target) input.onAssigned(selected.id, target.assignedMemberId);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : failed);
    } finally {
      inFlight.current = false;
      setBusy((current) => current === pendingKey ? null : current);
    }
  }

  return {
    updateState: (state: MailThreadState) => change({ action: "state", state }),
    assign: (assignedMemberId: string) => change({ action: "assign", assignedMemberId }),
  };
}
