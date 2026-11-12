"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";

import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { paginateDashboardItems } from "@/lib/dashboard-pagination";
import {
  acceptSalesmanTask,
  getTaskAttachmentSignedUrl,
} from "@/lib/salesman-task-actions";
import {
  buildSalesmanTasksRoute,
  type SalesmanTasksFilters,
  type SalesmanTasksSearchParams,
} from "@/lib/salesman-task-route";
import type { SalesmanTasksPageData, SalesmanTaskRow } from "@/lib/salesman-tasks";
import { getBrowserSupabaseClient } from "@/lib/supabase";
import {
  type FeedbackTone,
} from "@/components/dashboard/dashboard-shared-ui";
import {
  toSalesmanTaskErrorMessage,
} from "@/components/dashboard/tasks/tasks-display";
import { useWorkspaceSyncEffect } from "@/components/dashboard/workspace-session-provider";
import { filterSalesmanTaskList } from "./salesman-task-list-filters";
import { useSalesmanTaskReviewDialog } from "./use-salesman-task-review-dialog";

type PageFeedback = { tone: FeedbackTone; message: string } | null;

function areSalesmanTasksFiltersEqual(
  left: SalesmanTasksFilters,
  right: SalesmanTasksFilters,
) {
  return (
    left.searchText === right.searchText
    && left.focus === right.focus
  );
}

