"use client";

import { ArrowRight, BellRing } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { buttonVariants } from "@/components/ui/button-variants";
import { Surface } from "@/components/ui/surface";
import { cn } from "@/lib/utils";

/** “我的”页面只提供入口，连接查询和操作都留在独立详情页中。 */
export function EmailReminderEntryCard({ href }: { href: string }) {
  const t = useTranslations("EmailReminders");
  return (
    <Surface className="p-5 sm:p-6" padding={null}>
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-surface-inset text-primary">
            <BellRing className="size-5" />
          </div>
          <div className="min-w-0">
            <h3 className="break-words text-xl font-bold text-content-strong">{t("entryTitle")}</h3>
            <p className="mt-1 break-words text-sm leading-6 text-content-muted">{t("entryDescription")}</p>
          </div>
        </div>
        <Link className={cn(buttonVariants({ variant: "outline", size: "default", wrap: true }), "w-full sm:w-auto")} href={href}>
          {t("manage")}
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </Surface>
  );
}
