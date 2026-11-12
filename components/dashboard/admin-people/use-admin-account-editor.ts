"use client";

import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useTranslations } from "next-intl";

import {
  ADMIN_PEOPLE_CITY_MAX_LENGTH,
  isAdminPeopleRole,
  isAdminPeopleStatus,
  type AdminPeopleRole,
  type AdminPeopleStatus,
  type AdminPersonRow,
} from "@/lib/admin-people-contract";

import { getPersonDisplayName } from "./admin-people-display";
import {
  normalizeAdminPeopleErrorCode,
  readAdminPeopleUpdateResponse,
  type AdminPeopleFeedback,
  type AdminPeopleUpdateResponse,
} from "./admin-people-view-model-utils";

export function useAdminAccountEditor({
  currentViewerId,
  pendingAuthSyncUserIds,
  setPendingAuthSyncUserIds,
  onSaved,
  setFeedback,
}: {
  currentViewerId: string | null;
  pendingAuthSyncUserIds: string[];
  setPendingAuthSyncUserIds: Dispatch<SetStateAction<string[]>>;
  onSaved: (person: AdminPersonRow, recentChanges: AdminPeopleUpdateResponse["recentChanges"]) => void;
  setFeedback: (feedback: AdminPeopleFeedback | null) => void;
}) {
  const t = useTranslations("AdminPeople");
  const [selectedPerson, setSelectedPerson] = useState<AdminPersonRow | null>(null);
  const [draftRole, setDraftRole] = useState<AdminPeopleRole>("client");
  const [draftStatus, setDraftStatus] = useState<AdminPeopleStatus>("inactive");
  const [draftCity, setDraftCity] = useState("");
  const [draftNote, setDraftNote] = useState("");
  const [saving, setSaving] = useState(false);
  const savingNow = useRef(false);

  const selectedPersonName = selectedPerson
    ? getPersonDisplayName(selectedPerson, t("fallback.unnamedUser"))
    : "";
  const selectedPersonIsCurrentViewer = selectedPerson?.user_id === currentViewerId;
  const selectedPersonAuthSyncPending = selectedPerson !== null &&
    pendingAuthSyncUserIds.includes(selectedPerson.user_id);
  const canSaveDraft = selectedPerson !== null && !selectedPersonIsCurrentViewer && !saving && (
    selectedPerson.role !== draftRole || selectedPerson.status !== draftStatus ||
    (selectedPerson.city ?? "").trim() !== draftCity.trim()
  );

  const openAccountDialog = (person: AdminPersonRow) => {
    if (savingNow.current) return;
    setFeedback(null);
    // 打开时的快照随保存提交，让数据库可以发现其他管理员的先行变更。
    setSelectedPerson(person);
    setDraftRole(person.role ?? "client");
    setDraftStatus(person.status);
    setDraftCity(person.city ?? "");
    setDraftNote("");
  };

  const closeAccountDialog = () => {
    if (!savingNow.current) setSelectedPerson(null);
  };

  async function runAccountRequest(run: () => Promise<void>) {
    // 保存与重试共用同一个同步锁，避免两个事件发生在按钮重新渲染前。
    savingNow.current = true;
    setSaving(true);
    setFeedback(null);
    try {
      await run();
    } finally {
      savingNow.current = false;
      setSaving(false);
    }
  }

  const handleSaveAccountChange = async () => {
    if (!selectedPerson || !canSaveDraft || savingNow.current) return;
    const targetUserId = selectedPerson.user_id;
    await runAccountRequest(async () => {
      try {
        const response = await fetch("/api/admin/people/account", {
          body: JSON.stringify({
            targetUserId,
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
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const result = await readAdminPeopleUpdateResponse(response);
        if (!response.ok) {
          setFeedback({ tone: "error", message: t(`errors.${normalizeAdminPeopleErrorCode(result.error)}`) });
          return;
        }

        const updated = result.person;
        if (!updated || updated.user_id !== targetUserId ||
            updated.role !== draftRole || updated.status !== draftStatus ||
            updated.city !== (draftCity.trim() || null)) {
          setFeedback({ tone: "error", message: t("errors.unknown") });
          return;
        }

        // 数据库已提交时，只有明确的成功回执才表示 Auth 也已经同步。
        const authPending = result.outcome !== "success";
        setPendingAuthSyncUserIds((ids) => authPending
          ? [...new Set([...ids, targetUserId])]
          : ids.filter((id) => id !== targetUserId));
        onSaved(updated, result.recentChanges);
        setSelectedPerson(null);
        setFeedback({
          tone: authPending ? "info" : "success",
          message: t(authPending ? "feedback.authSyncPending" : "feedback.saved"),
        });
      } catch {
        setFeedback({ tone: "error", message: t("errors.serviceUnavailable") });
      }
    });
  };

  const handleRetryAuthSync = async () => {
    if (!selectedPerson || !selectedPersonAuthSyncPending || savingNow.current) return;
    const targetUserId = selectedPerson.user_id;
    await runAccountRequest(async () => {
      try {
        const response = await fetch("/api/admin/people/account/retry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetUserId }),
        });
        const result: unknown = await response.json();
        const succeeded = response.ok && typeof result === "object" && result !== null &&
          "outcome" in result && result.outcome === "success";
        if (succeeded) setPendingAuthSyncUserIds((ids) => ids.filter((id) => id !== targetUserId));
        setFeedback({ tone: succeeded ? "success" : "info", message: t(succeeded ? "feedback.authSyncComplete" : "feedback.authSyncRetryFailed") });
      } catch {
        setFeedback({ tone: "info", message: t("feedback.authSyncRetryFailed") });
      }
    });
  };

  return {
    canSaveDraft,
    dialogOpen: selectedPerson !== null,
    draftCity,
    draftNote,
    draftRole,
    draftStatus,
    saving,
    selectedPerson,
    selectedPersonAuthSyncPending,
    selectedPersonIsCurrentViewer,
    selectedPersonName,
    closeAccountDialog,
    handleDraftCityChange: (value: string) => setDraftCity(value.slice(0, ADMIN_PEOPLE_CITY_MAX_LENGTH)),
    handleDraftRoleChange: (value: string) => { if (isAdminPeopleRole(value)) setDraftRole(value); },
    handleDraftStatusChange: (value: string) => { if (isAdminPeopleStatus(value)) setDraftStatus(value); },
    handleRetryAuthSync,
    handleSaveAccountChange,
    openAccountDialog,
    setDraftNote,
  };
}
