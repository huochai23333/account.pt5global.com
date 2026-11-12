import type { Metadata } from "next";

import { LegalPage } from "@/components/legal/legal-page";
import { getLegalPageCopy, getLegalPageMetadata } from "@/lib/legal-content";
import { TERMS_OF_SERVICE_PATH } from "@/lib/legal-routes";

export async function generateMetadata(): Promise<Metadata> {
  return getLegalPageMetadata("terms");
}

export default async function TermsPage() {
  const copy = await getLegalPageCopy("terms");

  // 共用页面结构内已为语言切换按钮提供所需文案。
  return <LegalPage activePath={TERMS_OF_SERVICE_PATH} copy={copy} />;
}
