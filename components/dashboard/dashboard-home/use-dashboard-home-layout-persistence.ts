"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { markBrowserCloudSyncActivity } from "@/lib/browser-sync-recovery";
import {
  getCurrentUserHomeWidgetLayout,
  saveUserHomeWidgetLayout,
} from "@/lib/dashboard-home-layouts";
import { getBrowserSupabaseClient } from "@/lib/supabase";
import { useWorkspaceSyncEffect } from "../workspace-session-provider";
import {
  normalizeHomeWidgetLayout,
  type HomeWidgetInstance,
} from "./dashboard-home-layout";

export type DashboardHomeLayoutSaveStatus =
  "error" | "idle" | "saved" | "saving";

/** 统一处理布局的串行保存、最新意图合并和重新读取，编辑动作不在这里实现。 */
export function useDashboardHomeLayoutPersistence({
  editing,
  normalizedInitialWidgets,
  scope,
  widgets,
  setWidgets,
}: {
  editing: boolean;
  normalizedInitialWidgets: HomeWidgetInstance[];
  scope: string;
  widgets: HomeWidgetInstance[];
  setWidgets: (widgets: HomeWidgetInstance[]) => void;
}) {
  const supabase = getBrowserSupabaseClient();
  const [saveStatus, setSaveStatus] =
    useState<DashboardHomeLayoutSaveStatus>("idle");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedWidgetsJsonRef = useRef(
    serializeHomeWidgets(normalizedInitialWidgets),
  );
  const pendingWidgetsRef = useRef<HomeWidgetInstance[]>(
    normalizedInitialWidgets,
  );
  const queuedWidgetsRef = useRef<HomeWidgetInstance[] | null>(null);
  const saveInFlightRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  const saveWidgets = useCallback(
    async (widgetsToSave: HomeWidgetInstance[]) => {
      if (!supabase) {
        return;
      }

      /*
       * 用户连续拖动、缩放或排序时，旧保存请求可能尚未结束。这里不让多个请求
       * 同时写入，而是只保留最新布局排队，防止较慢的旧请求最后返回后覆盖新布局。
       */
      if (saveInFlightRef.current) {
        queuedWidgetsRef.current = widgetsToSave;
        return;
      }

      saveInFlightRef.current = true;
      let nextWidgets: HomeWidgetInstance[] | null = widgetsToSave;

      try {
        while (nextWidgets) {
          const requestedWidgets = nextWidgets;

          queuedWidgetsRef.current = null;
          if (mountedRef.current) {
            setSaveStatus("saving");
          }

          const layout = await saveUserHomeWidgetLayout(
            supabase,
            scope,
            requestedWidgets,
          );
          const normalizedWidgets = normalizeHomeWidgetLayout(layout.widgets);

          markBrowserCloudSyncActivity();
          lastSavedWidgetsJsonRef.current =
            serializeHomeWidgets(normalizedWidgets);

          nextWidgets = queuedWidgetsRef.current;
          if (
            !nextWidgets &&
            serializeHomeWidgets(pendingWidgetsRef.current) !==
              lastSavedWidgetsJsonRef.current
          ) {
            nextWidgets = pendingWidgetsRef.current;
          }
        }

        if (mountedRef.current) {
          setSaveStatus("saved");
        }
      } catch {
        queuedWidgetsRef.current = null;
        lastSavedWidgetsJsonRef.current = "";
        if (mountedRef.current) {
          setSaveStatus("error");
        }
      } finally {
        saveInFlightRef.current = false;
      }
    },
    [scope, supabase],
  );

  useEffect(() => {
    pendingWidgetsRef.current = widgets;

    if (!supabase) {
      return;
    }

    const widgetsJson = serializeHomeWidgets(widgets);

    if (widgetsJson === lastSavedWidgetsJsonRef.current) {
      return;
    }

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    setSaveStatus("saving");
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      void saveWidgets(widgets);
    }, 250);
  }, [saveWidgets, supabase, widgets]);

  const refreshLayout = useCallback(
    async ({ isMounted }: { isMounted: () => boolean }) => {
      if (!supabase || editing) {
        return;
      }

      const layout = await getCurrentUserHomeWidgetLayout(supabase, scope);

      if (!layout || !isMounted()) {
        return;
      }

      const nextWidgets = normalizeHomeWidgetLayout(layout.widgets);

      lastSavedWidgetsJsonRef.current = serializeHomeWidgets(nextWidgets);
      setWidgets(nextWidgets);
    },
    [editing, scope, setWidgets, supabase],
  );

  useWorkspaceSyncEffect(refreshLayout);

  const retrySave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    void saveWidgets(pendingWidgetsRef.current);
  }, [saveWidgets]);
  return { retrySave, saveStatus };
}

function serializeHomeWidgets(widgets: readonly HomeWidgetInstance[]) {
  /*
   * JSON 对象的字段排列不代表业务内容。新增组件与数据库返回对象可能字段顺序不同，
   * 因此先按固定字段顺序重新组装，再比较字符串，避免相同布局被误判为一直未保存。
   */
  return JSON.stringify(
    widgets.map((widget) => ({
      height: widget.height,
      id: widget.id,
      type: widget.type,
      width: widget.width,
      x: widget.x,
      y: widget.y,
    })),
  );
}
