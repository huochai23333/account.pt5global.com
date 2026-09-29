import { notFound } from "next/navigation";
import dynamic from "next/dynamic";

import { ScopedIntlProvider } from "@/components/i18n/scoped-intl-provider";
import { getBusinessVipPageData } from "@/lib/business-vip-management";
import { getBusinessSettingsPageData } from "@/lib/business-settings";
import { getCustomerInventoryPageData } from "@/lib/customer-inventory";
import { getSalesLeadPageData } from "@/lib/sales-leads";
import { getServerSupabaseClient } from "@/lib/supabase-server";
import { redirectToWorkspaceAccessLimited } from "@/lib/server-auth";
import { getWholesalePageData } from "@/lib/wholesale";
import { getWholesaleSettlementReleasePageData } from "@/lib/wholesale-settlement-releases";
import { measureServerStage } from "@/lib/server-performance";
import {
  isWorkspaceWholesaleSectionKey,
  type WorkspaceRouteConfig,
  type WorkspaceWholesaleSectionKey,
} from "@/lib/workspace-config";

import type { WorkspaceSectionRenderer } from "./workspace-section-renderer";

const WholesaleClient = dynamic(() =>
  import("@/components/dashboard/wholesale/wholesale-client").then(
    (mod) => mod.WholesaleClient,
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

const WholesaleSettlementReleaseClient = dynamic(() =>
  import("@/components/dashboard/wholesale/wholesale-settlement-release-client").then(
    (mod) => mod.WholesaleSettlementReleaseClient,
  ),
);

const CustomerInventoryClient = dynamic(() =>
  import("@/components/dashboard/customer-inventory/customer-inventory-client").then(
    (mod) => mod.CustomerInventoryClient,
  ),
);

const SalesLeadsClient = dynamic(() =>
  import("@/components/dashboard/sales-leads/sales-leads-client").then(
    (mod) => mod.SalesLeadsClient,
  ),
);

export const renderWholesaleSectionPage: WorkspaceSectionRenderer = async ({
  config,
  section,
}) => {
  const wholesaleSection = getEnabledWholesaleSection(section, config);

  if (!wholesaleSection) {
    if (isWorkspaceWholesaleSectionKey(section)) {
      redirectToWorkspaceAccessLimited();
    }

    notFound();
  }

  const supabase = await getServerSupabaseClient();

  if (wholesaleSection === "vip") {
    const initialData = await getBusinessVipPageData(
      supabase,
      "wholesale",
      config.routeSegment === "admin" ? "admin" : "salesman",
    );

    return (
      <ScopedIntlProvider namespaces={["BusinessVip", "DashboardShared"]}>
        <BusinessVipClient initialData={initialData} />
      </ScopedIntlProvider>
    );
  }

  if (wholesaleSection === "settings") {
    const initialData = await getBusinessSettingsPageData(
      supabase,
      "wholesale",
    );

    return (
      <ScopedIntlProvider
        namespaces={[
          "Commission",
          "DashboardShared",
          "Orders",
          "OrdersUI",
          "SystemSettings",
        ]}
      >
        <BusinessSettingsClient initialData={initialData} />
      </ScopedIntlProvider>
    );
  }

  if (wholesaleSection === "settlement-releases") {
    const initialData = await getWholesaleSettlementReleasePageData(supabase);

    return (
      <ScopedIntlProvider namespaces={["DashboardShared", "WholesaleBusiness"]}>
        <WholesaleSettlementReleaseClient initialData={initialData} />
      </ScopedIntlProvider>
    );
  }

  if (wholesaleSection === "inventory-orders") {
    const initialData = await getCustomerInventoryPageData(supabase);

    return (
      <ScopedIntlProvider
        namespaces={[
          "CustomerInventory",
          "DashboardShared",
          // 库存订单复用批发订单的日期快捷范围，必须一并下发共享文案。
          "OrderListFramework",
        ]}
      >
        <CustomerInventoryClient initialData={initialData} />
      </ScopedIntlProvider>
    );
  }

  if (wholesaleSection === "leads") {
    const initialData = await getSalesLeadPageData(supabase);

    return (
      <ScopedIntlProvider namespaces={["DashboardShared", "DatePicker", "SalesLeads"]}>
        <SalesLeadsClient initialData={initialData} />
      </ScopedIntlProvider>
    );
  }

  const initialData = await measureServerStage(`page.wholesale.${wholesaleSection}`, () => getWholesalePageData(supabase, wholesaleSection));

  return (
    <ScopedIntlProvider
      namespaces={[
        "ClientBusinessAccess",
        "DashboardShared",
        // 批发订单、1688 认领和物流页面共用同一套订单列表框架文案。
        "OrderListFramework",
        "WholesaleBusiness",
      ]}
    >
      <WholesaleClient initialData={initialData} />
    </ScopedIntlProvider>
  );
};

function getEnabledWholesaleSection(
  section: string,
  config: WorkspaceRouteConfig,
): WorkspaceWholesaleSectionKey | null {
  if (!isWorkspaceWholesaleSectionKey(section)) {
    return null;
  }

  return config.wholesalePageVariants?.[section] ? section : null;
}
