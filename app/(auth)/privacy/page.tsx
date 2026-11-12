import type { Metadata } from "next";

import { LegalPage } from "@/components/legal/legal-page";
import { getLegalPageCopy, getLegalPageMetadata } from "@/lib/legal-content";
import { PRIVACY_POLICY_PATH } from "@/lib/legal-routes";

export async function generateMetadata(): Promise<Metadata> {
  return getLegalPageMetadata("privacy");
}

export default async function PrivacyPage() {
  const copy = await getLegalPageCopy("privacy");

  // 共用页面结构内已为语言切换按钮提供所需文案。
  return <LegalPage activePath={PRIVACY_POLICY_PATH} copy={copy} />;
}
