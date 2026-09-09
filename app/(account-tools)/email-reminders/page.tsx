import { ScopedIntlProvider } from "@/components/i18n/scoped-intl-provider";
import { EmailRemindersClient } from "@/components/dashboard/email-reminders/email-reminders-client";
import { getDefaultWorkspaceBasePath } from "@/lib/auth-routing";
import { requireEmailConnectIdentity } from "@/lib/emailconnect/emailconnect-identity";
import { getEmailRemindersPageData } from "@/lib/emailconnect/email-reminders-data";
import { getServerSupabaseClient } from "@/lib/supabase-server";
import { getCurrentWorkspaceBusinessAccess } from "@/lib/workspace-business-access";

export default async function EmailRemindersPage() {
  const identity = await requireEmailConnectIdentity();
  const workspaceBasePath = getDefaultWorkspaceBasePath(identity.role);
  const [data, businesses] = await Promise.all([
    getEmailRemindersPageData(identity),
    getCurrentWorkspaceBusinessAccess(await getServerSupabaseClient()),
  ]);

  return (
    <ScopedIntlProvider namespaces={["EmailReminders", "DashboardShared"]}>
      <EmailRemindersClient
        backHref={businesses.length > 0 ? `${workspaceBasePath}/my` : "/business-unavailable"}
        initialAdminConnections={data.adminConnections}
        initialLoadError={data.loadError}
        initialRules={data.rules}
        initialSummary={data.summary}
        isAdministrator={identity.role === "administrator"}
        workspace={workspaceBasePath.slice(1)}
      />
    </ScopedIntlProvider>
  );
}
