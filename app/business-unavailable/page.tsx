import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";

import { PageReveal } from "@/components/motion/page-reveal";
import { buttonVariants } from "@/components/ui/button-variants";
import { PublicStateCard } from "@/components/ui/public-state-card";
import { companyConfig } from "@/lib/company-config";
import { normalizeLocale } from "@/lib/locale";
import { getServerAuthContext } from "@/lib/server-auth";
import { cn } from "@/lib/utils";

const SIGN_OUT_TO_LOGIN_PATH = "/auth/sign-out?next=%2Flogin";

export const metadata: Metadata = {
  title: "业务暂停服务",
};

type BusinessUnavailablePageProps = {
  searchParams: Promise<{ business?: string }>;
};

/**
 * 停用说明页位于工作台布局之外，因此不会加载侧栏、业务查询或 AI 助手。
 * 账号会话仍然保留，用户可以主动退出或通过帮助邮箱咨询。
 */
export default async function BusinessUnavailablePage({
  searchParams,
}: BusinessUnavailablePageProps) {
  const [{ business }, { role, status, userId }, localeValue] = await Promise.all([
    searchParams,
    getServerAuthContext(),
    getLocale(),
  ]);

  if (!userId || status !== "active") {
    redirect(SIGN_OUT_TO_LOGIN_PATH);
  }

  const locale = normalizeLocale(localeValue);
  const isTourismAddress = business === "tourism";
  const copy = getUnavailableCopy(locale, isTourismAddress);

  return (
    <PageReveal className="min-h-screen">
      <main className="flex min-h-screen items-center justify-center bg-background px-5 py-12 sm:px-6 sm:py-16">
        <PublicStateCard
          actions={
            <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:justify-center">
              {role !== "client" ? (
                <Link
                  className={cn(
                    buttonVariants({ size: "default", variant: "primary" }),
                    "min-w-0 whitespace-normal text-center",
                  )}
                  href="/email-reminders"
                >
                  {copy.emailReminders}
                </Link>
              ) : null}
              <a
                className={cn(
                  buttonVariants({ size: "default", variant: "primary" }),
                  "min-w-0 whitespace-normal text-center",
                )}
                href={`mailto:${companyConfig.supportEmail}`}
              >
                {copy.help}
              </a>
              <Link
                className={cn(
                  buttonVariants({ size: "default", variant: "secondary" }),
                  "min-w-0 whitespace-normal text-center",
                )}
                href={SIGN_OUT_TO_LOGIN_PATH}
              >
                {copy.signOut}
              </Link>
            </div>
          }
          badge={copy.badge}
          badgeTone="warning"
          description={copy.description}
          title={copy.title}
        />
      </main>
    </PageReveal>
  );
}

function getUnavailableCopy(locale: string, isTourismAddress: boolean) {
  if (locale === "en") {
    return {
      badge: "Service notice",
      description: isTourismAddress
        ? `Travel services are currently paused. Your previous records are kept safely. Contact ${companyConfig.supportEmail} if you need help.`
        : `Your account does not currently have an available service. Contact ${companyConfig.supportEmail} if you need help.`,
      help: "Email support",
      emailReminders: "Email reminders",
      signOut: "Sign out",
      title: isTourismAddress
        ? "Travel services are temporarily unavailable"
        : "No service is currently available for this account",
    };
  }

  return {
    badge: "服务说明",
    description: isTourismAddress
      ? `旅游业务目前暂停服务，你之前的记录会继续妥善保留。如需帮助，请联系 ${companyConfig.supportEmail}。`
      : `这个账号目前没有可使用的业务。如需帮助，请联系 ${companyConfig.supportEmail}。`,
    help: "联系帮助邮箱",
    emailReminders: "邮件提醒",
    signOut: "退出登录",
    title: isTourismAddress ? "旅游业务暂时停止服务" : "当前没有可使用的业务",
  };
}
