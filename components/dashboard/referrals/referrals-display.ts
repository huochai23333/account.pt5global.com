import type { ReferralTreeEdge } from "@/lib/referrals";
import type { AppRole } from "@/lib/user-self-service";
import { normalizeSearchText } from "@/lib/value-normalizers";

import {
  getRawErrorMessage,
  mapUserStatus,
  toErrorMessage,
  type DashboardSharedCopy,
} from "@/components/dashboard/dashboard-shared-ui";

import { getSortablePersonLabel, type ReferralGraph, type ReferralPerson } from "./referrals-graph";

type TranslationValues = Record<string, string | number>;
type ReferralTranslator = (key: string, values?: TranslationValues) => string;

export type ReferralsCopy = {
  errors: {
    noPermission: string;
  };
  roles: {
    administrator: string;
    client: string;
    finance: string;
    manager: string;
    operator: string;
    promoter: string;
    recruiter: string;
    salesman: string;
    unknown: string;
  };
  tree: {
    companyBranch: string;
    companyBranchDescription: string;
    currentAccount: string;
    downstreamCount: (count: number) => string;
    mainBranch: string;
    noEmail: string;
    referredOn: (date: string) => string;
    teamSales: string;
  };
};

export type ReferralTreeDisplayData = {
  matchingNodeIds: Set<string>;
  rootIds: string[];
  visibleNodeIds: Set<string>;
};

export function createReferralsCopy(t: ReferralTranslator): ReferralsCopy {
  return {
    errors: {
      noPermission: t("errors.noPermission"),
    },
    roles: {
      administrator: t("roles.administrator"),
      client: t("roles.client"),
      finance: t("roles.finance"),
      manager: t("roles.manager"),
      operator: t("roles.operator"),
      promoter: t("roles.promoter"),
      recruiter: t("roles.recruiter"),
      salesman: t("roles.salesman"),
      unknown: t("roles.unknown"),
    },
    tree: {
      companyBranch: t("tree.companyBranch"),
      companyBranchDescription: t("tree.companyBranchDescription"),
      currentAccount: t("tree.currentAccount"),
      downstreamCount: (count) => t("tree.downstreamCount", { count }),
      mainBranch: t("tree.mainBranch"),
      noEmail: t("tree.noEmail"),
      referredOn: (date) => t("tree.referredOn", { date }),
      teamSales: t("tree.teamSales"),
    },
  };
}

export function buildTreeDisplayData(
  graph: ReferralGraph,
  searchText: string,
  locale: "zh" | "en",
  copy: ReferralsCopy,
  sharedCopy: DashboardSharedCopy,
): ReferralTreeDisplayData {
  const normalizedSearchText = normalizeSearchText(searchText);
  const matchingNodeIds = new Set<string>();
  const visibleNodeIds = new Set<string>();

  if (!normalizedSearchText) {
    for (const nodeId of graph.nodes.keys()) {
      visibleNodeIds.add(nodeId);
    }
  } else {
    for (const [nodeId, person] of graph.nodes.entries()) {
      if (
        matchesReferralPerson(person, normalizedSearchText, copy, sharedCopy)
      ) {
        matchingNodeIds.add(nodeId);
      }
    }

    for (const matchingNodeId of matchingNodeIds) {
      collectAncestorNodeIds(
        graph.parentByChild,
        matchingNodeId,
        visibleNodeIds,
      );
      collectDescendantNodeIds(
        graph.childEdgesByParent,
        matchingNodeId,
        visibleNodeIds,
      );
      visibleNodeIds.add(matchingNodeId);
    }
  }

  const rootIds = Array.from(visibleNodeIds).filter((nodeId) => {
    const parentId = graph.parentByChild.get(nodeId);
    return !parentId || !visibleNodeIds.has(parentId);
  });

  rootIds.sort((left, right) =>
    getSortablePersonLabel(graph.nodes.get(left)).localeCompare(
      getSortablePersonLabel(graph.nodes.get(right)),
      locale === "zh" ? "zh-CN" : "en-US",
    ),
  );

  return {
    rootIds,
    visibleNodeIds,
    matchingNodeIds,
  };
}

export function getRoleLabel(role: AppRole | null, copy: ReferralsCopy) {
  if (role === "administrator") return copy.roles.administrator;
  if (role === "operator") return copy.roles.operator;
  if (role === "manager") return copy.roles.manager;
  if (role === "recruiter") return copy.roles.recruiter;
  if (role === "promoter") return copy.roles.promoter;
  if (role === "salesman") return copy.roles.salesman;
  if (role === "finance") return copy.roles.finance;
  if (role === "client") return copy.roles.client;
  return copy.roles.unknown;
}

export function toReferralErrorMessage(
  error: unknown,
  copy: ReferralsCopy,
  sharedCopy: DashboardSharedCopy,
) {
  const rawMessage = getRawErrorMessage(error);
  const baseMessage = toErrorMessage(error, sharedCopy);

  if (
    rawMessage.includes("row-level security") ||
    baseMessage === sharedCopy.errors.permission
  ) {
    return copy.errors.noPermission;
  }

  return baseMessage;
}

function collectAncestorNodeIds(
  parentByChild: Map<string, string>,
  startNodeId: string,
  visibleNodeIds: Set<string>,
) {
  let currentNodeId: string | undefined = startNodeId;

  while (currentNodeId) {
    visibleNodeIds.add(currentNodeId);
    currentNodeId = parentByChild.get(currentNodeId);
  }
}

function collectDescendantNodeIds(
  childEdgesByParent: Map<string, ReferralTreeEdge[]>,
  startNodeId: string,
  visibleNodeIds: Set<string>,
) {
  const stack = [startNodeId];

  while (stack.length > 0) {
    const currentNodeId = stack.pop();

    if (!currentNodeId) {
      continue;
    }

    visibleNodeIds.add(currentNodeId);

    for (const childEdge of childEdgesByParent.get(currentNodeId) ?? []) {
      if (!visibleNodeIds.has(childEdge.new_user_id)) {
        stack.push(childEdge.new_user_id);
      }
    }
  }
}

function matchesReferralPerson(
  person: ReferralPerson,
  normalizedSearchText: string,
  copy: ReferralsCopy,
  sharedCopy: DashboardSharedCopy,
) {
  if (person.kind === "company") {
    return [
      person.name,
      copy.tree.mainBranch,
      copy.tree.companyBranchDescription,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(normalizedSearchText);
  }

  const haystack = [
    person.name,
    person.email,
    getRoleLabel(person.role, copy),
    mapUserStatus(person.status, sharedCopy).label,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedSearchText);
}
