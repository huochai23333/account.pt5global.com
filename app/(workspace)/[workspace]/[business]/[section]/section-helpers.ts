import type {
  WorkspaceBusinessKey,
  WorkspaceRouteConfig,
} from "@/lib/workspace-config";
import { getWorkspaceBusinessModule } from "@/lib/workspace-business-modules";
import type { WorkspaceSectionKey } from "@/lib/workspace-sections";

// 页面能力来自岗位配置；这里只判断是否存在该栏目，不能据此判断某条记录是否可读写。
export function isWorkspaceSectionEnabled(
  section: WorkspaceSectionKey,
  config: WorkspaceRouteConfig,
) {
  switch (section) {
    case "commission":
      return Boolean(config.pageVariants.commission);
    case "customers":
      return Boolean(config.pageVariants.customers);
    case "orders":
      return Boolean(config.pageVariants.orders);
    case "people":
      return Boolean(config.pageVariants.people);
    case "records":
      return config.pageVariants.records === true;
    case "referrals":
      return config.pageVariants.referrals === true;
    case "settings":
      return config.pageVariants.settings === true;
    case "tasks":
      return Boolean(config.pageVariants.tasks);
    case "team":
      return config.pageVariants.team === true;
    case "vip":
      return Boolean(config.pageVariants.vip);
  }
}

// Server 的完整字典按实际页面裁切后才传到 Client；缺少共享子命名空间会在浏览器渲染时失败。
export function getSectionNamespaces(
  section: string,
  config: WorkspaceRouteConfig,
  business: WorkspaceBusinessKey,
) {
  const namespaces = ["AdminSectionPlaceholder"];
  const businessModule = getWorkspaceBusinessModule(business);

  if (businessModule?.pageEntry === "wholesale") {
    namespaces.push("WholesaleBusiness");
    return namespaces;
  }

  if (section === "orders" && config.pageVariants.orders) {
    namespaces.push(
      "Orders",
      "OrdersUI",
      "DashboardPagination",
      "DashboardShared",
      // 普通订单的筛选卡、日期工具条和列表底栏统一读取这一组共享文案。
      "OrderListFramework",
    );
  }

  if (section === "commission" && config.pageVariants.commission) {
    namespaces.push("Commission", "DashboardPagination", "DashboardShared", "Tasks.shared");
  }

  if (section === "customers" && config.pageVariants.customers) {
    namespaces.push(
      config.pageVariants.customers === "admin"
        ? "TourismPeople"
        : "SalesmanPeople",
      "ClientBusinessAccess",
      "DashboardShared",
    );

    if (config.pageVariants.customers === "salesman") {
      namespaces.push("PersonPrivateNotes");
    }
  }

  if (section === "tasks") {
    if (config.pageVariants.tasks === "admin") {
      namespaces.push(
        "DashboardPagination",
        "DashboardShared",
        "ReviewsUI",
        "Tasks.admin",
        "Tasks.shared",
      );
    }

    if (config.pageVariants.tasks === "staff") {
      namespaces.push("DashboardPagination", "Tasks.salesman", "Tasks.shared");
    }
  }

  if (section === "people" && config.pageVariants.people) {
    namespaces.push(
      config.pageVariants.people === "admin"
        ? "TourismPeople"
        : "SalesmanPeople",
      "DashboardShared",
      "PersonPrivateNotes",
    );
  }

  if (section === "records" && config.pageVariants.records) {
    namespaces.push("OperationRecords", "DashboardShared");
  }

  if (section === "referrals" && config.pageVariants.referrals) {
    namespaces.push("DashboardShared", "Referrals");
  }

  if (section === "team" && config.pageVariants.team) {
    namespaces.push("TeamManagement");
  }

  if (section === "vip" && config.pageVariants.vip) {
    namespaces.push("BusinessVip", "DashboardShared");
  }

  if (section === "settings" && config.pageVariants.settings) {
    namespaces.push(
      "Commission",
      "DashboardShared",
      "Orders",
      "OrdersUI",
      "SystemSettings",
    );
  }

  return namespaces;
}
