"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useTranslations } from "next-intl";

import {
  downloadAdminTaskMediaLibraryItemBlob,
  getAdminTaskMediaLibraryData,
  getAdminTaskMediaLibraryItemSignedUrl,
  type AdminTaskMediaLibraryData,
  type AdminTaskMediaLibraryItem,
  type AdminTaskMediaLibraryKind,
} from "@/lib/admin-task-media-library";
import { getBrowserSupabaseClient } from "@/lib/supabase";
import { normalizeSearchText } from "@/lib/value-normalizers";

import {
  createDashboardSharedCopy,
  toErrorMessage,
} from "../dashboard-shared-ui";
import { useWorkspaceSyncEffect } from "../workspace-session-provider";
import type {
  AdminTaskFilePreviewItem,
} from "./admin-task-file-preview-dialog";
import type { PageFeedback } from "./admin-tasks-view-model-shared";

import { downloadTaskFileBlob, useAdminTaskFilePreview } from "./use-admin-task-file-preview";

export type AdminTaskMediaLibraryKindFilter = "all" | AdminTaskMediaLibraryKind;

type PreviewMediaLibraryItem = AdminTaskFilePreviewItem & {
  sourceItem: AdminTaskMediaLibraryItem;
};

export function useAdminTaskMediaLibrary(initialData: AdminTaskMediaLibraryData) {
  const t = useTranslations("Tasks.admin.mediaLibrary");
  const sharedT = useTranslations("DashboardShared");
  const sharedCopy = useMemo(() => createDashboardSharedCopy(sharedT), [sharedT]);
  const supabase = getBrowserSupabaseClient();
  const [canView, setCanView] = useState(initialData.canView);
  const [items, setItems] = useState<AdminTaskMediaLibraryItem[]>(initialData.items);
  const [searchText, setSearchText] = useState("");
  const [kindFilter, setKindFilter] = useState<AdminTaskMediaLibraryKindFilter>("all");
  const [downloadBusyItemId, setDownloadBusyItemId] = useState<string | null>(null);
  const [previewDownloadBusy, setPreviewDownloadBusy] = useState(false);
  const {
    closePreview: clearPreview,
    openPreview,
    previewBusyKey,
    previewItem,
  } = useAdminTaskFilePreview<PreviewMediaLibraryItem>();
  const busyItemId = previewBusyKey ?? downloadBusyItemId;
  const [pageFeedback, setPageFeedback] = useState<PageFeedback>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const applyPageData = useCallback((pageData: AdminTaskMediaLibraryData) => {
    setCanView(pageData.canView);
    setItems(pageData.items);
  }, []);

  useEffect(() => {
    applyPageData(initialData);
  }, [applyPageData, initialData]);

  const filteredItems = useMemo(() => {
    const query = normalizeSearchText(searchText);

    return items.filter((item) => {
      if (kindFilter !== "all" && item.kind !== kindFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = normalizeSearchText(
        [
          item.original_name,
          item.task_name,
          item.task_type_name,
          item.submitted_by_name,
          item.submitted_by_email,
          item.reviewer_name,
          item.reviewer_email,
        ]
          .filter(Boolean)
          .join(" "),
      );

      return haystack.includes(query);
    });
  }, [items, kindFilter, searchText]);

  const refreshMediaLibrary = useCallback(
    async ({ isMounted }: { isMounted: () => boolean }) => {
      if (!supabase) {
        return;
      }

      try {
        const nextPageData = await getAdminTaskMediaLibraryData(supabase);

        if (!isMounted()) {
          return;
        }

        applyPageData(nextPageData);
        setPageFeedback(null);
      } catch (error) {
        if (!isMounted()) {
          return;
        }

        setPageFeedback({
          tone: "error",
          message: toErrorMessage(error, sharedCopy),
        });
      }
    },
    [applyPageData, sharedCopy, supabase],
  );

  useWorkspaceSyncEffect(refreshMediaLibrary);

  const handleRefresh = useCallback(() => {
    if (!supabase || isRefreshing) {
      return;
    }

    setIsRefreshing(true);
    void refreshMediaLibrary({ isMounted: () => true }).finally(() => {
      setIsRefreshing(false);
    });
  }, [isRefreshing, refreshMediaLibrary, supabase]);

  const handlePreview = useCallback(
    async (item: AdminTaskMediaLibraryItem) => {
      if (!supabase || busyItemId === item.id) {
        return;
      }

      setPageFeedback(null);
      await openPreview(item.id, async () => ({
        file_size_bytes: item.file_size_bytes,
        id: item.id,
        kind: item.kind,
        mime_type: item.mime_type,
        original_name: item.original_name,
        reviewed_at: item.reviewed_at,
        signedUrl: await getAdminTaskMediaLibraryItemSignedUrl(supabase, item),
        sourceItem: item,
        submitted_at: item.submitted_at,
        submitted_by_name: item.submitted_by_name ?? item.submitted_by_email,
        submission_round: item.submission_round,
        task_name: item.task_name,
      }), () => setPageFeedback({ tone: "error", message: t("previewFailed") }));
    },
    [busyItemId, openPreview, supabase, t],
  );

  const handleDownload = useCallback(
    async (item: AdminTaskMediaLibraryItem) => {
      if (!supabase || previewBusyKey === item.id || downloadBusyItemId === item.id) {
        return;
      }

      setDownloadBusyItemId(item.id);
      setPageFeedback(null);

      try {
        const blob = await downloadAdminTaskMediaLibraryItemBlob(supabase, item);
        downloadTaskFileBlob(blob, item.original_name);
      } catch {
        setPageFeedback({
          tone: "error",
          message: t("downloadFailed"),
        });
      } finally {
        setDownloadBusyItemId((current) => (current === item.id ? null : current));
      }
    },
    [downloadBusyItemId, previewBusyKey, supabase, t],
  );

  const handlePreviewDownload = useCallback(
    async (file: AdminTaskFilePreviewItem) => {
      const item =
        previewItem && previewItem.id === file.id ? previewItem.sourceItem : null;

      if (!supabase || !item || previewDownloadBusy) {
        return;
      }

      setPreviewDownloadBusy(true);
      setPageFeedback(null);

      try {
        const blob = await downloadAdminTaskMediaLibraryItemBlob(supabase, item);
        downloadTaskFileBlob(blob, item.original_name);
      } catch {
        setPageFeedback({
          tone: "error",
          message: t("downloadFailed"),
        });
      } finally {
        setPreviewDownloadBusy(false);
      }
    },
    [previewDownloadBusy, previewItem, supabase, t],
  );

  const closePreview = useCallback((open: boolean) => {
    if (!open) {
      clearPreview();
      setPreviewDownloadBusy(false);
    }
  }, [clearPreview]);

  return {
    busyItemId,
    canView,
    closePreview,
    filteredItems,
    handleDownload,
    handlePreview,
    handlePreviewDownload,
    handleRefresh,
    isRefreshing,
    items,
    kindFilter,
    pageFeedback,
    previewDownloadBusy,
    previewItem,
    searchText,
    setKindFilter,
    setSearchText,
  };
}
