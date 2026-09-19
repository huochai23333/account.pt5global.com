"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Check, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DashboardPageShell } from "@/components/dashboard/dashboard-page-shell";
import { useWorkspaceCustomizationSidebar } from "@/components/dashboard/workspace-customization-sidebar";
import type { DashboardHomePageData } from "@/lib/dashboard-home";
import { cn } from "@/lib/utils";

import { useDashboardHomeLayout } from "./use-dashboard-home-layout";
import { useDashboardHomeTodos } from "./use-dashboard-home-todos";
import { useDashboardHomeDisplayMode } from "./use-dashboard-home-display-mode";
import type { HomeTodoCopy } from "./dashboard-home-todo-display";
import { type HomeWidgetType } from "./dashboard-home-layout";
import type { HomeCustomizerCopy } from "./dashboard-home-customizer-copy";
import { DashboardHomeLayoutSaveFeedback } from "./dashboard-home-layout-save-feedback";
import { DashboardHomeManagerDialog } from "./dashboard-home-manager-dialog";
import { DashboardHomeWidgetAdjustDialog } from "./dashboard-home-widget-adjust-dialog";
import { DashboardHomeWidgetCard } from "./dashboard-home-widget-card";
import { DashboardHomeWidgetSidebar } from "./dashboard-home-widget-sidebar";
import {
  DashboardHomeWidgetContent,
  type DashboardHomeWidgetCopy,
} from "./dashboard-home-widget-content";

type DashboardHomeCustomizerProps = {
  copy: DashboardHomeWidgetCopy;
  customizerCopy: HomeCustomizerCopy;
  initialData: DashboardHomePageData;
  locale: string;
  todoCopy: HomeTodoCopy;
};

