import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import { BrandMark } from "@/components/brand/brand-mark";
import { ScopedIntlProvider } from "@/components/i18n/scoped-intl-provider";
import { LanguageToggle } from "@/components/i18n/language-toggle";
import { Surface } from "@/components/ui/surface";
import { StatusBadge } from "@/components/ui/status-badge";
import type { LegalPageCopy } from "@/lib/legal-content";
import { LEGAL_LINKS } from "@/lib/legal-routes";
import { cn } from "@/lib/utils";

type LegalPageProps = {
  activePath: string;
  copy: LegalPageCopy;
};

export function LegalPage({ activePath, copy }: LegalPageProps) {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-background px-4 py-6 text-content-strong sm:px-6 lg:px-10">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed top-0 left-0 h-[28rem] w-[28rem] max-w-full rounded-full bg-[var(--workspace-glow-blue)] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed right-0 bottom-0 h-[24rem] w-[24rem] max-w-full rounded-full bg-[var(--workspace-glow-green)] blur-3xl"
      />
      <div className="relative mx-auto flex w-full max-w-[1180px] flex-col gap-8">
        <header className="flex flex-col gap-5 py-2 sm:flex-row sm:items-center sm:justify-between">
          <Link
            className="inline-flex items-center gap-3 self-start text-primary transition-colors hover:text-brand-hover"
            href="/"
          >
            <BrandMark priority />
            <span>
              <span className="block text-lg font-bold">{copy.brandTitle}</span>
              <span className="font-label block text-[11px] text-content-subtle uppercase">
                {copy.brandSubtitle}
              </span>
            </span>
          </Link>

          <ScopedIntlProvider namespaces={["LanguageToggle"]}>
            <LanguageToggle />
          </ScopedIntlProvider>
        </header>

        <section className="grid gap-8 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
          <aside className="space-y-6 lg:sticky lg:top-8 lg:self-start">
            <Surface padding="spacious">
              <StatusBadge tone="info">
                <ShieldCheck className="size-3.5" />
                {copy.eyebrow}
              </StatusBadge>
              <h1 className="mt-6 text-3xl leading-tight font-bold tracking-[-0.035em] text-content-strong sm:text-4xl">
                {copy.title}
              </h1>
              <p className="mt-5 text-[15px] leading-7 text-content-muted">
                {copy.description}
              </p>
              <p className="mt-5 text-xs leading-6 text-content-subtle">
                {copy.lastUpdatedLabel}: {copy.lastUpdated}
              </p>
            </Surface>

            <Surface className="rounded-[24px]" padding={null}>
              <nav
                aria-label={copy.eyebrow}
                className="flex flex-wrap gap-3 p-3"
              >
                {LEGAL_LINKS.map((link) => (
                  <Link
                    key={link.key}
                    // 当前页除了视觉高亮，也需要让读屏器能识别。
                    aria-current={link.href === activePath ? "page" : undefined}
                    className={cn(
                      "inline-flex h-11 items-center justify-center rounded-full px-4 text-sm font-semibold transition-colors sm:h-10",
                      link.href === activePath
                        ? "bg-primary text-primary-foreground"
                        : "bg-surface-interactive text-primary hover:bg-status-info-soft",
                    )}
                    href={link.href}
                  >
                    {copy.nav[link.key]}
                  </Link>
                ))}
              </nav>
            </Surface>

            <Link
              className="inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-brand-hover"
              href="/"
            >
              <ArrowLeft className="size-4" />
              {copy.backHome}
            </Link>
          </aside>

          <article className="space-y-5">
            <Surface
              className="rounded-[24px] text-sm leading-7 text-content-muted"
              variant="inset"
            >
              {copy.draftNotice}
            </Surface>

            {copy.sections.map((section) => (
              <Surface key={section.title} padding="spacious">
                <h2 className="text-2xl font-bold text-content-strong">
                  {section.title}
                </h2>
                <div className="mt-5 space-y-4">
                  {section.items.map((item) => (
                    <p
                      key={item}
                      className="text-[15px] leading-8 text-content-muted"
                    >
                      {item}
                    </p>
                  ))}
                </div>
              </Surface>
            ))}
          </article>
        </section>
      </div>
    </main>
  );
}
