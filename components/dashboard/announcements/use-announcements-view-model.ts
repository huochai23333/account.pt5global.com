"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { markBrowserCloudSyncActivity } from "@/lib/browser-sync-recovery";
import {
  getAdminAnnouncementsPageData,
  sortAnnouncements,
  type AdminAnnouncementsPageData,
  type AnnouncementRow,
  type AnnouncementStatus,
} from "@/lib/announcements";
import { createAnnouncement, updateAnnouncement } from "@/lib/announcement-mutations";
import { getBrowserSupabaseClient } from "@/lib/supabase";

import type { FeedbackTone } from "../dashboard-shared-ui";
import { useWorkspaceSyncEffect } from "../workspace-session-provider";
import {
  createAnnouncementFormFromRow,
  createEmptyAnnouncementForm,
  toAnnouncementErrorMessage,
  type AnnouncementAudienceFilter,
  type AnnouncementFormState,
} from "./announcements-display";

import { useAnnouncementRowActions } from "./use-announcement-row-actions";

type Feedback = { tone: FeedbackTone; message: string } | null;

type UseAdminAnnouncementsViewModelOptions = {
  copy: {
    createSuccess: string;
    deleteConfirm: (title: string) => string;
    deleteSuccess: string;
    missingContent: string;
    missingTitle: string;
    notFoundError: string;
    offlineSuccess: string;
    permissionError: string;
    publishSuccess: string;
    unknownError: string;
    updateSuccess: string;
  };
  initialData: AdminAnnouncementsPageData;
};

export function useAdminAnnouncementsViewModel({
  copy,
  initialData,
}: UseAdminAnnouncementsViewModelOptions) {
  const supabase = getBrowserSupabaseClient();
  const [announcements, setAnnouncements] = useState(initialData.announcements);
  const [hasPermission, setHasPermission] = useState(initialData.hasPermission);
  const [pageFeedback, setPageFeedback] = useState<Feedback>(null);
  const [dialogFeedback, setDialogFeedback] = useState<Feedback>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] =
    useState<AnnouncementRow | null>(null);
  const [formState, setFormState] = useState<AnnouncementFormState>(() =>
    createEmptyAnnouncementForm(),
  );
  const [statusFilter, setStatusFilter] = useState<AnnouncementStatus | "all">("all");
  const [audienceFilter, setAudienceFilter] = useState<AnnouncementAudienceFilter>("any");
  const [submitPending, setSubmitPending] = useState(false);
  const submitting = useRef(false);

  const applyPageData = useCallback((pageData: AdminAnnouncementsPageData) => {
    setHasPermission(pageData.hasPermission);
    setAnnouncements(sortAnnouncements(pageData.announcements));
  }, []);

  const refreshAnnouncements = useCallback(
    async ({ isMounted }: { isMounted: () => boolean }) => {
      if (!supabase) {
        return;
      }

      try {
        const pageData = await getAdminAnnouncementsPageData(supabase);

        if (!isMounted()) {
          return;
        }

        applyPageData(pageData);
      } catch (error) {
        if (!isMounted()) {
          return;
        }

        setPageFeedback({
          tone: "error",
          message: toAnnouncementErrorMessage(error, copy),
        });
      }
    },
    [applyPageData, copy, supabase],
  );

  useWorkspaceSyncEffect(refreshAnnouncements);

  const filteredAnnouncements = useMemo(() => {
    return announcements.filter((announcement) => {
      const statusMatches =
        statusFilter === "all" || announcement.status === statusFilter;
      const audienceMatches =
        audienceFilter === "any" || announcement.audience === audienceFilter;

      return statusMatches && audienceMatches;
    });
  }, [announcements, audienceFilter, statusFilter]);

  const resetFilters = useCallback(() => {
    setAudienceFilter("any");
    setStatusFilter("all");
  }, []);

  const openCreateDialog = useCallback(() => {
    setEditingAnnouncement(null);
    setFormState(createEmptyAnnouncementForm());
    setDialogFeedback(null);
    setDialogOpen(true);
  }, []);

  const openEditDialog = useCallback((announcement: AnnouncementRow) => {
    setEditingAnnouncement(announcement);
    setFormState(createAnnouncementFormFromRow(announcement));
    setDialogFeedback(null);
    setDialogOpen(true);
  }, []);

  const handleDialogOpenChange = useCallback((open: boolean) => {
    setDialogOpen(open);

    if (!open) {
      setDialogFeedback(null);
    }
  }, []);

  const updateFormField = useCallback(
    <Key extends keyof AnnouncementFormState>(
      field: Key,
      value: AnnouncementFormState[Key],
    ) => {
      setFormState((current) => ({
        ...current,
        [field]: value,
      }));
    },
    [],
  );

  const handleSubmit = useCallback(async () => {
    if (!supabase || submitting.current) {
      return;
    }

    if (!formState.title.trim()) {
      setDialogFeedback({ tone: "error", message: copy.missingTitle });
      return;
    }

    if (!formState.content.trim()) {
      setDialogFeedback({ tone: "error", message: copy.missingContent });
      return;
    }

    // 渲染状态稍后更新，同一事件帧也只能提交一次。
    submitting.current = true;
    setSubmitPending(true);
    setDialogFeedback(null);

    try {
      const savedAnnouncement = editingAnnouncement
        ? await updateAnnouncement(supabase, editingAnnouncement.id, formState)
        : await createAnnouncement(supabase, formState);

      markBrowserCloudSyncActivity();
      setAnnouncements((current) =>
        sortAnnouncements(
          editingAnnouncement
            ? current.map((item) =>
                item.id === savedAnnouncement.id ? savedAnnouncement : item,
              )
            : [savedAnnouncement, ...current],
        ),
      );
      setPageFeedback({
        tone: "success",
        message: editingAnnouncement ? copy.updateSuccess : copy.createSuccess,
      });
      setDialogOpen(false);
      setEditingAnnouncement(null);
      setFormState(createEmptyAnnouncementForm());
    } catch (error) {
      setDialogFeedback({
        tone: "error",
        message: toAnnouncementErrorMessage(error, copy),
      });
    } finally {
      submitting.current = false;
      setSubmitPending(false);
    }
  }, [
    copy,
    editingAnnouncement,
    formState,
    supabase,
  ]);

  const { handleRowAction, pendingAction } = useAnnouncementRowActions({
    copy,
    setAnnouncements,
    setPageFeedback,
    supabase,
  });

  return {
    audienceFilter,
    dialogFeedback,
    dialogOpen,
    editingAnnouncement,
    filteredAnnouncements,
    formState,
    hasPermission,
    handleDialogOpenChange,
    handleRowAction,
    handleSubmit,
    openCreateDialog,
    openEditDialog,
    pageFeedback,
    pendingAction,
    resetFilters,
    setAudienceFilter,
    setStatusFilter,
    statusFilter,
    submitPending,
    updateFormField,
  };
}
