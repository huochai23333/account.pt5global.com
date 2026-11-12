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

import {
  type AdminTasksFilters,
  type AdminTasksPageData,
  type AdminTasksSearchParams,
} from "@/lib/admin-tasks";
import { buildAdminTasksRoute, updateAdminTaskFilterDraft } from "@/lib/admin-task-route";
import { paginateDashboardItems } from "@/lib/dashboard-pagination";

import { useWorkspaceSyncEffect } from "@/components/dashboard/workspace-session-provider";
import { filterAdminTaskList } from "./admin-task-list-filters";
import {
  areAdminTaskFiltersEqual,
} from "./admin-tasks-view-model-shared";

export function useAdminTasksRouteState({
  initialData,
  initialView,
}: {
  initialData: AdminTasksPageData;
  initialView: AdminTasksSearchParams;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sharedT = useTranslations("Tasks.shared");
  const [isRefreshing, startRefreshTransition] = useTransition();

  const viewerId = initialData.viewerId;
  const tasks = initialData.tasks;
  const taskTypeOptions = initialData.taskTypeOptions;
  const canView = initialData.canView;

  const initialDraft = useMemo(
    () => ({
      ...initialView,
      routeKey: JSON.stringify([
        initialView.page,
        initialView.filters.searchText,
        initialView.filters.targetRole,
        initialView.filters.status,
      ]),
    }),
    [initialView],
  );
  const [draftState, setDraftState] = useState(initialDraft);
  const currentDraft = draftState.routeKey === initialDraft.routeKey ? draftState : initialDraft;
  // 地址变化时丢弃旧草稿，返回旧地址也应使用该地址重新提供的初值。
  if (currentDraft !== draftState) setDraftState(currentDraft);
  const { filters, page } = currentDraft;
  const deferredSearchText = useDeferredValue(filters.searchText);
  const refreshTaskBoard = useCallback(() => {
    startRefreshTransition(() => {
      router.refresh();
    });
  }, [router, startRefreshTransition]);

  const replaceTasksRoute = useCallback(
    (next: AdminTasksSearchParams) => {
      const href = buildAdminTasksRoute(pathname, searchParams.toString(), next);
      startRefreshTransition(() => {
        router.replace(href, { scroll: false });
      });
    },
    [pathname, router, searchParams, startRefreshTransition],
  );

  useWorkspaceSyncEffect(refreshTaskBoard);

  const { status, targetRole } = filters;
  const filteredTasks = useMemo(
    () => filterAdminTaskList(tasks, { searchText: deferredSearchText, status, targetRole }, sharedT),
    [deferredSearchText, sharedT, status, targetRole, tasks],
  );

  const tasksPagination = useMemo(
    () => paginateDashboardItems(filteredTasks, page),
    [filteredTasks, page],
  );

  useEffect(() => {
    if (tasksPagination.page === page) {
      return;
    }

    if (
      areAdminTaskFiltersEqual(filters, initialView.filters) &&
      initialView.page !== tasksPagination.page
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
    // 翻页会立即写入新地址；已进入后续页时不要再用延迟筛选跳回第一页。
    if (page !== 1 || areAdminTaskFiltersEqual(filters, initialView.filters)) {
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
  }, [filters, initialView.filters, page, replaceTasksRoute]);

  const updateFilter = useCallback(
    <Key extends keyof AdminTasksFilters>(
      key: Key,
      value: AdminTasksFilters[Key],
    ) => {
      setDraftState((current) => updateAdminTaskFilterDraft(current, initialDraft, key, value));
    },
    [initialDraft],
  );

  const goToPage = useCallback(
    (nextPage: number) => {
      setDraftState({
        filters,
        page: nextPage,
        routeKey: initialDraft.routeKey,
      });
      replaceTasksRoute({
        filters,
        page: nextPage,
      });
    },
    [filters, initialDraft.routeKey, replaceTasksRoute],
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

  return {
    canView,
    filteredTasks,
    filters,
    goToNextPage,
    goToPreviousPage,
    isRefreshing,
    refreshTaskBoard,
    tasks,
    tasksPagination,
    targetRoleOptions: initialData.targetRoleOptions,
    taskTypeOptions,
    updateFilter,
    viewerId,
  };
}
