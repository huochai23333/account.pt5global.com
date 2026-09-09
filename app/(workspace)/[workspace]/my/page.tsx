import { notFound, redirect } from "next/navigation";

import { DashboardSharedMyClient } from "@/components/dashboard/dashboard-shared-my/dashboard-shared-my-client";
import { ScopedIntlProvider } from "@/components/i18n/scoped-intl-provider";
import { getServerSupabaseClient } from "@/lib/supabase-server";
import { getCurrentUserBundle } from "@/lib/user-self-service";
import { getWorkspaceConfigByRouteSegment } from "@/lib/workspace-config";

type WorkspaceMyPageProps = {
  params: Promise<{ workspace: string }>;
};

export default async function WorkspaceMyPage({
  params,
}: WorkspaceMyPageProps) {
  const { workspace } = await params;

  const workspaceConfig = getWorkspaceConfigByRouteSegment(workspace);
  if (!workspaceConfig) {
    notFound();
  }

  const supabase = await getServerSupabaseClient();
  const bundle = await getCurrentUserBundle(supabase);

  if (!bundle) {
    redirect("/login");
  }

  return (
    <ScopedIntlProvider
      namespaces={["DashboardMy", "DashboardMyState", "DashboardShared", "EmailReminders"]}
    >
      <DashboardSharedMyClient
        emailReminderHref={workspaceConfig.authRole === "client" ? null : "/email-reminders"}
        initialData={bundle}
      />
    </ScopedIntlProvider>
  );
}
