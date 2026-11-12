"use client";

import type { ReactNode } from "react";

import { Bell, ListTodo } from "lucide-react";

import type { AnnouncementRow } from "@/lib/announcements";
import type {
  DashboardHomeGreetingPeriod,
  DashboardHomePageData,
} from "@/lib/dashboard-home";
import { cn } from "@/lib/utils";

import { HomeAnnouncementsWidget } from "./dashboard-home-announcements-widget";
import { getHomeDisplayName } from "./dashboard-home-display";
import {
  HomeClockSection,
  type HomeClockCopy,
} from "./dashboard-home-clock-section";
import {
  HomeInviteSection,
  type HomeInviteCopy,
} from "./dashboard-home-invite-section";
import type { HomeWidgetInstance } from "./dashboard-home-layout";
import { HomeTodosSection } from "./dashboard-home-todo-section";
import type { HomeTodoCopy } from "./dashboard-home-todo-copy";
import type { DashboardHomeTodosState } from "./use-dashboard-home-todos";
import type { HomeWidgetDisplayMode } from "./use-dashboard-home-display-mode";

export type DashboardHomeWidgetCopy = {
  announcements: {
    emptyDescription: string;
    emptyTitle: string;
    sectionDescription: string;
    sectionTitle: string;
  };
  greeting: {
    greeting: Record<DashboardHomeGreetingPeriod, string>;
    subtitle: string;
    title: (name: string) => string;
    unnamedUser: string;
  };
  clock: HomeClockCopy;
  invite: HomeInviteCopy;
  widgets: {
    announcementCount: (count: number) => string;
    todoCount: (count: number) => string;
  };
};

type DashboardHomeWidgetContentProps = {
  announcements: AnnouncementRow[];
  businessBoards: DashboardHomePageData["businessBoards"];
  copy: DashboardHomeWidgetCopy;
  displayName: string | null;
  displayMode: HomeWidgetDisplayMode;
  greetingPeriod: DashboardHomeGreetingPeriod;
  locale: string;
  referralCode: string | null;
  role: DashboardHomePageData["role"];
  todoCopy: HomeTodoCopy;
  todoState: DashboardHomeTodosState;
  widget: HomeWidgetInstance;
};

export function DashboardHomeWidgetContent({
  announcements,
  businessBoards,
  copy,
  displayName,
  displayMode,
  greetingPeriod,
  locale,
  referralCode,
  role,
  todoCopy,
  todoState,
  widget,
}: DashboardHomeWidgetContentProps) {
  if (widget.type === "greeting") {
    return (
      <GreetingWidgetContent
        copy={copy}
        displayName={displayName}
        greetingPeriod={greetingPeriod}
        compactOverride={displayMode === "automatic"}
        widget={widget}
      />
    );
  }

  if (widget.type === "clock") {
    return (
      <HomeClockSection
        copy={copy.clock}
        density={
          displayMode === "automatic"
            ? "compact"
            : getUtilityWidgetDensity(widget)
        }
        locale={locale}
      />
    );
  }

  if (widget.type === "invite") {
    return (
      <HomeInviteSection
        businessBoards={businessBoards}
        copy={copy.invite}
        density={
          displayMode === "automatic"
            ? "compact"
            : getUtilityWidgetDensity(widget)
        }
        referralCode={referralCode}
        role={role}
      />
    );
  }

  if (widget.type === "announcements") {
    return (
      <HomeAnnouncementsWidget
        announcements={announcements}
        compact={
          displayMode === "automatic" ||
          widget.width <= 2 ||
          widget.height <= 2
        }
        copy={copy}
        locale={locale}
      />
    );
  }

  return (
    <TodosWidgetContent
      copy={copy}
      locale={locale}
      todoCopy={todoCopy}
      todoState={todoState}
      densityOverride={displayMode === "automatic" ? "compact" : undefined}
      expandedOverride={displayMode === "automatic"}
      widget={widget}
    />
  );
}

function getUtilityWidgetDensity(widget: HomeWidgetInstance) {
  /*
   * 只有任一方向压到一格时才使用只保留核心信息的迷你模式。
   * 2×2 已能容纳时间的日期/时区和邀请码的全部复制操作，因此使用紧凑模式。
   */
  if (widget.width <= 1 || widget.height <= 1) {
    return "mini" as const;
  }

  if (widget.width <= 2 || widget.height <= 2) {
    return "compact" as const;
  }

  return "comfortable" as const;
}

function GreetingWidgetContent({
  compactOverride,
  copy,
  displayName,
  greetingPeriod,
  widget,
}: Pick<
  DashboardHomeWidgetContentProps,
  "copy" | "displayName" | "greetingPeriod" | "widget"
> & { compactOverride: boolean }) {
  const compact = compactOverride || widget.width <= 2 || widget.height <= 1;
  const name = getHomeDisplayName(displayName, copy.greeting.unnamedUser);

  return (
    <div className="flex h-full min-h-0 flex-col justify-between">
      <div>
        <span className="inline-flex max-w-full items-center gap-2 rounded-full bg-surface-inset px-3 py-1 text-xs font-semibold text-status-success">
          <Bell className="size-3.5 shrink-0" />
          <span className="truncate">
            {copy.greeting.greeting[greetingPeriod]}
          </span>
        </span>
        <h2
          className={cn(
            "mt-4 break-words font-bold tracking-tight text-content-strong",
            compact ? "text-xl" : "text-3xl sm:text-4xl",
          )}
        >
          {copy.greeting.title(name)}
        </h2>
      </div>
      {!compact ? (
        <p className="mt-4 max-w-2xl break-words text-sm leading-7 text-content-muted">
          {copy.greeting.subtitle}
        </p>
      ) : null}
    </div>
  );
}

function TodosWidgetContent({
  copy,
  densityOverride,
  expandedOverride,
  locale,
  todoCopy,
  todoState,
  widget,
}: Pick<
  DashboardHomeWidgetContentProps,
  "copy" | "locale" | "todoCopy" | "todoState" | "widget"
> & {
  densityOverride?: "compact";
  expandedOverride: boolean;
}) {
  const compact =
    !expandedOverride && (widget.width <= 2 || widget.height <= 2);

  if (compact) {
    const visibleTodo = todoState.todos.find((todo) => !todo.is_completed);

    return (
      <CompactSummary
        description={visibleTodo?.title ?? todoCopy.empty.active.description}
        icon={<ListTodo className="size-5" />}
        metric={copy.widgets.todoCount(todoState.counts.active)}
        title={todoCopy.title}
      />
    );
  }

  return (
    <HomeTodosSection
      copy={todoCopy}
      density={
        densityOverride ?? (widget.height <= 3 ? "compact" : "comfortable")
      }
      frame="plain"
      locale={locale}
      state={todoState}
    />
  );
}

function CompactSummary({
  description,
  icon,
  metric,
  title,
}: {
  description: string;
  icon: ReactNode;
  metric: string;
  title: string;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col justify-between gap-4">
      <div className="flex items-center gap-2 text-primary">
        {icon}
        <span className="min-w-0 truncate text-sm font-semibold text-content-strong">
          {title}
        </span>
      </div>
      <div>
        <p className="break-words text-[clamp(1rem,4vw,1.5rem)] font-bold leading-tight text-content-strong">
          {metric}
        </p>
        <p className="mt-2 line-clamp-3 break-words text-sm leading-6 text-content-muted">
          {description}
        </p>
      </div>
    </div>
  );
}
