import type { ReferralTreeEdge } from "@/lib/referrals";

import type { ReferralPerson } from "./referrals-graph";

const COMPANY_REFERRAL_ROOT_ID = "__company_referral_root__";

export function attachCompanyRoot({
  childEdgesByParent,
  companyBranchName,
  nodes,
  parentByChild,
}: {
  childEdgesByParent: Map<string, ReferralTreeEdge[]>;
  companyBranchName: string;
  nodes: Map<string, ReferralPerson>;
  parentByChild: Map<string, string>;
}) {
  const rootIds = Array.from(nodes.keys())
    .filter((nodeId) => !parentByChild.has(nodeId))
    .sort((left, right) =>
      getSortablePersonLabel(nodes.get(left)).localeCompare(
        getSortablePersonLabel(nodes.get(right)),
        "zh-CN",
      ),
    );

  if (rootIds.length === 0) {
    return;
  }

  nodes.set(COMPANY_REFERRAL_ROOT_ID, {
    email: null,
    isTeamSalesman: false,
    kind: "company",
    name: companyBranchName,
    role: null,
    status: null,
    userId: COMPANY_REFERRAL_ROOT_ID,
  });

  // 公司节点只用于页面展示，不写入数据库推荐关系，避免影响佣金计算。
  const companyEdges = rootIds.map((rootId) => {
    const rootNode = nodes.get(rootId);

    return {
      created_at: "",
      is_company_root_edge: true,
      new_user_email: rootNode?.email ?? null,
      new_user_id: rootId,
      new_user_is_team_salesman: rootNode?.isTeamSalesman ?? false,
      new_user_name: rootNode?.name ?? null,
      new_user_role: rootNode?.role ?? null,
      new_user_status: rootNode?.status ?? null,
      referrer_email: null,
      referrer_is_team_salesman: false,
      referrer_name: companyBranchName,
      referrer_role: null,
      referrer_status: null,
      referrer_user_id: COMPANY_REFERRAL_ROOT_ID,
      relation_scope: "global" as const,
    };
  });

  childEdgesByParent.set(COMPANY_REFERRAL_ROOT_ID, companyEdges);

  for (const rootId of rootIds) {
    parentByChild.set(rootId, COMPANY_REFERRAL_ROOT_ID);
  }
}

function getSortablePersonLabel(person: ReferralPerson | undefined) {
  if (!person) {
    return "";
  }

  return person.name ?? person.email ?? person.userId;
}
