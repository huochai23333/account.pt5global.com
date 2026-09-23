import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";

import { buttonVariants } from "@/components/ui/button-variants";
import { Surface } from "@/components/ui/surface";
import type { CompanyTemplateSummary } from "@/lib/company-templates/model";
import { cn } from "@/lib/utils";
import { CompanyTemplateDesktopFrame } from "./company-template-desktop-frame";

/** 公司模板需要宽屏连续录入；查看器只负责页面组装，实际窗口由桌面限定组件控制。 */
export function CompanyTemplateViewer({ guide, template, text, workspace }: {
  guide: boolean;
  template: CompanyTemplateSummary;
  text: (key: string) => string;
  workspace: string;
}) {
  const src = `/api/company-templates/${template.id}/content${guide ? "?kind=guide" : ""}`;
  return <section className="mx-auto flex w-full max-w-[1600px] flex-col gap-4">
    <Surface as="div" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" padding="compact">
      <div className="min-w-0">
        <h2 className="break-words text-lg font-bold text-content-strong">{guide ? text("viewer.guideTitle") : template.name}</h2>
        <p className="text-sm text-content-muted">{text("viewer.refreshNotice")}</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Link className={cn(buttonVariants({ variant: "outline", size: "compact" }))} href={`/${workspace}/company-templates`}><ArrowLeft className="size-4" />{text("actions.back")}</Link>
        {!guide && template.currentVersion.guide_sha256 ? <Link className={cn(buttonVariants({ variant: "secondary", size: "compact" }))} href={`/${workspace}/company-templates/${template.id}/guide`}><BookOpen className="size-4" />{text("actions.guide")}</Link> : null}
      </div>
    </Surface>
    <Surface as="div" className="overflow-hidden" padding={null}>
      <CompanyTemplateDesktopFrame notice={text("viewer.desktopOnly")} src={src} title={guide ? text("viewer.guideTitle") : template.name} />
    </Surface>
  </section>;
}
