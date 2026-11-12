import type { Metadata } from "next";

import { getTranslations } from "next-intl/server";

import { getWorkspaceBusinessModule } from "@/lib/workspace-business-modules";
import {
  getWorkspaceConfigByRouteSegment,
  isEnabledWorkspaceBusinessKey,
  isRegisteredWorkspaceBusinessKey,
  isWorkspaceWholesaleSectionKey,
  type WorkspaceRouteConfig,
  type WorkspaceWholesaleSectionKey,
} from "@/lib/workspace-config";
import { getWorkspaceSectionKey } from "@/lib/workspace-sections";

import type { SectionPageProps } from "./types";

// 标题生成不读取业务记录，也不授权页面；真实准入在 Page、领域服务和数据库执行。
export async function generateWorkspaceSectionMetadata({
  params,
}: SectionPageProps): Promise<Metadata> {
  const { business, section, workspace } = await params;
  const config = getWorkspaceConfigByRouteSegment(workspace);

  if (!config || !isRegisteredWorkspaceBusinessKey(business)) {
    return {};
  }

  if (!isEnabledWorkspaceBusinessKey(business)) {
    return { title: "业务暂停服务" };
  }

  const businessModule = getWorkspaceBusinessModule(business);

  if (!businessModule) {
    return {};
  }

  if (businessModule.pageEntry === "wholesale") {
    const wholesaleSection = getEnabledWholesaleSection(section, config);

    if (!wholesaleSection) {
      return {};
    }

    const t = await getTranslations("WholesaleBusiness.sections");

    return {
      title: t(`${wholesaleSection}.title`),
    };
  }

  if (section === "orders" && config.pageVariants.orders) {
    const t = await getTranslations("Orders.metadata");

    return {
      title: t(config.pageVariants.orders),
    };
  }

  if (section === "commission" && config.pageVariants.commission) {
    const t = await getTranslations("Commission.metadata");

    return {
      title: t(
        config.pageVariants.commission === "admin"
          ? "adminTitle"
          : "salesmanTitle",
      ),
    };
  }

  if (section === "customers" && config.pageVariants.customers) {
    const t = await getTranslations(
      config.pageVariants.customers === "admin"
        ? "TourismPeople.metadata"
        : "SalesmanPeople.metadata",
    );

    return {
      title: t(
        config.pageVariants.customers === "admin" ? "customersTitle" : "title",
      ),
    };
  }

  if (section === "tasks" && config.pageVariants.tasks) {
    const t = await getTranslations("Tasks.metadata");

    return {
      title: t(config.pageVariants.tasks === "admin" ? "adminTitle" : "staffTitle"),
    };
  }

  if (section === "people" && config.pageVariants.people) {
    const t = await getTranslations(
      config.pageVariants.people === "admin"
        ? "TourismPeople.metadata"
        : "SalesmanPeople.metadata",
    );

    return {
      title: t("title"),
    };
  }

  if (section === "records" && config.pageVariants.records) {
    const t = await getTranslations("OperationRecords.metadata");

    return {
      title: t("title"),
    };
  }

  if (section === "vip" && config.pageVariants.vip) {
    const t = await getTranslations("BusinessVip.metadata");

    return {
      title: t("title"),
    };
  }

  if (section === "settings" && config.pageVariants.settings) {
    const t = await getTranslations("SystemSettings.tabs");

    return {
      title: t(`${business}.title`),
    };
  }

  const sectionT = await getTranslations("WorkspaceSections");
  const fallbackT = await getTranslations(
    `WorkspaceSections.fallbacks.${config.routeSegment}`,
  );
  const sectionKey = getWorkspaceSectionKey(section);

  if (!sectionKey) {
    return {};
  }

  return {
    title: sectionT(`${sectionKey}.title`) || fallbackT("title"),
  };
}

function getEnabledWholesaleSection(
  section: string,
  config: WorkspaceRouteConfig,
): WorkspaceWholesaleSectionKey | null {
  if (!isWorkspaceWholesaleSectionKey(section)) {
    return null;
  }

  return config.wholesalePageVariants?.[section] ? section : null;
}
