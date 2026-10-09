import type { ReactNode } from "react";
import { AdminShell } from "@/components/dashboard/admin-shell";
import { ScopedIntlProvider } from "@/components/i18n/scoped-intl-provider";
import { requireDocumentWorkspace } from "@/lib/document-library/access";
import "../../../workspace.css";

/** 资料库独立于业务工作台布局，让未开通业务的员工仍能管理本人资料。 */
export default async function DocumentLayout({ children, params }: { children: ReactNode; params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;
  const { config, businesses } = await requireDocumentWorkspace(workspace);
  return <AdminShell config={config} workspaceBusinessAccess={businesses}><ScopedIntlProvider namespaces={["Documents", "CompanyTemplates", "DashboardFramework"]}>{children}</ScopedIntlProvider></AdminShell>;
}
