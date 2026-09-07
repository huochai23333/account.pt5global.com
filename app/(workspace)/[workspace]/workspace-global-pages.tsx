import type { Metadata } from "next";

import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { ScopedIntlProvider } from "@/components/i18n/scoped-intl-provider";
import { getAdminPeoplePageData } from "@/lib/admin-people";
import { getAdminAnnouncementsPageData } from "@/lib/announcements";
import { getCompanyExpensesPageData } from "@/lib/company-expenses";
import { getExchangeRatesWorkspacePageData } from "@/lib/exchange-rates-page";
import { getOperatorReimbursementsPageData } from "@/lib/operator-reimbursements";
import { getServerSupabaseClient } from "@/lib/supabase-server";
import { redirectToWorkspaceAccessLimited } from "@/lib/server-auth";
import { getAdminWorkspaceFeedbackPageData } from "@/lib/workspace-feedback";
import {
  getWorkspaceConfigByRouteSegment,
  type WorkspaceRouteConfig,
} from "@/lib/workspace-config";

type WorkspaceGlobalPageProps = {
  params: Promise<{ workspace: string }>;
};

const AdminAnnouncementsClient = dynamic(() =>
  import("@/components/dashboard/announcements/announcements-client").then(
    (mod) => mod.AdminAnnouncementsClient,
  ),
);

const AdminPeopleClient = dynamic(() =>
  import("@/components/dashboard/admin-people/admin-people-client").then(
    (mod) => mod.AdminPeopleClient,
  ),
);

const AdminFeedbackClient = dynamic(() =>
  import("@/components/dashboard/admin-feedback/admin-feedback-client").then(
    (mod) => mod.AdminFeedbackClient,
  ),
);

const CompanyExpensesClient = dynamic(() =>
  import("@/components/dashboard/company-expenses/company-expenses-client").then(
    (mod) => mod.CompanyExpensesClient,
  ),
);

const OperatorReimbursementsClient = dynamic(() =>
  import("@/components/dashboard/operator-reimbursements/operator-reimbursements-client").then(
    (mod) => mod.OperatorReimbursementsClient,
  ),
);

const ExchangeRatesPageClient = dynamic(() =>
  import("@/components/dashboard/exchange-rates/exchange-rates-page-client").then(
    (mod) => mod.ExchangeRatesPageClient,
  ),
);

export async function generateWorkspaceAccountsMetadata(): Promise<Metadata> {
  const t = await getTranslations("AdminPeople.metadata");

  return {
    title: t("title"),
  };
}

export async function generateWorkspaceAnnouncementsMetadata(): Promise<Metadata> {
  const t = await getTranslations("Announcements.metadata");

  return {
    title: t("title"),
  };
}

export async function generateWorkspaceCompanyExpensesMetadata(): Promise<Metadata> {
  const t = await getTranslations("CompanyExpenses.metadata");

  return {
    title: t("title"),
  };
}

export async function generateWorkspaceOperatorReimbursementsMetadata(): Promise<Metadata> {
  const t = await getTranslations("OperatorReimbursements.metadata");

  return {
    title: t("title"),
  };
}

export async function generateWorkspaceFeedbackMetadata(): Promise<Metadata> {
  const t = await getTranslations("WorkspaceFeedback.metadata");

  return {
    title: t("title"),
  };
}

export async function generateWorkspaceSettingsMetadata(): Promise<Metadata> {
  const t = await getTranslations("SystemSettings.metadata");

  return {
    title: t("title"),
  };
}

export async function renderWorkspaceAccountsPage({
  params,
}: WorkspaceGlobalPageProps) {
  const config = await getGlobalPageConfig(params);

  if (!config.pageVariants.accounts) {
    redirectToWorkspaceAccessLimited();
  }

  const supabase = await getServerSupabaseClient();
  const initialData = await getAdminPeoplePageData(supabase);

  return (
    <ScopedIntlProvider
      namespaces={["AdminPeople", "DashboardShared", "PersonPrivateNotes"]}
    >
      <AdminPeopleClient initialData={initialData} />
    </ScopedIntlProvider>
  );
}

export async function renderWorkspaceAnnouncementsPage({
  params,
}: WorkspaceGlobalPageProps) {
  const config = await getGlobalPageConfig(params);

  if (!config.pageVariants.announcements) {
    redirectToWorkspaceAccessLimited();
  }

  const supabase = await getServerSupabaseClient();
  const initialData = await getAdminAnnouncementsPageData(supabase);

  return (
    <ScopedIntlProvider namespaces={["Announcements", "DashboardShared"]}>
      <AdminAnnouncementsClient initialData={initialData} />
    </ScopedIntlProvider>
  );
}

export async function renderWorkspaceCompanyExpensesPage({
  params,
}: WorkspaceGlobalPageProps) {
  const config = await getGlobalPageConfig(params);

  if (!config.pageVariants.companyExpenses) {
    redirectToWorkspaceAccessLimited();
  }

  const supabase = await getServerSupabaseClient();
  const initialData = await getCompanyExpensesPageData(supabase);

  return (
    <ScopedIntlProvider namespaces={["CompanyExpenses", "DashboardShared"]}>
      <CompanyExpensesClient initialData={initialData} />
    </ScopedIntlProvider>
  );
}

export async function renderWorkspaceOperatorReimbursementsPage({
  params,
}: WorkspaceGlobalPageProps) {
  const config = await getGlobalPageConfig(params);

  if (!config.pageVariants.operatorReimbursements) {
    redirectToWorkspaceAccessLimited();
  }

  const supabase = await getServerSupabaseClient();
  const initialData = await getOperatorReimbursementsPageData(supabase);

  return (
    <ScopedIntlProvider
      namespaces={["OperatorReimbursements", "DashboardShared", "DashboardPagination"]}
    >
      <OperatorReimbursementsClient initialData={initialData} />
    </ScopedIntlProvider>
  );
}

export async function renderWorkspaceFeedbackPage({
  params,
}: WorkspaceGlobalPageProps) {
  const config = await getGlobalPageConfig(params);

  if (!config.pageVariants.feedback) {
    redirectToWorkspaceAccessLimited();
  }

  const supabase = await getServerSupabaseClient();
  const initialData = await getAdminWorkspaceFeedbackPageData(supabase);

  return (
    <ScopedIntlProvider namespaces={["WorkspaceFeedback", "DashboardShared"]}>
      <AdminFeedbackClient initialData={initialData} />
    </ScopedIntlProvider>
  );
}

export async function renderWorkspaceSettingsPage({
  params,
}: WorkspaceGlobalPageProps) {
  const config = await getGlobalPageConfig(params);

  if (!config.pageVariants.settings) {
    redirectToWorkspaceAccessLimited();
  }

  const supabase = await getServerSupabaseClient();
  const initialData = await getExchangeRatesWorkspacePageData(supabase);

  return (
    <ScopedIntlProvider
      namespaces={[
        "Commission",
        "DashboardPagination",
        "ExchangeRates",
        "Orders",
        "OrdersUI",
        "SystemSettings",
      ]}
    >
      <ExchangeRatesPageClient
        homeHref={`${config.basePath}/home`}
        initialData={initialData}
      />
    </ScopedIntlProvider>
  );
}

async function getGlobalPageConfig(
  params: WorkspaceGlobalPageProps["params"],
): Promise<WorkspaceRouteConfig> {
  const { workspace } = await params;
  const config = getWorkspaceConfigByRouteSegment(workspace);

  if (!config) {
    notFound();
  }

  return config;
}
