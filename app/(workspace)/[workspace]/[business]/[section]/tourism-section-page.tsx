import type { ReactNode } from "react";

import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { AdminSectionPlaceholder } from "@/components/dashboard/admin-section-placeholder";
import { ScopedIntlProvider } from "@/components/i18n/scoped-intl-provider";
import { getAdminCommissionPageData } from "@/lib/admin-commission";
import { getAdminOperationRecordsPageData } from "@/lib/admin-operation-records";
import {
  getAdminOrdersPageData,
  parseAdminOrdersSearchParams,
} from "@/lib/admin-orders";
import { getAdminPeoplePageData } from "@/lib/admin-people";
import { getAdminTaskMediaLibraryData } from "@/lib/admin-task-media-library";
import { getAdminTaskReviewBoardData } from "@/lib/admin-task-reviews";
import { parseAdminTasksSearchParams } from "@/lib/admin-task-route";
import { getAdminTasksPageData } from "@/lib/admin-tasks";
import { getBusinessSettingsPageData } from "@/lib/business-settings";
import { getBusinessVipPageData } from "@/lib/business-vip-management";
import { getClientBusinessCandidates } from "@/lib/client-business-access";
import {
  getReferralsPageData,
  parseReferralBusinessBoardSearchParams,
} from "@/lib/referrals";
import { getSalesmanCommissionPageData } from "@/lib/salesman-commission";
import { getSalesmanPeoplePageData } from "@/lib/salesman-people";
import { parseSalesmanTasksSearchParams } from "@/lib/salesman-task-route";
import { getSalesmanTasksPageData } from "@/lib/salesman-tasks";
import { redirectToWorkspaceAccessLimited } from "@/lib/server-auth";
import { getServerSupabaseClient } from "@/lib/supabase-server";
import { getTeamManagementPageData } from "@/lib/team-management";
import { getWorkspaceHomeHref } from "@/lib/workspace-config";
import { getWorkspaceSectionKey } from "@/lib/workspace-sections";

import {
  getSectionNamespaces,
  isWorkspaceSectionEnabled,
} from "./section-helpers";
import type { WorkspaceSectionRenderer } from "./workspace-section-renderer";

const AdminCommissionClient = dynamic(() =>
  import("@/components/dashboard/commission/admin-commission-client").then(
    (mod) => mod.AdminCommissionClient,
  ),
);
const AdminOrdersClient = dynamic(() =>
  import("@/components/dashboard/admin-orders/admin-orders-client").then(
    (mod) => mod.AdminOrdersClient,
  ),
);
const TourismPeopleClient = dynamic(() =>
  import("@/components/dashboard/tourism-people/tourism-people-client").then(
    (mod) => mod.TourismPeopleClient,
  ),
);
const TourismCustomersClient = dynamic(() =>
  import("@/components/dashboard/tourism-people/tourism-customers-client").then(
    (mod) => mod.TourismCustomersClient,
  ),
);
const SalesmanPeopleClient = dynamic(() =>
  import("@/components/dashboard/salesman-people/salesman-people-client").then(
    (mod) => mod.SalesmanPeopleClient,
  ),
);
const AdminOperationRecordsClient = dynamic(() =>
  import("@/components/dashboard/admin-operation-records/admin-operation-records-client").then(
    (mod) => mod.AdminOperationRecordsClient,
  ),
);
const AdminTasksClient = dynamic(() =>
  import("@/components/dashboard/admin-tasks/admin-tasks-client").then(
    (mod) => mod.AdminTasksClient,
  ),
);
const ReferralsClient = dynamic(() =>
  import("@/components/dashboard/referrals/referrals-client").then(
    (mod) => mod.ReferralsClient,
  ),
);
const SalesmanCommissionClient = dynamic(() =>
  import("@/components/dashboard/commission/salesman-commission-client").then(
    (mod) => mod.SalesmanCommissionClient,
  ),
);
const SalesmanTasksClient = dynamic(() =>
  import("@/components/dashboard/salesman-tasks/salesman-tasks-client").then(
    (mod) => mod.SalesmanTasksClient,
  ),
);
const TeamManagementClient = dynamic(() =>
  import("@/components/dashboard/team-management/team-management-client").then(
    (mod) => mod.TeamManagementClient,
  ),
);
const BusinessVipClient = dynamic(() =>
  import("@/components/dashboard/business-vip/business-vip-client").then(
    (mod) => mod.BusinessVipClient,
  ),
);
const BusinessSettingsClient = dynamic(() =>
  import("@/components/dashboard/business-settings/business-settings-client").then(
    (mod) => mod.BusinessSettingsClient,
  ),
);

/**
 * 旅游业务入口集中选择领域查询与 Client。
 * 动态 Page 因此不再知道订单、任务、人员等领域的具体数据结构。
 */
