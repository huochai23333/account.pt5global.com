"use client";

import type { CSSProperties, ReactNode } from "react";

import { SlidersHorizontal, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { HomeCustomizerCopy } from "./dashboard-home-customizer-copy";
import { HOME_WIDGET_ROW_UNIT_PX, type HomeWidgetInstance } from "./dashboard-home-layout";
import { HOME_WIDGET_ICONS } from "./dashboard-home-widget-meta";
import {
  startHomeWidgetPositionDrag,
  startHomeWidgetResize,
} from "./dashboard-home-widget-interactions";
import { DashboardHomeWidgetResizeHandle } from "./dashboard-home-widget-resize-handle";
import { useDashboardHomeWidgetResizeHandle } from "./use-dashboard-home-widget-resize-handle";

type DashboardHomeWidgetCardProps = {
  children: ReactNode;
  copy: HomeCustomizerCopy;
  deleting: boolean;
  dragging: boolean;
  editing: boolean;
  entering: boolean;
  index: number;
  onAdjust: () => void;
  onDragEnd: () => void;
  onDragStart: () => void;
  onMove: (position: Pick<HomeWidgetInstance, "x" | "y">) => void;
  onRemove: () => void;
  onResize: (layout: Pick<HomeWidgetInstance, "height" | "width" | "x" | "y">) => void;
  onResizeEnd: () => void;
  onResizeStart: () => void;
  pauseWiggle: boolean;
  resizing: boolean;
  widget: HomeWidgetInstance;
};

export function DashboardHomeWidgetCard({
  children,
  copy,
  deleting,
  dragging,
  editing,
  entering,
  index,
  onAdjust,
  onDragEnd,
  onDragStart,
  onMove,
  onRemove,
  onResize,
  onResizeEnd,
  onResizeStart,
  pauseWiggle,
  resizing,
  widget,
}: DashboardHomeWidgetCardProps) {
  const { handleResizePointerLeave, handleResizePointerMove, pointerOnControl, resizeHandle } =
    useDashboardHomeWidgetResizeHandle({
      deleting,
      dragging,
      editing,
      entering,
      resizing,
    });
  /*
   * 外层始终是静止的网格定位层，内层才播放摇晃。
   * 拖动和缩放只读取外层尺寸，因此动画中的旋转不会改变计算边界；
   * 靠近缩放边缘时再暂停内层动画，视觉上也会先停稳再开始操作。
   */
  const shouldWiggle =
    editing &&
    !deleting &&
    !entering &&
    !dragging &&
    !resizing &&
    !pauseWiggle &&
    !pointerOnControl &&
    !resizeHandle;

  return (
    <div
      className={cn(
        "dashboard-home-widget-card group relative min-w-0 transition-[opacity,scale] duration-200",
        deleting && "dashboard-home-widget-exit pointer-events-none",
        dragging && "scale-[1.01] opacity-72",
        entering && "dashboard-home-widget-enter",
      )}
      data-home-widget-id={widget.id}
      data-home-widget-height={widget.height}
      data-home-widget-type={widget.type}
      data-home-widget-width={widget.width}
      data-home-widget-wiggling={shouldWiggle ? "true" : "false"}
      data-testid="home-widget-card"
      onPointerDown={(event) => {
        startHomeWidgetPositionDrag(event, {
          editing,
          onDragEnd,
          onDragStart,
          onMove,
          widget,
        });
      }}
      onPointerLeave={handleResizePointerLeave}
      onPointerMove={handleResizePointerMove}
      style={
        {
          "--home-widget-grid-column": `${widget.x + 1} / span ${widget.width}`,
          "--home-widget-grid-row": `${widget.y + 1} / span ${widget.height}`,
          "--home-widget-min-height": `${widget.height * HOME_WIDGET_ROW_UNIT_PX}px`,
        } as CSSProperties
      }
    >
      <article
        className={cn(
          "relative h-full min-h-0 rounded-surface-panel border border-surface-panel-border bg-surface-panel shadow-surface-interactive backdrop-blur transition-[box-shadow,border-color] duration-200",
          editing ? "overflow-visible p-3" : "overflow-hidden p-4 sm:p-5",
          editing &&
            !deleting &&
            !entering &&
            !dragging &&
            !resizing &&
            "cursor-grab border-ring bg-surface-overlay shadow-surface-interactive ring-1 ring-ring/20 active:cursor-grabbing",
          shouldWiggle && "dashboard-home-wiggle",
          editing &&
            (deleting || entering || resizing) &&
            "border-ring bg-surface-overlay shadow-surface-interactive",
          dragging && "shadow-surface-interactive ring-4 ring-ring/45",
          resizing && "border-ring bg-surface-overlay ring-2 ring-ring/35",
        )}
        style={{ animationDelay: `${(index % 5) * -45}ms` }}
      >
        {editing && resizeHandle ? (
          <DashboardHomeWidgetResizeHandle
            copy={copy}
            handle={resizeHandle}
            onPointerDown={(event) => {
              startHomeWidgetResize(event, widget, resizeHandle.direction, {
                onResize,
                onResizeEnd,
                onResizeStart,
              });
            }}
          />
        ) : null}

        {editing ? (
          <DashboardHomeWidgetEditorContent
            copy={copy}
            onAdjust={onAdjust}
            onRemove={onRemove}
            widget={widget}
          >
            {children}
          </DashboardHomeWidgetEditorContent>
        ) : (
          <div className="h-full min-h-0">{children}</div>
        )}
      </article>
    </div>
  );
}

function DashboardHomeWidgetEditorContent({
  children,
  copy,
  onAdjust,
  onRemove,
  widget,
}: {
  children: ReactNode;
  copy: HomeCustomizerCopy;
  onAdjust: () => void;
  onRemove: () => void;
  widget: HomeWidgetInstance;
}) {
  const WidgetIcon = HOME_WIDGET_ICONS[widget.type];
  const compactEditor = widget.height === 1 || widget.width === 1;

  const actions = (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        aria-label={copy.adjustWidget}
        data-home-widget-control="true"
        data-testid="home-widget-adjust-button"
        onClick={onAdjust}
        onPointerDown={(event) => event.stopPropagation()}
        size="icon"
        title={copy.adjustWidget}
        type="button"
        variant="secondary"
      >
        <SlidersHorizontal className="size-4" />
      </Button>
      <Button
        aria-label={copy.removeWidget}
        data-home-widget-control="true"
        data-testid="home-widget-remove-button"
        onClick={onRemove}
        onPointerDown={(event) => event.stopPropagation()}
        size="icon"
        title={copy.removeWidget}
        type="button"
        variant="secondary"
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );

  if (compactEditor) {
    /*
     * 一行高或一列宽的卡片没有足够空间继续展示完整业务内容。
     * 编辑时只保留名称、尺寸和两个明确操作，避免内容被工具按钮遮住。
     */
    return (
      <div
        className="flex h-full min-h-0 items-center gap-2"
        data-testid="home-widget-editor-compact"
      >
        <span
          className={cn(
            "inline-flex size-9 shrink-0 items-center justify-center rounded-control-default bg-surface-inset text-primary",
          )}
        >
          <WidgetIcon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-sm font-semibold text-content-strong"
            data-testid="home-widget-editor-label"
          >
            {copy.widgets[widget.type].title}
          </p>
          <p className="truncate text-xs text-content-muted">
            {copy.sizeLabel(widget.width, widget.height)}
          </p>
        </div>
        {actions}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className="flex min-h-11 shrink-0 items-center gap-2"
        data-testid="home-widget-editor-toolbar"
      >
        <span
          className={cn(
            "inline-flex size-9 shrink-0 items-center justify-center rounded-control-default bg-surface-inset text-primary",
          )}
        >
          <WidgetIcon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-sm font-semibold text-content-strong"
            data-testid="home-widget-editor-label"
          >
            {copy.widgets[widget.type].title}
          </p>
          <p className="truncate text-xs text-content-muted">
            {copy.sizeLabel(widget.width, widget.height)}
          </p>
        </div>
        {actions}
      </div>
      <div
        className="mt-2 min-h-0 flex-1 overflow-hidden rounded-surface-inset border border-border-subtle bg-surface-inset p-2"
        data-testid="home-widget-editor-preview"
      >
        {children}
      </div>
    </div>
  );
}
