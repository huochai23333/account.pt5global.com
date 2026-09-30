"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import {
  DashboardCollectionFooter,
  DashboardCollectionSection,
  DashboardLoadMoreButton,
  DashboardPaginationActions,
} from "./dashboard-collection-section";

export type DashboardOrderListUnit =
  "logisticsOrders" | "orders";

export type DashboardOrderListProgress =
  | {
      end: number;
      kind: "range";
      start: number;
      total: number;
      unit: DashboardOrderListUnit;
    }
  | {
      kind: "loaded";
      shown: number;
      total: number;
      unit: DashboardOrderListUnit;
    };

/**
 * 四类订单页面共用的列表卡。
 * 数量提示固定在左侧，分页或继续加载固定在右侧；移动端自动上下排列。
 */
export function DashboardOrderListSection({
  ariaLabel,
  children,
  controls,
  progress,
}: {
  ariaLabel: string;
  children: ReactNode;
  controls?: ReactNode;
  progress?: DashboardOrderListProgress | null;
}) {
  const count = progress ? (
    <DashboardOrderProgressText progress={progress} />
  ) : null;

  return (
    <DashboardCollectionSection
      ariaLabel={ariaLabel}
      controls={progress && progress.total > 0 ? controls : undefined}
      count={progress && progress.total > 0 ? count : undefined}
    >
      {children}
    </DashboardCollectionSection>
  );
}

export function DashboardOrderListFooter({
  controls,
  progress,
}: {
  controls?: ReactNode;
  progress: DashboardOrderListProgress;
}) {
  return (
    <DashboardCollectionFooter
      controls={controls}
      count={<DashboardOrderProgressText progress={progress} />}
    />
  );
}

function DashboardOrderProgressText({
  progress,
}: {
  progress: DashboardOrderListProgress;
}) {
  const t = useTranslations("OrderListFramework");
  const unit = t(`units.${progress.unit}`);
  const countText =
    progress.kind === "range"
      ? t("list.range", {
          end: progress.end,
          start: progress.start,
          total: progress.total,
          unit,
        })
      : t("list.loaded", {
          shown: progress.shown,
          total: progress.total,
          unit,
        });

  return <>{countText}</>;
}

export function DashboardOrderLoadMoreButton({
  loading,
  onClick,
}: {
  loading: boolean;
  onClick: () => void;
}) {
  const t = useTranslations("OrderListFramework");

  return (
    <DashboardLoadMoreButton
      label={t("list.loadMore")}
      loading={loading}
      loadingLabel={t("list.loadingMore")}
      onClick={onClick}
    />
  );
}

/** 普通订单继续使用页码分页，只复用统一底栏右侧的操作样式。 */
export function DashboardOrderPaginationActions({
  hasNextPage,
  hasPreviousPage,
  onNextPage,
  onPreviousPage,
  page,
  pageCount,
}: {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  onNextPage: () => void;
  onPreviousPage: () => void;
  page: number;
  pageCount: number;
}) {
  return (
    <DashboardPaginationActions
      hasNextPage={hasNextPage}
      hasPreviousPage={hasPreviousPage}
      onNextPage={onNextPage}
      onPreviousPage={onPreviousPage}
      page={page}
      pageCount={pageCount}
    />
  );
}