export const renderTourismSectionPage: WorkspaceSectionRenderer = async ({
  business,
  config,
  searchParams,
  section,
}) => {
  const sectionKey = getWorkspaceSectionKey(section);

  if (!sectionKey) notFound();
  if (!isWorkspaceSectionEnabled(sectionKey, config)) {
    redirectToWorkspaceAccessLimited();
  }

  const namespaces = getSectionNamespaces(section, config, business);
  let content: ReactNode | null = null;

  if (section === "orders" && config.pageVariants.orders) {
    const supabase = await getServerSupabaseClient();
    const parsedSearch = parseAdminOrdersSearchParams(searchParams);
    const initialData = await getAdminOrdersPageData(supabase, {
      filters: parsedSearch.filters,
      includeOrderCosts: config.pageVariants.orders === "admin",
      page: parsedSearch.page,
    });
    content = (
      <AdminOrdersClient
        initialData={initialData}
        mode={config.pageVariants.orders}
      />
    );
  } else if (section === "commission") {
    const supabase = await getServerSupabaseClient();
    if (config.pageVariants.commission === "admin") {
      content = (
        <AdminCommissionClient
          initialData={await getAdminCommissionPageData(supabase)}
        />
      );
    } else if (config.pageVariants.commission === "salesman") {
      content = (
        <SalesmanCommissionClient
          initialData={await getSalesmanCommissionPageData(supabase)}
        />
      );
    }
  } else if (section === "tasks") {
    const supabase = await getServerSupabaseClient();
    if (config.pageVariants.tasks === "admin") {
      const [initialData, initialReviewData, initialMediaLibraryData] =
        await Promise.all([
          getAdminTasksPageData(supabase),
          getAdminTaskReviewBoardData(supabase),
          getAdminTaskMediaLibraryData(supabase),
        ]);
      content = (
        <AdminTasksClient
          initialData={initialData}
          initialMediaLibraryData={initialMediaLibraryData}
          initialReviewData={initialReviewData}
          initialView={parseAdminTasksSearchParams(searchParams)}
        />
      );
    } else if (config.pageVariants.tasks === "staff") {
      content = (
        <SalesmanTasksClient
          initialData={await getSalesmanTasksPageData(supabase)}
          initialView={parseSalesmanTasksSearchParams(searchParams)}
        />
      );
    }
  } else if (section === "customers" && config.pageVariants.customers) {
    const supabase = await getServerSupabaseClient();
    if (config.pageVariants.customers === "admin") {
      const [initialData, businessCandidates] = await Promise.all([
        getAdminPeoplePageData(supabase),
        getClientBusinessCandidates(supabase, "tourism"),
      ]);
      content = (
        <TourismCustomersClient
          businessCandidates={businessCandidates}
          initialData={initialData}
        />
      );
    } else {
      content = (
        <SalesmanPeopleClient
          initialData={await getSalesmanPeoplePageData(supabase)}
        />
      );
    }
  } else if (section === "people" && config.pageVariants.people) {
    const supabase = await getServerSupabaseClient();
    content =
      config.pageVariants.people === "admin" ? (
        <TourismPeopleClient
          initialData={await getAdminPeoplePageData(supabase)}
        />
      ) : (
        <SalesmanPeopleClient
          initialData={await getSalesmanPeoplePageData(supabase)}
        />
      );
  } else if (section === "records" && config.pageVariants.records) {
    content = (
      <AdminOperationRecordsClient
        initialData={await getAdminOperationRecordsPageData(
          await getServerSupabaseClient(),
        )}
      />
    );
  } else if (section === "referrals" && config.pageVariants.referrals) {
    const supabase = await getServerSupabaseClient();
    const businessBoard = parseReferralBusinessBoardSearchParams(searchParams);
    content = (
      <ReferralsClient
        initialData={await getReferralsPageData(supabase, { businessBoard })}
      />
    );
  } else if (section === "team" && config.pageVariants.team) {
    content = (
      <TeamManagementClient
        initialData={await getTeamManagementPageData(
          await getServerSupabaseClient(),
        )}
      />
    );
  } else if (section === "vip" && config.pageVariants.vip) {
    content = (
      <BusinessVipClient
        initialData={await getBusinessVipPageData(
          await getServerSupabaseClient(),
          "tourism",
          config.pageVariants.vip,
        )}
      />
    );
  } else if (section === "settings" && config.pageVariants.settings) {
    content = (
      <BusinessSettingsClient
        initialData={await getBusinessSettingsPageData(
          await getServerSupabaseClient(),
          "tourism",
        )}
      />
    );
  }

  if (!content) {
    const sectionT = await getTranslations("WorkspaceSections");
    const fallbackT = await getTranslations(
      `WorkspaceSections.fallbacks.${config.routeSegment}`,
    );
    content = (
      <AdminSectionPlaceholder
        description={
          sectionT(`${sectionKey}.description`) ?? fallbackT("description")
        }
        homeHref={getWorkspaceHomeHref(config)}
        title={sectionT(`${sectionKey}.title`) ?? fallbackT("title")}
      />
    );
  }

  return (
    <ScopedIntlProvider namespaces={namespaces}>{content}</ScopedIntlProvider>
  );
};
