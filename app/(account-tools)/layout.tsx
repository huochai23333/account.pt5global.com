import type { ReactNode } from "react";

import { PageReveal } from "@/components/motion/page-reveal";

import "../workspace.css";

/** 独立账号工具不依赖业务工作台，确保没有已启用业务的内部员工仍可使用。 */
export default function AccountToolsLayout({ children }: { children: ReactNode }) {
  return (
    <PageReveal className="min-h-screen bg-background">
      <main className="min-h-screen px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </PageReveal>
  );
}
