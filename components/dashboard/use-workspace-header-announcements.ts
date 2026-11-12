"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getBrowserSupabaseClient } from "@/lib/supabase";
import {
  getWorkspaceAnnouncementsState,
  markWorkspaceAnnouncementsRead,
  type WorkspaceAnnouncementsState,
} from "@/lib/workspace-announcements";

type DialogMode = "auto" | "manual";

type WorkspaceHeaderAnnouncementsCopy = {
  loadError: string;
  readError: string;
  readPartialError: string;
};

type UseWorkspaceHeaderAnnouncementsOptions = {
  copy: WorkspaceHeaderAnnouncementsCopy;
  initialState: WorkspaceAnnouncementsState;
};

export function useWorkspaceHeaderAnnouncements({
  copy,
  initialState,
}: UseWorkspaceHeaderAnnouncementsOptions) {
  const supabase = getBrowserSupabaseClient();
  const initialHasUnreadAnnouncements = initialState.unreadAnnouncements.length > 0;
  const autoOpenedRef = useRef(initialHasUnreadAnnouncements);
  const readInProgress = useRef(false);
  const readGeneration = useRef(0);

  const [announcementsState, setAnnouncementsState] =
    useState<WorkspaceAnnouncementsState>(initialState);
  const [dialogMode, setDialogMode] = useState<DialogMode>(
    initialHasUnreadAnnouncements ? "auto" : "manual",
  );
  const [dialogOpen, setDialogOpen] = useState(initialHasUnreadAnnouncements);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);

  const applyAnnouncementsState = useCallback(
    (nextState: WorkspaceAnnouncementsState) => {
      setAnnouncementsState(nextState);

      if (!autoOpenedRef.current && nextState.unreadAnnouncements.length > 0) {
        autoOpenedRef.current = true;
        setDialogMode("auto");
        setDialogOpen(true);
      }
    },
    [],
  );

  useEffect(() => {
    applyAnnouncementsState(initialState);
  }, [applyAnnouncementsState, initialState]);

  const refreshAnnouncements = useCallback(async () => {
    if (!supabase) {
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    const generation = readGeneration.current;

    try {
      const nextState = await getWorkspaceAnnouncementsState(supabase);

      if (!readInProgress.current && generation === readGeneration.current) {
        applyAnnouncementsState(nextState);
      }
    } catch {
      if (!readInProgress.current && generation === readGeneration.current) {
        setErrorMessage(copy.loadError);
      }
    } finally {
      setLoading(false);
    }
  }, [applyAnnouncementsState, copy.loadError, supabase]);

  const markUnreadAsRead = useCallback(async () => {
    const unread = announcementsState.unreadAnnouncements;
    if (unread.length === 0) return true;
    if (!supabase || readInProgress.current) return false;

    // 同一渲染帧可能收到两次确认。同步锁还保护写入时发回的旧列表。
    readInProgress.current = true;
    readGeneration.current += 1;
    setMarkingRead(true);

    try {
      const { status, confirmedIds } = await markWorkspaceAnnouncementsRead(supabase, unread);
      setAnnouncementsState((current) => ({
        ...current,
        unreadAnnouncements: current.unreadAnnouncements.filter(({ id }) => !confirmedIds.has(id)),
      }));
      if (status === "succeeded") {
        setErrorMessage(null);
        return true;
      }
      setErrorMessage(status === "partial_failed" ? copy.readPartialError : copy.readError);
      return false;
    } catch {
      setErrorMessage(copy.readError);
      return false;
    } finally {
      readInProgress.current = false;
      setMarkingRead(false);
    }
  }, [announcementsState.unreadAnnouncements, copy.readError, copy.readPartialError, supabase]);

  const closeDialog = useCallback(
    (open: boolean) => {
      if (open) {
        setDialogOpen(true);
        return;
      }

      setDialogOpen(false);

      if (announcementsState.unreadAnnouncements.length > 0) {
        void markUnreadAsRead();
      }
    },
    [announcementsState.unreadAnnouncements.length, markUnreadAsRead],
  );

  const openRecentAnnouncements = useCallback(() => {
    setDialogMode("manual");
    setDialogOpen(true);

    if (!loading) {
      void refreshAnnouncements();
    }
  }, [loading, refreshAnnouncements]);

  const acknowledgeAnnouncements = useCallback(async () => {
    if (await markUnreadAsRead()) setDialogOpen(false);
  }, [markUnreadAsRead]);

  const displayedAnnouncements = useMemo(() => {
    if (
      dialogMode === "auto" &&
      announcementsState.unreadAnnouncements.length > 0
    ) {
      return announcementsState.unreadAnnouncements;
    }

    return announcementsState.announcements;
  }, [
    announcementsState.announcements,
    announcementsState.unreadAnnouncements,
    dialogMode,
  ]);

  return {
    acknowledgeAnnouncements,
    closeDialog,
    dialogMode,
    dialogOpen,
    displayedAnnouncements,
    errorMessage,
    loading,
    markingRead,
    openRecentAnnouncements,
    unreadCount: announcementsState.unreadAnnouncements.length,
  };
}
