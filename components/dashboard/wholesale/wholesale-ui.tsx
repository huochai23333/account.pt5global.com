"use client";

import * as FormControls from "@/components/ui/form-controls";

import type { ReactNode } from "react";

import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MetricCard, MetricGrid } from "@/components/ui/data-display";
import { cn } from "@/lib/utils";

import { DashboardSectionHeader } from "../dashboard-section-header";
import { DashboardPageShell } from "../dashboard-page-shell";
import {
  DashboardFilterField,
  DashboardListHeader,
  DashboardSectionPanel,
  DashboardTableFrame,
  dashboardFilterInputClassName,
} from "../dashboard-section-panel";
import { EmptyState as DashboardEmptyState } from "../dashboard-shared-ui";

export const wholesaleStickyFirstThClassName =
  "sticky left-0 z-30 min-w-[180px] whitespace-normal border-r border-border-subtle bg-surface-inset shadow-surface-interactive";

export const wholesaleStickyFirstTdClassName =
  "sticky left-0 z-20 min-w-[180px] whitespace-normal border-r border-border-subtle bg-surface-interactive shadow-surface-interactive group-hover:bg-surface-inset";

export function WholesalePageShell({
  actions,
  children,
  meta,
  title,
}: {
  actions?: ReactNode;
  children: ReactNode;
  meta?: ReactNode;
  title: string;
}) {
  return (
    <DashboardPageShell
      header={
        <DashboardSectionHeader
          actions={actions}
          meta={meta}
          presentation="work"
          title={title}
        />
      }
    >
      {children}
    </DashboardPageShell>
  );
}

export function WholesalePanel({
  children,
  title,
  description,
}: {
  children: ReactNode;
  title?: string;
  description?: string;
}) {
  const hasHeader = Boolean(title || description);

  return (
    <DashboardSectionPanel className="min-w-0 p-4 sm:p-6 xl:p-8">
      {title ? (
        <DashboardListHeader description={description} title={title} />
      ) : description ? (
        <p className="break-words text-sm leading-7 text-content-muted [overflow-wrap:anywhere]">
          {description}
        </p>
      ) : null}
      <div className={cn(hasHeader ? "mt-4 sm:mt-6" : "")}>{children}</div>
    </DashboardSectionPanel>
  );
}

export function WholesaleEmptyState({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <DashboardEmptyState description={description} icon={icon} title={title} />
  );
}

export function WholesaleStatGrid({
  className,
  stats,
}: {
  className?: string;
  stats: Array<{
    helper?: string;
    icon: ReactNode;
    label: string;
    tone?: "info" | "success" | "warning";
    value: string;
  }>;
}) {
  return (
    // 批发业务的汇总数字与旅游业务共用紧凑摘要条，避免同一级页面出现两套卡片高度和信息层级。
    <MetricGrid className={className} layout="summary-strip">
      {stats.map((stat) => (
        <MetricCard
          description={stat.helper}
          icon={stat.icon}
          key={stat.label}
          label={stat.label}
          presentation="compact"
          tone={stat.tone}
          value={stat.value}
        />
      ))}
    </MetricGrid>
  );
}

export function WholesaleTable({
  children,
  minWidth = 980,
}: {
  children: ReactNode;
  minWidth?: number;
}) {
  return (
    // 长列表在表格内部滚动，配合固定表头避免查看下方订单时失去字段含义。
    <DashboardTableFrame innerClassName="max-h-[72vh] overflow-auto overscroll-contain">
      <table
        data-wholesale-table
        className="w-full border-collapse text-left text-sm [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-surface-inset [&_tbody_tr:last-child_td]:border-b-0"
        style={{ minWidth }}
      >
        {children}
      </table>
    </DashboardTableFrame>
  );
}

export function WholesaleTh({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <th
      className={cn(
        "sticky top-0 z-10 whitespace-nowrap border-b border-border-subtle bg-surface-inset px-5 py-4 text-left font-label text-[11px] font-semibold tracking-[0.18em] text-content-muted uppercase",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function WholesaleTd({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <td
      className={cn(
        "whitespace-nowrap border-b border-border-subtle px-5 py-4 align-top text-sm text-content-strong",
        className,
      )}
    >
      {children}
    </td>
  );
}

export function WholesaleField({
  defaultValue,
  label,
  min,
  name,
  placeholder,
  required,
  step,
  type = "text",
}: {
  defaultValue?: string | number;
  label: string;
  min?: number;
  name: string;
  placeholder?: string;
  required?: boolean;
  step?: string;
  type?: string;
}) {
  return (
    <DashboardFilterField label={label} required={required}>
      <FormControls.Input
        className={dashboardFilterInputClassName}
        defaultValue={defaultValue}
        min={min}
        name={name}
        placeholder={placeholder}
        required={required}
        step={step}
        type={type}
      />
    </DashboardFilterField>
  );
}

export function WholesaleTextarea({
  defaultValue,
  label,
  name,
  placeholder,
}: {
  defaultValue?: string;
  label: string;
  name: string;
  placeholder?: string;
}) {
  return (
    <DashboardFilterField label={label}>
      <FormControls.Textarea
        className={cn(
          dashboardFilterInputClassName,
          "h-auto min-h-24 py-3 sm:h-auto",
        )}
        defaultValue={defaultValue}
        name={name}
        placeholder={placeholder}
      />
    </DashboardFilterField>
  );
}

export function WholesaleSubmitButton({
  children,
  disabled = false,
  pending,
}: {
  // 按钮文字可能来自消息组件，所以这里接收 ReactNode，而不是只接收字符串。
  children: ReactNode;
  disabled?: boolean;
  pending: boolean;
}) {
  return (
    <Button
      variant="primary"
      size="large"
      disabled={disabled || pending}
      type="submit"
    >
      {pending ? <LoaderCircle className="size-4 animate-spin" /> : null}
      {children}
    </Button>
  );
}
