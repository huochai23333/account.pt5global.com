import type { ReferralCompanyRoot, ReferralTreeEdge } from "@/lib/referrals";
import type { AppRole, UserStatus } from "@/lib/user-self-service";
import { attachCompanyRoot } from "./referrals-company-root";

export type ReferralPerson = {
  userId: string;
  name: string | null;
  email: string | null;
  role: AppRole | null;
  status: UserStatus | null;
  isTeamSalesman: boolean;
  kind: "person" | "company";
};

export type ReferralGraph = {
  nodes: Map<string, ReferralPerson>;
  childEdgesByParent: Map<string, ReferralTreeEdge[]>;
  parentByChild: Map<string, string>;
};

// 只把数据库授权返回的人员与边组成索引。公司根节点由展示层单独补入。
export function buildReferralGraph(
  edges: ReferralTreeEdge[],
  companyRoots: ReferralCompanyRoot[],
  companyBranchName: string,
): ReferralGraph {
  const nodes = new Map<string, ReferralPerson>();
  const childEdgesByParent = new Map<string, ReferralTreeEdge[]>();
  const parentByChild = new Map<string, string>();

  for (const root of companyRoots) {
    nodes.set(root.user_id, {
      userId: root.user_id,
      name: root.name,
      email: root.email,
      role: root.role,
      status: root.status,
      isTeamSalesman: false,
      kind: "person",
    });
  }

  for (const edge of edges) {
    nodes.set(edge.referrer_user_id, {
      userId: edge.referrer_user_id,
      name: edge.referrer_name,
      email: edge.referrer_email,
      role: edge.referrer_role,
      status: edge.referrer_status,
      isTeamSalesman: edge.referrer_is_team_salesman,
      kind: "person",
    });

    nodes.set(edge.new_user_id, {
      userId: edge.new_user_id,
      name: edge.new_user_name,
      email: edge.new_user_email,
      role: edge.new_user_role,
      status: edge.new_user_status,
      isTeamSalesman: edge.new_user_is_team_salesman,
      kind: "person",
    });

    const existingChildEdges =
      childEdgesByParent.get(edge.referrer_user_id) ?? [];
    existingChildEdges.push(edge);
    childEdgesByParent.set(edge.referrer_user_id, existingChildEdges);
    parentByChild.set(edge.new_user_id, edge.referrer_user_id);
  }

  for (const [parentId, childEdges] of childEdgesByParent.entries()) {
    childEdges.sort((left, right) => {
      if (left.created_at !== right.created_at) {
        return left.created_at.localeCompare(right.created_at);
      }

      return getSortablePersonLabel(nodes.get(left.new_user_id)).localeCompare(
        getSortablePersonLabel(nodes.get(right.new_user_id)),
        "zh-CN",
      );
    });

    childEdgesByParent.set(parentId, childEdges);
  }

  attachCompanyRoot({
    childEdgesByParent,
    companyBranchName,
    nodes,
    parentByChild,
  });

  return {
    nodes,
    childEdgesByParent,
    parentByChild,
  };
}

export function getPersonDisplayName(person: ReferralPerson) {
  return person.name ?? person.email ?? person.userId;
}

export function getSortablePersonLabel(person: ReferralPerson | undefined) {
  if (!person) {
    return "";
  }

  return getPersonDisplayName(person);
}