export function useSalesmanTasksPage({
  initialData,
  initialView,
}: {
  initialData: SalesmanTasksPageData;
  initialView: SalesmanTasksSearchParams;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = getBrowserSupabaseClient();
  const t = useTranslations("Tasks.salesman");
  const sharedT = useTranslations("Tasks.shared");
  const [isRefreshing, startRefreshTransition] = useTransition();

  const [pageFeedback, setPageFeedback] = useState<PageFeedback>(null);
  const [filters, setFilters] = useState<SalesmanTasksFilters>(initialView.filters);
  const [page, setPage] = useState(initialView.page);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [attachmentBusyKey, setAttachmentBusyKey] = useState<string | null>(null);

  const deferredSearchText = useDeferredValue(filters.searchText);
  const viewerId = initialData.viewerId;
  const tasks = initialData.tasks;
  const canView = initialData.canView;

  useEffect(() => {
    setFilters(initialView.filters);
  }, [initialView.filters]);

  useEffect(() => {
    setPage(initialView.page);
  }, [initialView.page]);

  const refreshTaskBoard = useCallback(() => {
    startRefreshTransition(() => {
      router.refresh();
    });
  }, [router, startRefreshTransition]);

  const replaceTasksRoute = useCallback(
    (next: {
      filters?: SalesmanTasksFilters;
      page?: number;
    }) => {
      const nextRoute = buildSalesmanTasksRoute(pathname, searchParams.toString(), {
        filters: next.filters ?? filters,
        page: next.page ?? page,
      });

      startRefreshTransition(() => {
        router.replace(nextRoute, {
          scroll: false,
        });
      });
    },
    [filters, page, pathname, router, searchParams, startRefreshTransition],
  );

  useWorkspaceSyncEffect(refreshTaskBoard);

  const filteredTasks = useMemo(
    () => filterSalesmanTaskList(tasks, deferredSearchText, filters.focus, viewerId),
    [deferredSearchText, filters.focus, tasks, viewerId],
  );

  const tasksPagination = useMemo(
    () => paginateDashboardItems(filteredTasks, page),
    [filteredTasks, page],
  );

  useEffect(() => {
    if (tasksPagination.page === page) {
      return;
    }

    setPage(tasksPagination.page);

    if (
      areSalesmanTasksFiltersEqual(filters, initialView.filters)
      && initialView.page !== tasksPagination.page
    ) {
      replaceTasksRoute({
        filters,
        page: tasksPagination.page,
      });
    }
  }, [
    filters,
    initialView.filters,
    initialView.page,
    page,
    replaceTasksRoute,
    tasksPagination.page,
  ]);

  useEffect(() => {
    if (areSalesmanTasksFiltersEqual(filters, initialView.filters)) {
      return;
    }

    const timeoutId = globalThis.setTimeout(() => {
      replaceTasksRoute({
        filters,
        page: 1,
      });
    }, 250);

    return () => {
      globalThis.clearTimeout(timeoutId);
    };
  }, [filters, initialView.filters, replaceTasksRoute]);

  const updateFilter = useCallback(
    <Key extends keyof SalesmanTasksFilters>(key: Key, value: SalesmanTasksFilters[Key]) => {
      setPage(1);
      setFilters((current) => ({
        ...current,
        [key]: value,
      }));
    },
    [],
  );

  const goToPage = useCallback(
    (nextPage: number) => {
      setPage(nextPage);
      replaceTasksRoute({
        filters,
        page: nextPage,
      });
    },
    [filters, replaceTasksRoute],
  );

  const goToNextPage = useCallback(() => {
    if (!tasksPagination.hasNextPage) {
      return;
    }

    goToPage(tasksPagination.page + 1);
  }, [goToPage, tasksPagination.hasNextPage, tasksPagination.page]);

  const goToPreviousPage = useCallback(() => {
    if (!tasksPagination.hasPreviousPage) {
      return;
    }

    goToPage(tasksPagination.page - 1);
  }, [goToPage, tasksPagination.hasPreviousPage, tasksPagination.page]);

  const handleAcceptTask = useCallback(
    async (taskId: string) => {
      if (!supabase || busyTaskId) {
        return;
      }

      setBusyTaskId(taskId);
      setPageFeedback(null);

      try {
        await acceptSalesmanTask(supabase, taskId);
        setPageFeedback({
          tone: "success",
          message: t("feedback.accepted"),
        });
        refreshTaskBoard();
      } catch (error) {
        setPageFeedback({
          tone: "error",
          message: toSalesmanTaskErrorMessage(error, sharedT),
        });
      } finally {
        setBusyTaskId(null);
      }
    },
    [busyTaskId, refreshTaskBoard, sharedT, supabase, t],
  );

  const reviewDialog = useSalesmanTaskReviewDialog({
    refreshTaskBoard,
    setPageFeedback,
    viewerId,
  });

  const handleOpenAttachment = useCallback(
    async (taskId: string, attachment: SalesmanTaskRow["attachments"][number]) => {
      if (!supabase) {
        return;
      }

      const busyKey = `${taskId}:${attachment.id}`;
      setAttachmentBusyKey(busyKey);

      try {
        const signedUrl = await getTaskAttachmentSignedUrl(supabase, attachment);
        window.open(signedUrl, "_blank", "noopener,noreferrer");
      } catch (error) {
        setPageFeedback({
          tone: "error",
          message: toSalesmanTaskErrorMessage(error, sharedT),
        });
      } finally {
        setAttachmentBusyKey(null);
      }
    },
    [sharedT, supabase],
  );

  return {
    attachmentBusyKey,
    busyTaskId,
    canView,
    filteredTasks,
    filters,
    goToNextPage,
    goToPreviousPage,
    handleAcceptTask,
    handleOpenAttachment,
    handleSubmitDialogOpenChange: reviewDialog.onOpenChange,
    handleSubmitReview: reviewDialog.submit,
    isRefreshing,
    pageFeedback,
    setSubmitDialogFiles: reviewDialog.setFiles,
    setSubmitDialogNote: reviewDialog.setNote,
    submitDialogFeedback: reviewDialog.feedback,
    submitDialogFiles: reviewDialog.files,
    submitDialogNote: reviewDialog.note,
    submitDialogOpen: reviewDialog.open,
    submitDialogPending: reviewDialog.pending,
    submitDialogTask: reviewDialog.task,
    tasksPagination,
    updateFilter,
    viewerId,
    openSubmitDialog: reviewDialog.openForTask,
  };
}
