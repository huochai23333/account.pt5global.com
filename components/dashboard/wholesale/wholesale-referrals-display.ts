import { normalizeSearchText } from "@/lib/value-normalizers";
import type {
  WholesaleCustomer,
  WholesaleReferral,
} from "@/lib/wholesale";

export const WHOLESALE_COMPANY_REFERRAL_ROOT_ID =
  "__wholesale_company_referral_root__";

export type WholesaleReferralTreeNode = {
  children: WholesaleReferralTreeNode[];
  createdAt: string | null;
  customer: WholesaleCustomer | null;
  id: string;
  kind: "company" | "customer";
  name: string;
};

/**
 * 每个客户是一条分页记录，祖先名称只用于说明推荐路径。
 * 不能只分页公司根节点：公司下有很多客户时，那样仍然会一次渲染整棵树。
 */
export function flattenWholesaleReferralDirectory(nodes: WholesaleReferralTreeNode[]) {
  const rows: { node: WholesaleReferralTreeNode; path: string[] }[] = [];
  const seen = new Set<string>();
  const visit = (node: WholesaleReferralTreeNode, path: string[]) => {
    if (seen.has(node.id)) return;
    seen.add(node.id);
    // 保留真实下级人数；分页视图只渲染当前客户卡片，禁止继续展开整棵子树。
    if (node.kind === "customer") rows.push({ node, path });
    for (const child of node.children) visit(child, [...path, node.name]);
  };
  for (const node of nodes) visit(node, []);
  return rows;
}

export function buildWholesaleReferralTree({
  companyBranchName,
  customers,
  customersById,
  referrals,
}: {
  companyBranchName: string;
  customers: WholesaleCustomer[];
  customersById: Map<string, WholesaleCustomer>;
  referrals: WholesaleReferral[];
}) {
  if (customers.length === 0) {
    return [];
  }

  const nodeByCustomerId = new Map<string, WholesaleReferralTreeNode>(
    customers.map((customer) => [
      customer.id,
      createCustomerTreeNode(customer),
    ]),
  );
  const childIds = new Set<string>();

  for (const referral of referrals) {
    const referrerNode = nodeByCustomerId.get(referral.referrer_customer_id);
    const referredCustomer = customersById.get(referral.referred_customer_id);

    if (!referrerNode || !referredCustomer) continue;

    const referredNode =
      nodeByCustomerId.get(referral.referred_customer_id) ??
      createCustomerTreeNode(referredCustomer, referral.created_at);

    referredNode.createdAt = referral.created_at;
    referrerNode.children.push(referredNode);
    nodeByCustomerId.set(referral.referred_customer_id, referredNode);
    childIds.add(referral.referred_customer_id);
  }

  for (const node of nodeByCustomerId.values()) {
    node.children.sort(compareWholesaleReferralNodes);
  }

  const companyNode: WholesaleReferralTreeNode = {
    children: Array.from(nodeByCustomerId.values())
      .filter((node) => node.customer && !childIds.has(node.customer.id))
      .sort(compareWholesaleReferralNodes),
    createdAt: null,
    customer: null,
    id: WHOLESALE_COMPANY_REFERRAL_ROOT_ID,
    kind: "company",
    name: companyBranchName,
  };

  return [companyNode];
}

export function filterWholesaleReferralTree(
  nodes: WholesaleReferralTreeNode[],
  searchText: string,
): WholesaleReferralTreeNode[] {
  const searchValue = normalizeSearchText(searchText);

  if (!searchValue) return nodes;

  return nodes
    .map((node) => filterWholesaleReferralNode(node, searchValue))
    .filter((node): node is WholesaleReferralTreeNode => Boolean(node));
}

export function getWholesaleReferralNodeSearchText(
  node: WholesaleReferralTreeNode,
) {
  if (node.kind === "company") {
    return node.name;
  }

  return `${node.customer?.unique_name ?? node.name} ${
    node.customer?.other_names.join(" ") ?? ""
  }`;
}

function createCustomerTreeNode(
  customer: WholesaleCustomer,
  createdAt: string | null = null,
): WholesaleReferralTreeNode {
  return {
    children: [],
    createdAt,
    customer,
    id: customer.id,
    kind: "customer",
    name: customer.unique_name,
  };
}

function filterWholesaleReferralNode(
  node: WholesaleReferralTreeNode,
  searchValue: string,
): WholesaleReferralTreeNode | null {
  const matched = normalizeSearchText(
    getWholesaleReferralNodeSearchText(node),
  ).includes(searchValue);
  const children = node.children
    .map((child) => filterWholesaleReferralNode(child, searchValue))
    .filter((child): child is WholesaleReferralTreeNode => Boolean(child));

  if (!matched && children.length === 0) return null;

  return {
    ...node,
    children: matched ? node.children : children,
  };
}

function compareWholesaleReferralNodes(
  left: WholesaleReferralTreeNode,
  right: WholesaleReferralTreeNode,
) {
  return left.name.localeCompare(right.name, "zh-CN");
}
