"use client";

import { LoaderCircle } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import {
  getWorkspaceConfigForPathname,
  type WorkspaceLoadingTitleKey,
} from "@/lib/workspace-config";
import { DashboardPageShell } from "./dashboard-page-shell";

type WorkspaceLoadingShellProps = {
  description?: string;
  title?: string;
  titleKey?: WorkspaceLoadingTitleKey;
};

// 路径只用于选择加载标题，骨架屏不读取业务数据，也不代表当前用户已获得目标页权限。
export function WorkspaceLoadingShell({
  description,
  title,
  titleKey,
}: WorkspaceLoadingShellProps) {
  const pathname = usePathname();
  const shellT = useTranslations("WorkspaceLoadingShell");
  const titleT = useTranslations("WorkspaceLoadingTitles");
  const resolvedDescription = description ?? shellT("description");
  const resolvedTitleKey =
    titleKey ?? getWorkspaceConfigForPathname(pathname)?.routeSegment;
  const resolvedTitle =
    title ?? (resolvedTitleKey ? titleT(resolvedTitleKey) : shellT("title"));

  return (
    <div aria-busy="true" aria-live="polite" role="status">
      <DashboardPageShell>
        <div className="rounded-surface-panel border border-surface-panel-border bg-surface-inset/92 p-6 shadow-surface-interactive xl:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-3">
              <div className="motion-skeleton h-6 w-28 rounded-full bg-surface-inset" />
              <div className="motion-skeleton h-10 w-64 max-w-full rounded-full bg-surface-inset" />
              <p className="max-w-2xl text-[15px] leading-8 text-content-muted">
                {resolvedDescription}
              </p>
            </div>

            <div className="flex items-center gap-3 rounded-full bg-surface-interactive px-5 py-3 text-primary shadow-surface-interactive">
              <LoaderCircle className="size-5 animate-spin" />
              <span className="text-sm font-medium">{resolvedTitle}</span>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
          <div className="space-y-6 rounded-surface-panel border border-surface-panel-border bg-surface-panel p-6 shadow-surface-interactive xl:p-8">
            <div className="motion-skeleton h-8 w-56 max-w-full rounded-full bg-surface-inset" />
            <div className="grid gap-4 sm:grid-cols-2">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          </div>

          <div className="space-y-4 rounded-surface-panel border border-surface-panel-border bg-surface-panel p-6 shadow-surface-interactive xl:p-8">
            <div className="motion-skeleton h-8 w-40 rounded-full bg-surface-inset" />
            <SkeletonBlock />
            <SkeletonBlock />
            <SkeletonBlock />
          </div>
        </div>
      </DashboardPageShell>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-surface-panel border border-border-subtle bg-surface-inset p-5 shadow-surface-interactive">
      <div className="motion-skeleton h-4 w-24 rounded-full bg-surface-inset" />
      <div className="motion-skeleton mt-4 h-24 rounded-record-card bg-surface-inset" />
      <div className="motion-skeleton mt-4 h-4 w-32 rounded-full bg-surface-inset" />
    </div>
  );
}

function SkeletonBlock() {
  return (
    <div className="motion-skeleton h-20 rounded-surface-inset bg-surface-inset" />
  );
}
