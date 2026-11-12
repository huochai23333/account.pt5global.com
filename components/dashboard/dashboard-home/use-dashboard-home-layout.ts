"use client";

import { useCallback, useMemo, useState } from "react";

import { useDashboardHomeLayoutPersistence } from "./use-dashboard-home-layout-persistence";
import {
  cloneDefaultHomeWidgetLayout,
  createHomeWidgetInstance,
  findAvailableHomeWidgetPosition,
  normalizeHomeWidgetCoordinates,
  normalizeHomeWidgetLayout,
  type HomeWidgetInstance,
  type HomeWidgetType,
} from "./dashboard-home-layout";

type UseDashboardHomeLayoutOptions = {
  initialWidgets: unknown;
  scope: string;
};

export type { DashboardHomeLayoutSaveStatus } from "./use-dashboard-home-layout-persistence";

export function useDashboardHomeLayout({
  initialWidgets,
  scope,
}: UseDashboardHomeLayoutOptions) {
  // 本层维护编辑意图；延迟保存、串行写入和刷新恢复交给独立持久化 Hook。
  const normalizedInitialWidgets = useMemo(
    () => normalizeHomeWidgetLayout(initialWidgets),
    [initialWidgets],
  );
  const [editing, setEditing] = useState(false);
  const [widgets, setWidgets] = useState<HomeWidgetInstance[]>(
    () => normalizedInitialWidgets,
  );
  const { retrySave, saveStatus } = useDashboardHomeLayoutPersistence({
    editing,
    normalizedInitialWidgets,
    scope,
    widgets,
    setWidgets,
  });

  const addWidget = useCallback((type: HomeWidgetType) => {
    const id = createWidgetId(type);
    let nextWidgetId = id;

    setWidgets((current) => {
      const widget = createHomeWidgetInstance(
        type,
        id,
        findAvailableHomeWidgetPosition(current, getDefaultWidgetSize(type)),
      );

      nextWidgetId = widget.id;

      return normalizeHomeWidgetCoordinates([...current, widget], widget.id);
    });

    return nextWidgetId;
  }, []);

  const removeWidget = useCallback((id: string) => {
    setWidgets((current) => current.filter((widget) => widget.id !== id));
  }, []);

  const moveWidget = useCallback((id: string, offset: -1 | 1) => {
    setWidgets((current) => {
      const currentIndex = current.findIndex((widget) => widget.id === id);
      const nextIndex = currentIndex + offset;

      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const nextWidgets = [...current];
      const [movedWidget] = nextWidgets.splice(currentIndex, 1);

      nextWidgets.splice(nextIndex, 0, movedWidget);
      return nextWidgets;
    });
  }, []);

  const resetWidgets = useCallback(() => {
    setWidgets(cloneDefaultHomeWidgetLayout());
  }, []);

  const updateWidgetLayout = useCallback(
    (
      id: string,
      layout: Pick<HomeWidgetInstance, "height" | "width" | "x" | "y">,
    ) => {
      setWidgets((current) =>
        normalizeHomeWidgetCoordinates(
          current.map((widget) =>
            widget.id === id
              ? {
                  ...widget,
                  ...layout,
                }
              : widget,
          ),
          id,
        ),
      );
    },
    [],
  );

  const startEditing = useCallback(() => setEditing(true), []);
  const stopEditing = useCallback(() => setEditing(false), []);

  return {
    addWidget,
    editing,
    moveWidget,
    removeWidget,
    resetWidgets,
    retrySave,
    saveStatus,
    startEditing,
    stopEditing,
    updateWidgetLayout,
    widgets,
  };
}

function getDefaultWidgetSize(type: HomeWidgetType) {
  const widget = createHomeWidgetInstance(type, "preview", { x: 0, y: 0 });

  return {
    height: widget.height,
    type,
    width: widget.width,
  };
}

function createWidgetId(type: HomeWidgetType) {
  const randomId =
    typeof window.crypto?.randomUUID === "function"
      ? window.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

  return `${type}-${randomId}`;
}
