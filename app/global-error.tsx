/** 根布局也出错时，使用独立文案和完整 html/body 提供重试入口，避免依赖已经失败的页面 Provider。 */
"use client";

import { useEffect, useState } from "react";

import "./root.css";

import { MotionSystemProvider } from "@/components/motion/motion-system-provider";
import { PageReveal } from "@/components/motion/page-reveal";
import { Button } from "@/components/ui/button";
import { PublicStateCard } from "@/components/ui/public-state-card";
import { DEFAULT_LOCALE, getDocumentLanguage, normalizeLocale, type Locale } from "@/lib/locale";

type GlobalErrorPageProps = {
  error: Error & {
    digest?: string;
  };
  reset: () => void;
};

const GLOBAL_ERROR_COPY = {
  zh: {
    badge: "\u5168\u5c40\u9519\u8bef",
    title: "\u9875\u9762\u51fa\u73b0\u5f02\u5e38",
    description:
      "\u53ef\u4ee5\u5148\u91cd\u8bd5\u4e00\u6b21\uff1b\u5982\u679c\u95ee\u9898\u4ecd\u7136\u5b58\u5728\uff0c\u8bf7\u5237\u65b0\u9875\u9762\u540e\u518d\u8fd4\u56de\u5f53\u524d\u9875\u9762\u3002",
    retry: "\u91cd\u8bd5",
    reload: "\u5237\u65b0\u9875\u9762",
  },
  en: {
    badge: "Global Error",
    title: "Something went wrong",
    description:
      "Try again first. If the problem persists, reload the page and return to this view.",
    retry: "Try again",
    reload: "Reload",
  },
} as const satisfies Record<
  Locale,
  {
    badge: string;
    title: string;
    description: string;
    retry: string;
    reload: string;
  }
>;

export default function GlobalError({ error, reset }: GlobalErrorPageProps) {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    console.error(error);
  }, [error]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setLocale(getPreferredGlobalErrorLocale());
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  const copy = GLOBAL_ERROR_COPY[locale];

  return (
    <html lang={getDocumentLanguage(locale)}>
      <body className="min-h-screen bg-background">
        <MotionSystemProvider>
          <PageReveal className="min-h-screen">
            <main className="flex min-h-screen items-center justify-center px-6 py-16">
              <PublicStateCard
                actions={
                  <>
                    <Button onClick={() => reset()}>{copy.retry}</Button>
                    <Button onClick={() => window.location.reload()} variant="outline">
                      {copy.reload}
                    </Button>
                  </>
                }
                badge={copy.badge}
                description={copy.description}
                title={copy.title}
              />
            </main>
          </PageReveal>
        </MotionSystemProvider>
      </body>
    </html>
  );
}

function getPreferredGlobalErrorLocale(): Locale {
  if (typeof document !== "undefined") {
    const documentLanguage = document.documentElement.lang.trim().toLowerCase();

    if (documentLanguage.length > 0) {
      return normalizeLocale(documentLanguage.startsWith("en") ? "en" : "zh");
    }
  }

  if (typeof navigator !== "undefined") {
    return normalizeLocale(navigator.language.toLowerCase().startsWith("en") ? "en" : "zh");
  }

  return DEFAULT_LOCALE;
}
