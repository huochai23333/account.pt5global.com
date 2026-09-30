"use client";

import { useTranslations } from "next-intl";
import { LoaderCircle } from "lucide-react";

import { Surface } from "@/components/ui/surface";

/** 路由切换后继续提示等待；正文载入后由 iframe 自己的状态提示接管。 */
export default function CompanyTemplateLoading() {
  const t = useTranslations("CompanyTemplates");
  return <section className="mx-auto w-full max-w-[1600px]">
    <Surface as="div" className="flex min-h-40 items-center justify-center gap-3 text-sm text-content-muted" padding="compact" role="status">
      <LoaderCircle aria-hidden="true" className="size-5 animate-spin motion-reduce:animate-none" />
      <span>{t("viewer.loading")}</span>
    </Surface>
  </section>;
}
