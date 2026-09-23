import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";

import type { AppRole } from "@/lib/auth-routing";
import type { WorkspaceBusinessKey } from "@/lib/workspace-business-access";

type TaskKey = "accounts" | "companyExpenses" | "creditOrders" | "exchangeRates" | "leads" | "mail" | "my" | "orders" | "referrals" | "reimbursements" | "settlements";
type TaskLink = { key: TaskKey; path: string };

/** 首页入口只链接当前岗位已经开放的页面；不把个人待办的数量误当成业务待处理数量。 */
function getRoleTasks(role: AppRole | null, workspaceBusinessAccess: WorkspaceBusinessKey[]): TaskLink[] {
  const wholesale = workspaceBusinessAccess.includes("wholesale");
  switch (role) {
    case "administrator":
      return [{ key: "accounts", path: "/admin/accounts" }, ...(wholesale ? [{ key: "leads" as const, path: "/admin/wholesale/leads" }] : []), { key: "mail", path: "/admin/mail" }];
    case "finance":
      return [...(wholesale ? [{ key: "settlements" as const, path: "/finance/wholesale/settlement-releases" }, { key: "creditOrders" as const, path: "/finance/wholesale/inventory-orders" }] : []), { key: "companyExpenses", path: "/finance/company-expenses" }];
    case "salesman":
      return [...(wholesale ? [{ key: "leads" as const, path: "/salesman/wholesale/leads" }, { key: "orders" as const, path: "/salesman/wholesale/orders" }] : []), { key: "mail", path: "/salesman/mail" }];
    case "client":
      return wholesale ? [{ key: "orders", path: "/client/wholesale/orders" }, { key: "creditOrders", path: "/client/wholesale/inventory-orders" }, { key: "referrals", path: "/client/wholesale/referrals" }] : [];
    case "operator":
      return [{ key: "reimbursements", path: "/operator/reimbursements" }, ...(wholesale ? [{ key: "orders" as const, path: "/operator/wholesale/orders" }] : []), { key: "exchangeRates", path: "/operator/settings" }];
    case "manager":
      return [...(wholesale ? [{ key: "orders" as const, path: "/manager/wholesale/orders" }, { key: "referrals" as const, path: "/manager/wholesale/referrals" }] : []), { key: "my", path: "/manager/my" }];
    case "recruiter":
      return [...(wholesale ? [{ key: "referrals" as const, path: "/recruiter/wholesale/referrals" }] : []), { key: "my", path: "/recruiter/my" }];
    default:
      return [];
  }
}

export function DashboardHomeRoleTasks({ role, workspaceBusinessAccess }: { role: AppRole | null; workspaceBusinessAccess: WorkspaceBusinessKey[] }) {
  const t = useTranslations("DashboardHome.roleTasks");
  const tasks = getRoleTasks(role, workspaceBusinessAccess);
  if (tasks.length === 0) return null;
  return (
    <section aria-labelledby="home-role-tasks-title" className="rounded-surface-panel border border-border-subtle bg-surface-panel p-4 sm:p-5">
      <h2 className="text-base font-bold text-content-strong" id="home-role-tasks-title">{t("title")}</h2>
      <p className="mt-1 text-sm text-content-muted">{t("description")}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {tasks.map((task) => (
          <Link className="flex min-h-12 items-center justify-between gap-2 rounded-control-default border border-border-subtle bg-surface-interactive px-3 py-2 font-semibold text-primary transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" href={task.path} key={task.key}>
            {t(task.key)}<ArrowUpRight className="size-4 shrink-0" />
          </Link>
        ))}
      </div>
    </section>
  );
}
