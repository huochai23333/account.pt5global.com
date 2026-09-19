import type { ReactNode } from "react";

import { AdminShell } from "@/components/dashboard/admin-shell";
import { ScopedIntlProvider } from "@/components/i18n/scoped-intl-provider";
import { requireCompanyTemplateWorkspace } from "@/lib/company-templates/access";

import "../../../workspace.css";

/** 该独立路由组复用工作台外壳，同时允许没有已启用业务的内部岗位进入公司模板。 */
export default async function CompanyTemplatesLayout({ children, params }: {
  children: ReactNode;
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const { businesses, config } = await requireCompanyTemplateWorkspace(workspace);
  return <AdminShell config={config} workspaceBusinessAccess={businesses}>
    <ScopedIntlProvider namespaces={["CompanyTemplates"]}>{children}</ScopedIntlProvider>
  </AdminShell>;
}
