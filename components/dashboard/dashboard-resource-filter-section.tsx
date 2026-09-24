"use client";

import { useState, type ReactNode } from "react";

import { ChevronDown, RefreshCcw } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "../ui/button";
import {
  DashboardFilterPanel,
  DashboardSectionPanel,
} from "./dashboard-section-panel";

/**
 * 非订单和订单页面共同使用的筛选卡底座。
 * 日期快捷项等领域功能放进 footer，不需要再复制整个筛选卡。
 */
export function DashboardResourceFilterSection({
  children,
  activeFilterCount = 0,
  activeFilterSummary,
  defaultMobileExpanded = false,
  collapseDesktop = false,
  footer,
  gridClassName,
  onReset,
  primary,
  resetDisabled = true,
  resetLabel,
  summary,
}: {
  children?: ReactNode;
  activeFilterCount?: number;
  activeFilterSummary?: ReactNode;
  defaultMobileExpanded?: boolean;
  collapseDesktop?: boolean;
  footer?: ReactNode;
  gridClassName?: string;
  onReset?: () => void;
  primary?: ReactNode;
  resetDisabled?: boolean;
  resetLabel?: ReactNode;
  summary?: ReactNode;
}) {
  const t = useTranslations("DashboardFramework.filters");
  const [mobileExpanded, setMobileExpanded] = useState(defaultMobileExpanded);
  const [desktopExpanded, setDesktopExpanded] = useState(activeFilterCount > 0);
  const showDesktopFilters = !collapseDesktop || desktopExpanded;
  const hasSecondaryFilters = Boolean(children);
  const resolvedActiveSummary =
    activeFilterSummary ??
    (activeFilterCount > 0 ? t("active", { count: activeFilterCount }) : null);
  const resolvedFooter =
    summary || footer ? (
      <div className="flex flex-col gap-2">
        {summary ? (
          <div className="text-sm leading-6 text-content-muted">{summary}</div>
        ) : null}
        {footer}
      </div>
    ) : undefined;

  return (
    <DashboardSectionPanel className="p-3 sm:p-4">
      {primary || onReset ? (
        <div className="flex min-w-0 items-end gap-2">
          {primary ? <div className="min-w-0 flex-1">{primary}</div> : null}
          {collapseDesktop && hasSecondaryFilters ? (
            <Button aria-expanded={showDesktopFilters} className="hidden shrink-0 sm:inline-flex" onClick={() => setDesktopExpanded((current) => !current)} size="compact" type="button" variant="outline">
              {showDesktopFilters ? t("collapse") : t("expand")}
              <ChevronDown className={`size-4 transition-transform ${showDesktopFilters ? "rotate-180" : ""}`} />
            </Button>
          ) : null}
          {onReset ? (
            <Button
              className="hidden shrink-0 sm:inline-flex"
              disabled={resetDisabled}
              onClick={onReset}
              type="button"
              variant="outline"
              size="compact"
              wrap
            >
              <RefreshCcw className="size-4 shrink-0" />
              {resetLabel ?? t("reset")}
            </Button>
          ) : null}
          {onReset && !hasSecondaryFilters ? (
            <Button
              aria-label={String(resetLabel ?? t("reset"))}
              className="shrink-0 sm:hidden"
              disabled={resetDisabled}
              onClick={onReset}
              size="default"
              type="button"
              variant="ghost"
            >
              <RefreshCcw className="size-4" />
            </Button>
          ) : null}
        </div>
      ) : null}

      {resolvedActiveSummary ? (
        <p
          aria-live="polite"
          className="mt-1.5 text-xs leading-5 text-content-muted sm:text-sm"
        >
          {resolvedActiveSummary}
        </p>
      ) : null}

      {hasSecondaryFilters ? (
        <div className="mt-2.5 flex items-center gap-2 sm:hidden">
          <Button
            aria-expanded={mobileExpanded}
            className="min-w-0 flex-1 justify-between"
            onClick={() => setMobileExpanded((current) => !current)}
            size="default"
            type="button"
            variant="outline"
          >
            <span className="truncate">
              {mobileExpanded ? t("collapse") : t("expand")}
              {activeFilterCount > 0
                ? ` · ${t("count", { count: activeFilterCount })}`
                : ""}
            </span>
            <ChevronDown
              className={`size-4 shrink-0 transition-transform ${
                mobileExpanded ? "rotate-180" : "rotate-0"
              }`}
            />
          </Button>
          {onReset ? (
            <Button
              aria-label={String(resetLabel ?? t("reset"))}
              disabled={resetDisabled}
              onClick={onReset}
              size="default"
              type="button"
              variant="ghost"
            >
              <RefreshCcw className="size-4" />
            </Button>
          ) : null}
        </div>
      ) : null}

      <div
        className={mobileExpanded
          ? showDesktopFilters ? "block" : "block sm:hidden"
          : showDesktopFilters ? "hidden sm:block" : "hidden"}
        data-mobile-filter-expanded={mobileExpanded ? "true" : "false"}
      >
        {hasSecondaryFilters || resolvedFooter ? (
          <DashboardFilterPanel
            className="mt-2.5 sm:mt-3"
            footer={resolvedFooter}
            gridClassName={gridClassName}
          >
            {children}
          </DashboardFilterPanel>
        ) : null}
      </div>
    </DashboardSectionPanel>
  );
}
