"use client";

import type { ReactNode } from "react";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "../ui/button";
import { DashboardListSection } from "./dashboard-section-panel";

/** 列表卡和加载进度底栏的通用组合。 */
export function DashboardCollectionSection({
  actions,
  ariaLabel,
  children,
  controls,
  count,
  description,
  title,
}: {
  actions?: ReactNode;
  ariaLabel?: string;
  children: ReactNode;
  controls?: ReactNode;
  count?: ReactNode;
  description?: ReactNode;
  title?: ReactNode;
}) {
  return (
    <DashboardListSection
      actions={actions}
      ariaLabel={ariaLabel}
      description={description}
      title={title}
    >
      {children}
      {count ? (
        <DashboardCollectionFooter controls={controls} count={count} />
      ) : null}
    </DashboardListSection>
  );
}

/**
 * 宽列表左右排列，窄列表自动换行；邮件的电脑双栏也可能比手机视口更窄。
 * 数量保留自己的行宽，不能被翻页按钮挤成零宽度而消失。
 */
export function DashboardCollectionFooter({
  controls,
  count,
}: {
  controls?: ReactNode;
  count: ReactNode;
}) {
  return (
    <div className="mt-5 flex flex-col gap-3 border-t border-border-subtle pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <p className="min-w-0 break-words text-sm text-content-muted sm:flex-[1_1_12rem]">{count}</p>
      {controls ? (
        <div className="flex w-full max-w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
          {controls}
        </div>
      ) : null}
    </div>
  );
}

/** 页码分页只负责按钮，范围数量由统一列表底栏负责。 */
export function DashboardPaginationActions({
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
  const t = useTranslations("DashboardPagination");

  return (
    <nav aria-label={t("label")} aria-busy={pending} className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start">
      <Button
        disabled={pending || !hasPreviousPage}
        onClick={onPreviousPage}
        size="compact"
        type="button"
        variant="outline"
      >
        <ChevronLeft className="size-4" />
        {t("previous")}
      </Button>
      <p className="min-w-16 flex-1 text-center text-xs font-medium text-primary sm:text-sm">
        {t("page", { page, pageCount })}
      </p>
      <Button
        disabled={pending || !hasNextPage}
        onClick={onNextPage}
        size="compact"
        type="button"
        variant="outline"
      >
        {t("next")}
        <ChevronRight className="size-4" />
      </Button>
    </nav>
  );
}

/**
 * 页码列表的范围文案与操作栏必须成对出现，因此由一个组件统一组装。
 * 领域列表只传分页数据，不再自行复制“已显示多少条”的位置和样式。
 */
export function DashboardPaginationFooter({
  endIndex,
  hasNextPage,
  hasPreviousPage,
  onNextPage,
  onPreviousPage,
  page,
  pageCount,
  startIndex,
  totalItems,
  pending = false,
}: {
  endIndex: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  onNextPage: () => void;
  onPreviousPage: () => void;
  page: number;
  pageCount: number;
  startIndex: number;
  totalItems: number;
  pending?: boolean;
}) {
  const t = useTranslations("DashboardPagination");

  // 空结果也保留“共 0 条”和禁用的翻页按钮，筛选前后的列表结构保持一致。
  return (
    <DashboardCollectionFooter
      controls={
        <DashboardPaginationActions
          hasNextPage={hasNextPage}
          hasPreviousPage={hasPreviousPage}
          onNextPage={onNextPage}
          onPreviousPage={onPreviousPage}
          page={page}
          pageCount={pageCount}
          pending={pending}
        />
      }
      count={t("range", {
        end: endIndex,
        start: startIndex,
        total: totalItems,
      })}
    />
  );
}

/** 所有双形态列表共用同一个断点和外层间距。 */