export function DashboardHomeCustomizer({
  copy,
  customizerCopy,
  initialData,
  locale,
  todoCopy,
}: DashboardHomeCustomizerProps) {
  const layout = useDashboardHomeLayout({
    initialWidgets: initialData.homeWidgetLayout,
    scope: initialData.layoutScope,
  });
  const {
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
  } = layout;
  const todoState = useDashboardHomeTodos({
    copy: todoCopy,
    initialTodos: initialData.todos,
  });
  const displayMode = useDashboardHomeDisplayMode(stopEditing);
  const effectiveEditing = displayMode === "custom" && editing;
  const animationTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [draggingWidgetId, setDraggingWidgetId] = useState<string | null>(null);
  const [enteringWidgetId, setEnteringWidgetId] = useState<string | null>(null);
  const [deletingWidgetId, setDeletingWidgetId] = useState<string | null>(null);
  const [resizingWidgetId, setResizingWidgetId] = useState<string | null>(null);
  const [adjustingWidgetId, setAdjustingWidgetId] = useState<string | null>(
    null,
  );
  const [managerOpen, setManagerOpen] = useState(false);
  const setWorkspaceSidebar = useWorkspaceCustomizationSidebar();
  const adjustingWidget =
    widgets.find((widget) => widget.id === adjustingWidgetId) ?? null;

  const clearAnimatedStateLater = useCallback(
    (callback: () => void, delay = 260) => {
      const timer = setTimeout(callback, delay);
      animationTimersRef.current.push(timer);
    },
    [],
  );

  useEffect(
    () => () => {
      animationTimersRef.current.forEach((timer) => clearTimeout(timer));
      animationTimersRef.current = [];
    },
    [],
  );

  const handleAddWidget = useCallback(
    (type: HomeWidgetType) => {
      const widgetId = addWidget(type);

      setEnteringWidgetId(widgetId);
      clearAnimatedStateLater(() => setEnteringWidgetId(null), 340);
    },
    [addWidget, clearAnimatedStateLater],
  );

  const handleRemoveWidget = useCallback(
    (widgetId: string) => {
      if (deletingWidgetId) {
        return;
      }

      setDeletingWidgetId(widgetId);
      clearAnimatedStateLater(() => {
        removeWidget(widgetId);
        setAdjustingWidgetId((current) =>
          current === widgetId ? null : current,
        );
        setDeletingWidgetId(null);
      }, 240);
    },
    [clearAnimatedStateLater, deletingWidgetId, removeWidget],
  );

  useEffect(() => {
    if (!effectiveEditing) {
      setWorkspaceSidebar(null);
      return;
    }

    setWorkspaceSidebar(
      <DashboardHomeWidgetSidebar
        copy={customizerCopy}
        onAddWidget={handleAddWidget}
        onReset={resetWidgets}
      />,
    );

    return () => {
      setWorkspaceSidebar(null);
    };
  }, [
    customizerCopy,
    effectiveEditing,
    handleAddWidget,
    resetWidgets,
    setWorkspaceSidebar,
  ]);

  return (
    <DashboardPageShell className="gap-5">
      <div className="flex flex-col items-stretch gap-3 sm:items-end">
        <div className="flex justify-end">
          {effectiveEditing ? (
            <Button
              className="hidden xl:inline-flex"
              data-testid="home-edit-done-button"
              onClick={stopEditing}
              size="default"
              type="button"
              variant="primary"
            >
              <Check className="size-4" />
              {customizerCopy.done}
            </Button>
          ) : (
            <Button
              className="hidden xl:inline-flex"
              data-testid="home-edit-button"
              onClick={startEditing}
              size="default"
              type="button"
              variant="outline"
            >
              <SlidersHorizontal className="size-4" />
              {customizerCopy.edit}
            </Button>
          )}
          <Button
            className="xl:hidden"
            data-testid="home-manage-button"
            onClick={() => setManagerOpen(true)}
            size="default"
            type="button"
            variant="outline"
          >
            <SlidersHorizontal className="size-4" />
            {customizerCopy.manage}
          </Button>
        </div>
        <DashboardHomeLayoutSaveFeedback
          copy={customizerCopy}
          onRetry={retrySave}
          status={saveStatus}
        />
      </div>

      <div className="relative min-w-0">
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute -inset-2 rounded-surface-panel border-2 border-dashed border-border-subtle opacity-0 transition-opacity duration-200",
            effectiveEditing && "opacity-100",
          )}
          data-testid="home-widget-placement-boundary"
        />
        <div
          className="dashboard-home-widget-grid relative grid min-w-0 gap-4 sm:gap-5"
          data-testid="home-widget-grid"
        >
          {widgets.length === 0 ? (
            <div className="rounded-surface-panel border border-dashed border-ring bg-surface-panel p-8 text-center xl:col-span-5">
              <h2 className="text-xl font-bold text-content-strong">
                {customizerCopy.emptyTitle}
              </h2>
              <p className="mx-auto mt-2 max-w-md break-words text-sm leading-7 text-content-muted">
                {customizerCopy.emptyDescription}
              </p>
            </div>
          ) : (
            widgets.map((widget, index) => (
              <DashboardHomeWidgetCard
                copy={customizerCopy}
                deleting={deletingWidgetId === widget.id}
                dragging={draggingWidgetId === widget.id}
                editing={effectiveEditing}
                entering={enteringWidgetId === widget.id}
                index={index}
                key={widget.id}
                onAdjust={() => setAdjustingWidgetId(widget.id)}
                onDragEnd={() => setDraggingWidgetId(null)}
                onDragStart={() => setDraggingWidgetId(widget.id)}
                onMove={(position) => {
                  updateWidgetLayout(widget.id, {
                    ...widget,
                    ...position,
                  });
                  setDraggingWidgetId(null);
                }}
                onRemove={() => handleRemoveWidget(widget.id)}
                onResize={(layout) => updateWidgetLayout(widget.id, layout)}
                onResizeEnd={() => setResizingWidgetId(null)}
                onResizeStart={() => setResizingWidgetId(widget.id)}
                pauseWiggle={Boolean(
                  draggingWidgetId || resizingWidgetId || adjustingWidgetId,
                )}
                resizing={resizingWidgetId === widget.id}
                widget={widget}
              >
                <DashboardHomeWidgetContent
                  announcements={initialData.announcements}
                  businessBoards={initialData.businessBoards}
                  copy={copy}
                  displayName={initialData.displayName}
                  displayMode={displayMode}
                  greetingPeriod={initialData.greetingPeriod}
                  locale={locale}
                  referralCode={initialData.referralCode}
                  role={initialData.role}
                  todoCopy={todoCopy}
                  todoState={todoState}
                  widget={widget}
                />
              </DashboardHomeWidgetCard>
            ))
          )}
        </div>
      </div>

      <DashboardHomeManagerDialog
        copy={customizerCopy}
        onAddWidget={handleAddWidget}
        onMoveWidget={moveWidget}
        onOpenChange={setManagerOpen}
        onRemoveWidget={handleRemoveWidget}
        onReset={resetWidgets}
        onRetrySave={retrySave}
        open={managerOpen}
        saveStatus={saveStatus}
        widgets={widgets}
      />
      <DashboardHomeWidgetAdjustDialog
        copy={customizerCopy}
        onOpenChange={(open) => {
          if (!open) {
            setAdjustingWidgetId(null);
          }
        }}
        onUpdate={(nextLayout) => {
          if (adjustingWidget) {
            updateWidgetLayout(adjustingWidget.id, nextLayout);
          }
        }}
        open={Boolean(adjustingWidget)}
        widget={adjustingWidget}
      />
    </DashboardPageShell>
  );
}
