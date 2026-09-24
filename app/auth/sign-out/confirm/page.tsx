import { getLocale } from "next-intl/server";

import { PageReveal } from "@/components/motion/page-reveal";
import { buttonVariants } from "@/components/ui/button-variants";
import { PublicStateCard } from "@/components/ui/public-state-card";
import { PostActionForm } from "@/components/ui/post-action-form";
import { normalizeLocale } from "@/lib/locale";

type SignOutConfirmPageProps = { searchParams: Promise<{ next?: string }> };

/** 旧书签或失效会话到达这里时，只展示可选择的退出动作，不在 GET 请求中改写会话。 */
export default async function SignOutConfirmPage({ searchParams }: SignOutConfirmPageProps) {
  const [{ next }, localeValue] = await Promise.all([searchParams, getLocale()]);
  const english = normalizeLocale(localeValue) === "en";
  const action = `/auth/sign-out?next=${encodeURIComponent(next ?? "/login")}`;
  return (
    <PageReveal className="min-h-screen">
      <main className="flex min-h-screen items-center justify-center bg-background px-5 py-12">
        <PublicStateCard
          badge={english ? "Account" : "账号"}
          title={english ? "Sign out of this account?" : "要退出当前账号吗？"}
          description={english ? "You can sign in again afterwards." : "退出后可以重新登录。"}
          actions={
            <PostActionForm action={action} buttonClassName={buttonVariants({ size: "default", variant: "primary" })}>
              {english ? "Sign out" : "退出登录"}
            </PostActionForm>
          }
        />
      </main>
    </PageReveal>
  );
}
