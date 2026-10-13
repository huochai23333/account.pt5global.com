"use client";

import { useMemo, useState } from "react";

import { useTranslations } from "next-intl";

import {
  ADMIN_OPERATION_RECORD_ACTIONS,
  ADMIN_OPERATION_RECORD_CATEGORIES,
  type AdminOperationRecordsPageData,
} from "@/lib/admin-operation-records";

import {
  operationRecordMatchesSearch,
  type OperationActionLabels,
  type OperationCategoryLabels,
  type OperationRoleLabels,
  type OperationStatusLabels,
} from "./admin-operation-records-display";

export function useAdminOperationRecordsViewModel({
  initialData,
}: {
  initialData: AdminOperationRecordsPageData;
}) {
  const t = useTranslations("OperationRecords");
  const [searchText, setSearchText] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");

  const categoryLabels = useMemo<OperationCategoryLabels>(
    () => ({
      account: t("categories.account"),
      profile: t("categories.profile"),
    }),
    [t],
  );
  const actionLabels = useMemo<OperationActionLabels>(
    () => ({
      account_changed: t("actions.accountChanged"),
      profile_approved: t("actions.profileApproved"),
      profile_rejected: t("actions.profileRejected"),
    }),
    [t],
  );
  const roleLabels = useMemo<OperationRoleLabels>(
    () => ({
      administrator: t("roles.administrator"),
      client: t("roles.client"),
      finance: t("roles.finance"),
      manager: t("roles.manager"),
      operator: t("roles.operator"),
      promoter: t("roles.promoter"),
      recruiter: t("roles.recruiter"),
      salesman: t("roles.salesman"),
    }),
    [t],
  );
  const statusLabels = useMemo<OperationStatusLabels>(
    () => ({
      active: t("statuses.active"),
      inactive: t("statuses.inactive"),
      suspended: t("statuses.suspended"),
    }),
    [t],
  );
  const filteredRecords = useMemo(() => {
    return initialData.records.filter((record) => {
      const categoryMatches =
        categoryFilter === "all" || record.category === categoryFilter;
      const actionMatches = actionFilter === "all" || record.action === actionFilter;

      return (
        categoryMatches &&
        actionMatches &&
        operationRecordMatchesSearch(
          record,
          searchText,
          categoryLabels,
          actionLabels,
        )
      );
    });
  }, [
    actionFilter,
    actionLabels,
    categoryFilter,
    categoryLabels,
    initialData.records,
    searchText,
  ]);

  return {
    actionFilter,
    actionLabels,
    actionOptions: ADMIN_OPERATION_RECORD_ACTIONS,
    categoryFilter,
    categoryLabels,
    categoryOptions: ADMIN_OPERATION_RECORD_CATEGORIES,
    filteredRecords,
    hasPermission: initialData.hasPermission,
    roleLabels,
    searchText,
    setActionFilter,
    setCategoryFilter,
    setSearchText,
    statusLabels,
  };
}
