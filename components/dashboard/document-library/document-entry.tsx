"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { FolderOpen } from "lucide-react";
import { getWorkspaceBasePath } from "@/lib/auth-routing";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

/** 同一入口按人员或客户编号定位资料，名称只用于页面展示。 */
export function DocumentEntry({ userId, customerId }: { userId?: string; customerId?: string }) {
  const base = getWorkspaceBasePath(usePathname());
  // 详情页使用已加载的共享文案，不要求人员、客户页面加载整套资料库消息。
  const t = useTranslations("UiText.shared");
  const params = new URLSearchParams(customerId ? { customer: customerId } : userId ? { user: userId } : {});
  // 人员、客户和本人详情共用这一入口，统一跟随工作台的电脑端导航分界。
  return <Link className={cn(buttonVariants({ size: "compact", variant: "outline" }), "hidden lg:inline-flex")} href={`${base}/documents${params.size ? `?${params}` : ""}`}><FolderOpen className="size-4" aria-hidden />{t("documentsView")}</Link>;
}
