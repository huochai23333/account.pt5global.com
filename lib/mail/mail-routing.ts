export type RoutingAgent = {
  memberId: string;
  aliasLocalPart: string;
  refPrefix: string;
  displayName: string;
  enabled: boolean;
};

export type RoutingDecision = {
  assignedMemberId: string | null;
  source: "thread" | "recipient_history" | "alias" | "ref" | "unassigned";
  conflicting: boolean;
  nameHintMemberIds: string[];
  evidence: {
    historyMemberIds: string[];
    aliasMemberId: string | null;
    refMemberId: string | null;
  };
};

function findAliasMember(addresses: string[], agents: RoutingAgent[]) {
  const tags = addresses.flatMap((address) => {
    const match = address.trim().toLowerCase().match(/chinapt5\+([a-z0-9.-]{2,40})@gmail\.com/);
    return match?.[1] ? [match[1]] : [];
  });
  const ids = new Set(agents.filter((agent) => agent.enabled && tags.includes(agent.aliasLocalPart.toLowerCase())).map((agent) => agent.memberId));
  return ids.size === 1 ? [...ids][0] ?? null : null;
}

function findRefMember(content: string, agents: RoutingAgent[]) {
  const refs = [...content.matchAll(/\bPT5-\d{4}-([A-Z0-9]{2,16})-[A-Z0-9]{4,12}\b/gi)]
    .map((match) => match[1]?.toUpperCase());
  const ids = new Set(agents.filter((agent) => agent.enabled && refs.includes(agent.refPrefix.toUpperCase())).map((agent) => agent.memberId));
  return ids.size === 1 ? [...ids][0] ?? null : null;
}

/** 已有会话、已联系邮箱、收件别名和 Ref 是自动指派依据；姓名只作为管理员提示。 */
export function decideMailRouting(input: {
  knownAssignedMemberId?: string | null;
  recipientHistoryMemberIds?: string[];
  deliveredTo: string[];
  to: string[];
  cc: string[];
  subject: string;
  textBody: string;
  htmlBody: string;
}, agents: RoutingAgent[]): RoutingDecision {
  const searchable = `${input.subject}\n${input.textBody}\n${input.htmlBody}`;
  const nameHintMemberIds = agents
    .filter((agent) => agent.enabled && agent.displayName.trim() && searchable.toLowerCase().includes(agent.displayName.trim().toLowerCase()))
    .map((agent) => agent.memberId);
  if (input.knownAssignedMemberId) {
    return { assignedMemberId: input.knownAssignedMemberId, source: "thread", conflicting: false, nameHintMemberIds, evidence: { historyMemberIds: [], aliasMemberId: null, refMemberId: null } };
  }
  const historyMemberIds = [...new Set(input.recipientHistoryMemberIds ?? [])];
  if (historyMemberIds.length > 1) {
    return { assignedMemberId: null, source: "unassigned", conflicting: true, nameHintMemberIds, evidence: { historyMemberIds, aliasMemberId: null, refMemberId: null } };
  }
  if (historyMemberIds.length === 1) {
    const historyMemberId = historyMemberIds[0] ?? null;
    const enabled = agents.some((agent) => agent.enabled && agent.memberId === historyMemberId);
    return {
      assignedMemberId: enabled ? historyMemberId : null,
      source: enabled ? "recipient_history" : "unassigned",
      conflicting: false,
      nameHintMemberIds,
      evidence: { historyMemberIds, aliasMemberId: null, refMemberId: null },
    };
  }
  const aliasMemberId = findAliasMember([...input.deliveredTo, ...input.to, ...input.cc], agents);
  const refMemberId = findRefMember(searchable, agents);
  const conflicting = Boolean(aliasMemberId && refMemberId && aliasMemberId !== refMemberId);
  const evidence = { historyMemberIds, aliasMemberId, refMemberId };
  if (conflicting) return { assignedMemberId: null, source: "unassigned", conflicting, nameHintMemberIds, evidence };
  if (aliasMemberId) return { assignedMemberId: aliasMemberId, source: "alias", conflicting, nameHintMemberIds, evidence };
  if (refMemberId) return { assignedMemberId: refMemberId, source: "ref", conflicting, nameHintMemberIds, evidence };
  return { assignedMemberId: null, source: "unassigned", conflicting, nameHintMemberIds, evidence };
}
