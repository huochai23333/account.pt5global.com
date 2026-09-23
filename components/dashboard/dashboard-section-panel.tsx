"use client";

import type { ComponentProps, ReactNode } from "react";

import { Search } from "lucide-react";

import { controlVariants, Field, Input } from "@/components/ui/form-controls";
import { Surface, surfaceVariants } from "@/components/ui/surface";
import { cn } from "@/lib/utils";

type DashboardPanelContentProps = {
  children: ReactNode;
  className?: string;
};

type DashboardSectionPanelProps = DashboardPanelContentProps & {
  ariaLabel?: string;
};

type DashboardFilterPanelProps = DashboardPanelContentProps & {
  gridClassName?: string;
  footer?: ReactNode;
  variant?: "inset" | "standalone";
};

type DashboardListHeaderProps = {
  actions?: ReactNode;
  className?: string;
  description?: ReactNode;
  eyebrow?: ReactNode;
  title?: ReactNode;
};

type DashboardListSectionProps = DashboardSectionPanelProps & {
  actions?: ReactNode;
  bodyClassName?: string;
  description?: ReactNode;
  eyebrow?: ReactNode;
  headerClassName?: string;
  title?: ReactNode;
};

type DashboardTableFrameProps = DashboardPanelContentProps & {
  footer?: ReactNode;
  innerClassName?: string;
};

type DashboardSearchInputProps = {
  ariaLabel?: string;
  className?: string;
  onChange: (value: string) => void;
  onKeyDown?: ComponentProps<"input">["onKeyDown"];
  placeholder: string;
  value: string;
};

export function DashboardSectionPanel({
  ariaLabel,
  children,
  className,
}: DashboardSectionPanelProps) {
  return (
    <Surface
      // 可见标题被精简后，aria-label 仍会让读屏软件把这个 section 识别成有名称的业务区域。
      aria-label={ariaLabel}
      className={cn("motion-surface-enter", className)}
      padding="spacious"
    >
      {children}
    </Surface>
  );
}

export function DashboardFilterPanel({
  children,
  className,
  footer,
  gridClassName,
  variant = "inset",
}: DashboardFilterPanelProps) {
  return (
    <div
      className={cn(
        variant === "inset" &&
          cn(
            surfaceVariants({ padding: null, variant: "inset" }),
            "p-3",
            "motion-surface-enter",
          ),
        variant === "standalone" &&
          cn(
            surfaceVariants({ padding: "compact", variant: "panel" }),
            "motion-surface-enter",
          ),
        className,
      )}
    >
      <div className={cn("grid gap-2.5 sm:gap-3", gridClassName)}>
        {children}
      </div>
      {footer ? <div className="mt-3">{footer}</div> : null}
    </div>
  );
}

export function DashboardListHeader({
  actions,
  className,
  description,
  eyebrow,
  title,
}: DashboardListHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-3",
        className,
      )}
    >
      {eyebrow || title || description ? (
        <div className="min-w-0">
          {eyebrow ? (
            <p className="font-label text-[11px] font-semibold tracking-[0.18em] text-content-muted uppercase">
              {eyebrow}
            </p>
          ) : null}
          {title ? (
            <h3
              className={cn(
                "text-xl font-bold tracking-tight text-content-strong sm:text-2xl",
                eyebrow ? "mt-2" : "",
              )}
            >
              {title}
            </h3>
          ) : null}
          {description ? (
            <p
              className={cn(
                "text-sm leading-6 text-content-muted sm:leading-7",
                title || eyebrow ? "mt-1.5 sm:mt-2" : "",
              )}
            >
              {description}
            </p>
          ) : null}
        </div>
      ) : null}
      {actions ? (
        <div className="flex flex-wrap gap-2 sm:justify-end">{actions}</div>
      ) : null}
    </div>
  );
}

export function DashboardListSection({
  actions,
  ariaLabel,
  bodyClassName,
  children,
  className,
  description,
  eyebrow,
  headerClassName,
  title,
}: DashboardListSectionProps) {
  // 标题、眉题或必要说明属于“内容介绍”；只有操作按钮时不再生成空标题，只保留紧凑工具栏。
  const hasVisibleIntroduction = Boolean(title || description || eyebrow);
  const hasActions = Boolean(actions);

  return (
    <DashboardSectionPanel ariaLabel={ariaLabel} className={className}>
      {hasVisibleIntroduction ? (
        <DashboardListHeader
          actions={actions}
          className={headerClassName}
          description={description}
          eyebrow={eyebrow}
          title={title}
        />
      ) : hasActions ? (
        <div
          className={cn(
            "flex min-w-0 flex-wrap items-center justify-end gap-2",
            headerClassName,
          )}
          data-slot="dashboard-list-toolbar"
        >
          {actions}
        </div>
      ) : null}
      <div
        className={cn(
          hasVisibleIntroduction
            ? "mt-4 sm:mt-6"
            : hasActions
              ? "mt-3"
              : "",
          bodyClassName,
        )}
        data-motion-collection="true"
      >
        {children}
      </div>
    </DashboardSectionPanel>
  );
}

export function DashboardTableFrame({
  children,
  className,
  footer,
  innerClassName,
}: DashboardTableFrameProps) {
  return (
    <div
      className={cn(
        surfaceVariants({ padding: null, variant: "interactive" }),
        "motion-surface-enter overflow-hidden hover:border-border-subtle sm:rounded-surface-panel",
        className,
      )}
    >
      <div
        className={cn("overflow-x-auto", innerClassName)}
        data-motion-collection="true"
      >
        {children}
      </div>
      {footer ? (
        <div className="px-4 pb-4 sm:px-5 sm:pb-5">{footer}</div>
      ) : null}
    </div>
  );
}

/**
 * 筛选控件使用较浅的静止边界，避免一排选项同时抢夺注意力。
 * 悬停和键盘聚焦仍会加深，因此浅色不是通过牺牲交互反馈实现的。
 */
export const dashboardFilterInputClassName = cn(
  controlVariants({ controlSize: "compact", density: "filter" }),
);

export function DashboardFilterField({
  children,
  controlId,
  label,
  required = false,
}: {
  children: ReactNode;
  controlId?: string;
  label: ReactNode;
  required?: boolean;
}) {
  return (
    <Field controlId={controlId} density="filter" label={label} required={required}>
      {children}
    </Field>
  );
}

export function DashboardSearchInput({
  ariaLabel,
  className,
  onChange,
  onKeyDown,
  placeholder,
  value,
}: DashboardSearchInputProps) {
  return (
    <div
      className={cn("relative min-w-0", className)}
      data-slot="dashboard-search-input"
    >
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute start-3 top-1/2 z-10 size-4 -translate-y-1/2 text-content-subtle"
        data-slot="dashboard-search-input-icon"
      />
      <Input
        // `ps-10!` 会覆盖桌面断点的普通横向内边距，始终为图标保留完整文字槽位。
        aria-label={ariaLabel}
        className="ps-10!"
        // 工作台搜索用于列表和筛选，不承担长表单录入；桌面压缩到 40px，移动端令牌仍保持 44px。
        controlSize="compact"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        type="search"
        value={value}
      />
    </div>
  );
}
