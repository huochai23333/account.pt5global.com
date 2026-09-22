import { notFound } from "next/navigation";

import { DashboardConfirmProvider } from "@/components/dashboard/dashboard-confirm-provider";
import { MailWorkspaceClient } from "@/components/dashboard/mail/mail-workspace-client";
import { ScopedIntlProvider } from "@/components/i18n/scoped-intl-provider";
import { requireMailIdentity } from "@/lib/mail/mail-identity";
import { getMailPageData } from "@/lib/mail/mail-page-data";
import { getWorkspaceConfigByRouteSegment } from "@/lib/workspace-config";

export default async function WorkspaceMailPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;
  const config = getWorkspaceConfigByRouteSegment(workspace);
  if (!config || !["administrator", "salesman"].includes(config.authRole)) notFound();
  const identity = await requireMailIdentity(workspace);
  const data = await getMailPageData(identity);

  return (
    <ScopedIntlProvider namespaces={["MailWorkspace"]}>
      <DashboardConfirmProvider>
        <MailWorkspaceClient
          backHref={`${config.basePath}/home`}
          initialAgents={data.agents}
          initialError={data.loadError}
          initialMetrics={data.metrics}
          initialOwnProfile={data.ownProfile}
          initialQuarantine={data.quarantine}
          initialRules={data.intakeRules}
          initialSummary={data.summary}
          initialThreads={data.threads}
          isAdmin={identity.role === "administrator"}
        />
      </DashboardConfirmProvider>
    </ScopedIntlProvider>
  );
}
