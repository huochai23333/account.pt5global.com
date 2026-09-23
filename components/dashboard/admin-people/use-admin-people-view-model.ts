"use client";

import { useMemo, useState } from "react";

import { useTranslations } from "next-intl";

import {
  ADMIN_PEOPLE_CITY_MAX_LENGTH,
  ADMIN_PEOPLE_ROLE_OPTIONS,
  ADMIN_PEOPLE_STATUS_OPTIONS,
  isAdminPeopleRole,
  isAdminPeopleStatus,
  type AdminPeoplePageData,
  type AdminPeopleRole,
  type AdminPeopleStatus,
  type AdminPersonRow,
} from "@/lib/admin-people";
import { usePersonPrivateNoteEditor } from "@/components/dashboard/person-notes/use-person-private-note-editor";

import {
  getPersonDisplayName,
  personMatchesSearch,
  type AdminPeopleRoleLabels,
  type AdminPeopleStatusLabels,
} from "./admin-people-display";
import {
  normalizeAdminPeopleErrorCode,
  readAdminPeopleUpdateResponse,
  type AdminPeopleFeedback,
} from "./admin-people-view-model-utils";

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
  const [selectedPerson, setSelectedPerson] = useState<AdminPersonRow | null>(
    null,
  );
  const [draftRole, setDraftRole] = useState<AdminPeopleRole>("client");
  const [draftStatus, setDraftStatus] = useState<AdminPeopleStatus>("inactive");
  const [draftCity, setDraftCity] = useState("");
  const [draftNote, setDraftNote] = useState("");
  const [saving, setSaving] = useState(false);

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

  const selectedPersonName = selectedPerson
    ? getPersonDisplayName(selectedPerson, t("fallback.unnamedUser"))
    : "";
  const dialogOpen = selectedPerson !== null;
  const selectedPersonIsCurrentViewer =
    selectedPerson?.user_id === initialData.currentViewerId;
  const selectedPersonAuthSyncPending = selectedPerson !== null && pendingAuthSyncUserIds.includes(selectedPerson.user_id);
  const accountWillChange =
    selectedPerson !== null &&
    (selectedPerson.role !== draftRole ||
      selectedPerson.status !== draftStatus);
  const cityWillChange =
    selectedPerson !== null &&
    (selectedPerson.city ?? "").trim() !== draftCity.trim();
  const hasDraftChange = accountWillChange || cityWillChange;
  const canSaveDraft =
    dialogOpen && hasDraftChange && !selectedPersonIsCurrentViewer && !saving;

  const openAccountDialog = (person: AdminPersonRow) => {
    setFeedback(null);
    setSelectedPerson(person);
    setDraftRole(person.role ?? "client");
    setDraftStatus(person.status);
    setDraftCity(person.city ?? "");
    setDraftNote("");
  };

  const closeAccountDialog = () => {
    if (saving) {
      return;
    }

    setSelectedPerson(null);
  };

  const handleDraftRoleChange = (value: string) => {
    if (isAdminPeopleRole(value)) {
      setDraftRole(value);
    }
  };

  const handleDraftCityChange = (value: string) => {
    setDraftCity(value.slice(0, ADMIN_PEOPLE_CITY_MAX_LENGTH));
  };

  const handleDraftStatusChange = (value: string) => {
    if (isAdminPeopleStatus(value)) {
      setDraftStatus(value);
    }
  };

  const handleRoleFilterChange = (value: string) => {
    setRoleFilter(value === "all" || isAdminPeopleRole(value) ? value : "all");
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(
      value === "all" || isAdminPeopleStatus(value) ? value : "all",
    );
  };

  const handleSaveAccountChange = async () => {
    if (!selectedPerson || !canSaveDraft) {
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      let savedAccountChange = false;
      let savedOutcome: "success" | "partial_failed" = "success";

      if (accountWillChange || cityWillChange) {
        const response = await fetch("/api/admin/people/account", {
          body: JSON.stringify({
            targetUserId: selectedPerson.user_id,
            expected: {
              role: selectedPerson.role,
              status: selectedPerson.status,
              city: selectedPerson.city,
              workspace_business_access: selectedPerson.workspace_business_access,
              salesman_business_boards: selectedPerson.salesman_business_boards,
            },
            nextRole: draftRole,
            nextStatus: draftStatus,
            nextCity: draftCity,
            note: draftNote,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        });
        const result = await readAdminPeopleUpdateResponse(response);

        if (!response.ok) {
          setFeedback({
            tone: "error",
            message: t(`errors.${normalizeAdminPeopleErrorCode(result.error)}`),
          });
          return;
        }

        if (!result.person) {
          setFeedback({
            tone: "error",
            message: t("errors.unknown"),
          });
          return;
        }

        savedAccountChange = true;
        savedOutcome = result.outcome ?? "partial_failed";
        // Auth 同步失败后保留待处理人员，刷新页面也会从数据库重新读到这条补偿记录。
        setPendingAuthSyncUserIds((ids) => savedOutcome === "partial_failed"
          ? [...new Set([...ids, selectedPerson.user_id])]
          : ids.filter((id) => id !== selectedPerson.user_id));

        setPeople((currentPeople) =>
          currentPeople.map((person) =>
            person.user_id === result.person?.user_id ? result.person : person,
          ),
        );

        if (result.recentChanges) {
          setRecentChanges(result.recentChanges);
        }
      }

      setSelectedPerson(null);
      setFeedback({
        tone: savedAccountChange && savedOutcome === "partial_failed" ? "info" : "success",
        message: savedAccountChange && savedOutcome === "partial_failed" ? t("feedback.authSyncPending") : t("feedback.saved"),
      });
    } catch {
      setFeedback({
        tone: "error",
        message: t("errors.serviceUnavailable"),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRetryAuthSync = async () => {
    if (!selectedPerson || !selectedPersonAuthSyncPending || saving) return;
    setSaving(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/admin/people/account/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: selectedPerson.user_id }),
      });
      const result: unknown = await response.json();
      const succeeded = response.ok && typeof result === "object" && result !== null &&
        "outcome" in result && result.outcome === "success";
      if (succeeded) {
        setPendingAuthSyncUserIds((ids) => ids.filter((id) => id !== selectedPerson.user_id));
      }
      setFeedback({ tone: succeeded ? "success" : "info", message: t(succeeded ? "feedback.authSyncComplete" : "feedback.authSyncRetryFailed") });
    } catch {
      setFeedback({ tone: "info", message: t("feedback.authSyncRetryFailed") });
    } finally {
      setSaving(false);
    }
  };

  return {
    canSaveDraft,
    currentViewerId: initialData.currentViewerId,
    dialogOpen,
    draftCity,
    draftNote,
    draftRole,
    draftStatus,
    feedback,
    filteredPeople,
    hasPermission: initialData.hasPermission,
    people,
    personNoteEditor,
    recentChanges,
    roleFilter,
    roleLabels,
    roleOptions: ADMIN_PEOPLE_ROLE_OPTIONS,
    saving,
    searchText,
    selectedPerson,
    selectedPersonIsCurrentViewer,
    selectedPersonAuthSyncPending,
    selectedPersonName,
    statusFilter,
    statusLabels,
    statusOptions: ADMIN_PEOPLE_STATUS_OPTIONS,
    summary,
    closeAccountDialog,
    handleDraftCityChange,
    handleDraftRoleChange,
    handleDraftStatusChange,
    handleRoleFilterChange,
    handleSaveAccountChange,
    handleRetryAuthSync,
    handleStatusFilterChange,
    openAccountDialog,
    setDraftNote,
    setSearchText,
  };
}
