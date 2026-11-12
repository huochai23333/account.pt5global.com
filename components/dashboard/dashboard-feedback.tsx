/** 复用加载与空数据的视觉结构；调用方仍需区分真正空数据和读取失败。 */
"use client";

import type { ReactNode } from "react";

import { LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";

import { Surface } from "@/components/ui/surface";

export function LoadingState() {
  const t = useTranslations("DashboardShared");
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-[1320px] items-center justify-center">
      <Surface
        className="motion-surface-enter flex items-center gap-3 text-sm text-content-muted"
        padding="compact"
      >
        <LoaderCircle className="size-4 animate-spin text-primary" />
        {t("loading")}
      </Surface>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="motion-surface-enter flex min-h-[280px] flex-col items-center justify-center rounded-surface-panel border border-dashed border-border bg-surface-panel px-6 py-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-status-info-soft text-status-info">
        {icon}
      </div>
      <p className="mt-5 text-lg font-semibold text-content-strong">{title}</p>
      <p className="mt-2 max-w-md text-sm leading-7 text-content-muted">{description}</p>
    </div>
  );
}
