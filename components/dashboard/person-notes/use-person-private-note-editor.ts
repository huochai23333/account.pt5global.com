"use client";

import { useRef, useState } from "react";

import { useTranslations } from "next-intl";

import { PERSON_PRIVATE_NOTE_MAX_LENGTH } from "@/lib/person-private-note-constants";
import { normalizePersonPrivateNote, readPersonPrivateNoteReceipt } from "@/lib/person-private-note-contract";

export type PersonPrivateNoteFeedback = {
  tone: "error" | "success" | "info";
  message: string;
};

type PersonPrivateNoteTarget = {
  user_id: string;
  private_note: string | null;
};

type UsePersonPrivateNoteEditorOptions<TTarget extends PersonPrivateNoteTarget> = {
  getTargetName: (target: TTarget) => string;
  onSaved: (targetUserId: string, note: string | null) => void;
  setFeedback: (feedback: PersonPrivateNoteFeedback | null) => void;
};

export function usePersonPrivateNoteEditor<
  TTarget extends PersonPrivateNoteTarget,
>({
  getTargetName,
  onSaved,
  setFeedback,
}: UsePersonPrivateNoteEditorOptions<TTarget>) {
  const t = useTranslations("PersonPrivateNotes");
  const [selectedTarget, setSelectedTarget] = useState<TTarget | null>(null);
  const [selectedTargetName, setSelectedTargetName] = useState("");
  const [draftNote, setDraftNote] = useState("");
  const [saving, setSaving] = useState(false);
  const savingNow = useRef(false);

  const originalNote = selectedTarget?.private_note ?? "";
  const hasDraftChange =
    selectedTarget !== null &&
    normalizePersonPrivateNote(draftNote) !== normalizePersonPrivateNote(originalNote);
  const canSave = selectedTarget !== null && hasDraftChange && !saving;

  const openNoteDialog = (target: TTarget) => {
    if (savingNow.current) return;

    setFeedback(null);
    setSelectedTarget(target);
    setSelectedTargetName(getTargetName(target));
    setDraftNote(target.private_note ?? "");
  };

  const closeNoteDialog = () => {
    if (savingNow.current) {
      return;
    }

    setSelectedTarget(null);
  };

  const handleDraftNoteChange = (value: string) => {
    setDraftNote(value.slice(0, PERSON_PRIVATE_NOTE_MAX_LENGTH));
  };

  const handleSaveNote = async () => {
    if (!selectedTarget || !canSave || savingNow.current) {
      return;
    }

    // 在 React 更新禁用状态前锁住提交，并保存本次请求对应的目标和正文。
    savingNow.current = true;
    const expected = {
      note: normalizePersonPrivateNote(draftNote),
      targetUserId: selectedTarget.user_id,
    };
    setSaving(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/people/note", {
        body: JSON.stringify(expected),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const result: unknown = await response.json().catch(() => null);
      const receipt = response.ok ? readPersonPrivateNoteReceipt(result, expected) : null;

      if (!receipt) {
        setFeedback({
          tone: "error",
          message: t(`errors.${readSaveErrorCode(result)}`),
        });
        return;
      }

      const savedNote = receipt.note;

      onSaved(receipt.targetUserId, savedNote);
      setSelectedTarget(null);
      setDraftNote(savedNote ?? "");
      setFeedback({
        tone: "success",
        message: savedNote ? t("feedback.saved") : t("feedback.cleared"),
      });
    } catch {
      setFeedback({
        tone: "error",
        message: t("errors.serviceUnavailable"),
      });
    } finally {
      savingNow.current = false;
      setSaving(false);
    }
  };

  return {
    canSave,
    draftNote,
    noteDialogOpen: selectedTarget !== null,
    saving,
    selectedTargetName,
    closeNoteDialog,
    handleDraftNoteChange,
    handleSaveNote,
    openNoteDialog,
  };
}

function readSaveErrorCode(value: unknown) {
  const error = typeof value === "object" && value !== null && "error" in value
    ? value.error
    : undefined;
  switch (error) {
    case "forbidden":
    case "invalidInput":
    case "notFound":
    case "serviceUnavailable":
      return error;
    default:
      return "unknown";
  }
}
