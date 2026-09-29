import { notFound } from "next/navigation";

import { DashboardConfirmProvider } from "@/components/dashboard/dashboard-confirm-provider";
import { MailWorkspaceClient } from "@/components/dashboard/mail/mail-workspace-client";
import { ScopedIntlProvider } from "@/components/i18n/scoped-intl-provider";
import { requireMailIdentity } from "@/lib/mail/mail-identity";
import { getMailPageData } from "@/lib/mail/mail-page-data";
import { getMailConnectionFeedback } from "@/lib/mail/mail-connection-page-data";
import { getWorkspaceConfigByRouteSegment } from "@/lib/workspace-config";

export default async function WorkspaceMailPage({ params, searchParams }: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { workspace } = await params;
  const config = getWorkspaceConfigByRouteSegment(workspace);
  if (!config || !["administrator", "salesman"].includes(config.authRole)) notFound();
  const identity = await requireMailIdentity(workspace);
  // 页面只调度两个独立读取模块，授权凭证核对留在服务端专用模块。
  const [data, connectionFeedback] = await Promise.all([
    getMailPageData(identity), getMailConnectionFeedback(identity, await searchParams),
  ]);

  return (
    <ScopedIntlProvider namespaces={["MailWorkspace"]}>
      <DashboardConfirmProvider>
        <MailWorkspaceClient
          backHref={`${config.basePath}/home`}
          connectionFeedback={connectionFeedback}
          initialAgents={[]}
          initialError={data.loadError}
          initialMetrics={null}
          initialOwnProfile={data.ownProfile}
          initialQuarantine={[]}
          initialRules={[]}
          initialSummary={data.summary}
          initialThreads={data.threads}
          initialNextCursor={data.nextCursor}
          isAdmin={identity.role === "administrator"}
          viewerId={identity.userId}
        />
      </DashboardConfirmProvider>
    </ScopedIntlProvider>
  );
}
