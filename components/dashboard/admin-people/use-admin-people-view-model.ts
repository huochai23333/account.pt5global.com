"use client";

import { useMemo, useState } from "react";

import { useTranslations } from "next-intl";

import {
  ADMIN_PEOPLE_ROLE_OPTIONS,
  ADMIN_PEOPLE_STATUS_OPTIONS,
  isAdminPeopleRole,
  isAdminPeopleStatus,
  type AdminPeoplePageData,
  type AdminPeopleRole,
  type AdminPeopleStatus,
  type AdminPersonRow,
} from "@/lib/admin-people-contract";
import { usePersonPrivateNoteEditor } from "@/components/dashboard/person-notes/use-person-private-note-editor";

import {
  getPersonDisplayName,
  personMatchesSearch,
  type AdminPeopleRoleLabels,
  type AdminPeopleStatusLabels,
} from "./admin-people-display";
import { useAdminAccountEditor } from "./use-admin-account-editor";
import type { AdminPeopleFeedback } from "./admin-people-view-model-utils";

type FilterValue<T extends string> = T | "all";

export function useAdminPeopleViewModel({
  initialData,
}: {
  initialData: AdminPeoplePageData;
}) {
  const t = useTranslations("AdminPeople");
  const [people, setPeople] = useState(initialData.people);
  const [recentChanges, setRecentChanges] = useState(initialData.recentChanges);
  const [pendingAuthSyncUserIds, setPendingAuthSyncUserIds] = useState(initialData.pendingAuthSyncUserIds);
  const [feedback, setFeedback] = useState<AdminPeopleFeedback | null>(null);
  const [searchText, setSearchText] = useState("");
  const [roleFilter, setRoleFilter] =
    useState<FilterValue<AdminPeopleRole>>("all");
  const [statusFilter, setStatusFilter] =
    useState<FilterValue<AdminPeopleStatus>>("all");

  // 两种编辑器回填同一份页面目录，账号事务和备注写入各有自己的状态。
  const accountEditor = useAdminAccountEditor({
    currentViewerId: initialData.currentViewerId,
    pendingAuthSyncUserIds,
    setPendingAuthSyncUserIds,
    setFeedback,
    onSaved: (updated, changes) => {
      setPeople((rows) => rows.map((row) => row.user_id === updated.user_id ? updated : row));
      if (changes) setRecentChanges(changes);
    },
  });

  const roleLabels = useMemo<AdminPeopleRoleLabels>(
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

  const statusLabels = useMemo<AdminPeopleStatusLabels>(
    () => ({
      active: t("statuses.active"),
      inactive: t("statuses.inactive"),
      suspended: t("statuses.suspended"),
    }),
    [t],
  );

  const personNoteEditor = usePersonPrivateNoteEditor<AdminPersonRow>({
    getTargetName: (person) =>
      getPersonDisplayName(person, t("fallback.unnamedUser")),
    onSaved: (targetUserId, privateNote) => {
      setPeople((currentPeople) =>
        currentPeople.map((person) =>
          person.user_id === targetUserId
            ? { ...person, private_note: privateNote }
            : person,
        ),
      );
    },
    setFeedback,
  });
  const summary = useMemo(() => {
    const activeCount = people.filter(
      (person) => person.status === "active",
    ).length;
    const suspendedCount = people.filter(
      (person) => person.status === "suspended",
    ).length;
    const administratorCount = people.filter(
      (person) => person.role === "administrator",
    ).length;

    return {
      activeCount,
      administratorCount,
      suspendedCount,
      totalCount: people.length,
    };
  }, [people]);

  const filteredPeople = useMemo(
    () =>
      people.filter((person) => {
        if (roleFilter !== "all" && person.role !== roleFilter) {
          return false;
        }

        if (statusFilter !== "all" && person.status !== statusFilter) {
          return false;
        }

        return personMatchesSearch(person, searchText);
      }),
    [people, roleFilter, searchText, statusFilter],
  );

  const handleRoleFilterChange = (value: string) => {
    setRoleFilter(value === "all" || isAdminPeopleRole(value) ? value : "all");
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(
      value === "all" || isAdminPeopleStatus(value) ? value : "all",
    );
  };

  return {
    ...accountEditor,
    currentViewerId: initialData.currentViewerId,
    feedback,
    filteredPeople,
    hasPermission: initialData.hasPermission,
    people,
    personNoteEditor,
    recentChanges,
    roleFilter,
    roleLabels,
    roleOptions: ADMIN_PEOPLE_ROLE_OPTIONS,
    searchText,
    statusFilter,
    statusLabels,
    statusOptions: ADMIN_PEOPLE_STATUS_OPTIONS,
    summary,
    handleRoleFilterChange,
    handleStatusFilterChange,
    setSearchText,
  };
}
