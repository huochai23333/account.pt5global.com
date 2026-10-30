import type { ReactNode } from "react";

import { AuthRouteLink } from "@/components/auth/auth-route-link";
import { BrandMark } from "@/components/brand/brand-mark";
import { LanguageToggle } from "@/components/i18n/language-toggle";
import { LegalFooterLinks } from "@/components/legal/legal-footer-links";
import type { AuthShellCopy } from "@/lib/auth-shell-content";

import { AuthSupplementalNote } from "./auth-supplemental-note";
import type {
  AuthFooterContent,
  AuthFormContent,
  AuthHeroContent,
  AuthShellMode,
} from "./auth-shell-types";

/** 表单面板统一品牌头、标题、移动说明和页脚，children 只承接具体认证表单。 */
export function AuthFormPanel({
  children,
  copy,
  footer,
  form,
  hero,
  mode,
}: {
  children: ReactNode;
  copy: AuthShellCopy;
  footer: AuthFooterContent;
  form: AuthFormContent;
  hero: AuthHeroContent;
  mode: AuthShellMode;
}) {
  return (
    <section
      className="auth-form-surface relative flex min-h-[760px] min-w-0 flex-col"
      data-auth-region="form"
    >
      <div className="mx-auto flex min-w-0 w-full max-w-[580px] flex-1 flex-col px-6 py-8 sm:px-10 lg:px-14 lg:py-16">
        {/* 极窄屏允许语言按钮换到下一行，避免品牌名称被挤成单字竖排。 */}
        <div className="mb-10 flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3 lg:hidden">
            <BrandMark priority />
            <div className="min-w-0 space-y-0.5">
              <p className="break-words text-xl font-bold tracking-tight text-primary [overflow-wrap:anywhere]">
                {copy.brandTitle}
              </p>
              <p className="font-label break-words text-[11px] tracking-[0.2em] text-content-subtle uppercase [overflow-wrap:anywhere]">
                {copy.brandSubtitle}
              </p>
            </div>
          </div>
          <div className="ml-auto"><LanguageToggle /></div>
        </div>

        <header className="mb-10 space-y-3">
          <p className="font-label text-[11px] font-semibold tracking-[0.22em] text-content-muted uppercase">
            {form.eyebrow ?? copy.secureAccess}
          </p>
          <h2 className="text-[40px] leading-[1.08] font-bold tracking-[-0.04em] text-content-strong sm:text-[46px]">
            {form.title}
          </h2>
          {form.description ? (
            <p className="max-w-[420px] text-[15px] leading-7 text-content-muted">
              {form.description}
            </p>
          ) : null}
        </header>

        <div className="flex-1">{children}</div>
        <AuthSupplementalNote
          note={hero.compactNote ?? hero.note}
          tone={mode === "register" ? "info" : "neutral"}
        />

        <div className="border-t border-border pt-8 text-center">
          <p className="text-sm text-content-muted">
            {footer.prompt}{" "}
            <AuthRouteLink
              className="font-semibold text-primary transition-colors hover:text-brand-hover"
              href={footer.linkHref}
            >
              {footer.linkLabel}
            </AuthRouteLink>
          </p>
        </div>

        <div className="mt-auto flex flex-col gap-4 pt-12 text-xs text-content-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>{copy.copyright}</p>
          <LegalFooterLinks className="justify-center sm:justify-end" copy={copy} />
        </div>
      </div>
    </section>
  );
}
