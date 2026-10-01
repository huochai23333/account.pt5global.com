"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import {
  DashboardCollectionFooter,
  DashboardCollectionSection,
  DashboardPaginationActions,
} from "./dashboard-collection-section";

export type DashboardOrderListUnit =
  "logisticsOrders" | "orders";

export type DashboardOrderListProgress = {
  end: number;
  kind: "range";
  start: number;
  total: number;
  unit: DashboardOrderListUnit;
};

/**
 * 订单与物流共用的列表卡。
 * 数量提示固定在左侧，页码操作固定在右侧；移动端自动上下排列。
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
  const t = useTranslations("DashboardPagination");
  const countText = t("range", { end: progress.end, start: progress.start, total: progress.total });

  return <>{countText}</>;
}

/** 订单与其他记录列表共用同一页码操作栏。 */
export function DashboardOrderPaginationActions({
  hasNextPage,
  hasPreviousPage,
  onNextPage,
  onPreviousPage,
  page,
  pageCount,
  pending = false,
}: {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  onNextPage: () => void;
  onPreviousPage: () => void;
  page: number;
  pageCount: number;
  pending?: boolean;
}) {
  return (
    <DashboardPaginationActions
      hasNextPage={hasNextPage}
      hasPreviousPage={hasPreviousPage}
      onNextPage={onNextPage}
      onPreviousPage={onPreviousPage}
      page={page}
      pageCount={pageCount}
      pending={pending}
    />
  );
}
