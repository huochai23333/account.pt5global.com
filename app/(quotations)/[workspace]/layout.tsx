import type { ReactNode } from "react";
import { AdminShell } from "@/components/dashboard/admin-shell";
import { requireQuoteWorkspace } from "@/lib/quotations/access";

import "../../workspace.css";

/** 报价是内部员工的独立工具，即使当前没有业务工作区，也能使用同一工作台外观。 */
export default async function QuotationLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const { config, businesses } = await requireQuoteWorkspace(workspace);
  return <AdminShell config={config} workspaceBusinessAccess={businesses} wide>{children}</AdminShell>;
}
