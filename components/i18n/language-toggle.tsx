"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { useRouter } from "next/navigation";
import { Check, ChevronDown, Languages, LoaderCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  getDocumentLanguage,
  LOCALE_COOKIE_NAME,
  type Locale,
} from "@/lib/locale";
import { useStaleFocusRecovery } from "@/lib/use-stale-focus-recovery";

export function LanguageToggle() {
  const router = useRouter();
  const shouldUseFullPageLoad = useStaleFocusRecovery();
  const locale = useLocale() as Locale;
  const t = useTranslations("LanguageToggle");
  const [isPending, startTransition] = useTransition();
  const [switchingLocale, setSwitchingLocale] = useState<Locale | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const activeSwitchingLocale =
    switchingLocale && switchingLocale !== locale ? switchingLocale : null;
  const isSwitching = Boolean(activeSwitchingLocale) || isPending;

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (
        mobileMenuRef.current &&
        event.target instanceof Node &&
        !mobileMenuRef.current.contains(event.target)
      ) {
        setMobileMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileMenuOpen]);

  const handleSwitch = (nextLocale: Locale) => {
    if (nextLocale === locale || isSwitching) {
      return;
    }

    setMobileMenuOpen(false);
    setSwitchingLocale(nextLocale);
    persistLocalePreference(nextLocale);

    if (shouldUseFullPageLoad()) {
      window.location.reload();
      return;
    }

    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <>
      <div
        ref={mobileMenuRef}
        className="relative sm:hidden"
      >
        <Button
          aria-expanded={mobileMenuOpen}
          aria-haspopup="menu"
          aria-label={t("open")}
          className="min-w-11 gap-1.5 rounded-full px-2.5"
          disabled={isSwitching}
          onClick={() => setMobileMenuOpen((current) => !current)}
          size="default"
          type="button"
          variant="outline"
        >
          {isSwitching ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <Languages className="size-4" />
          )}
          <span className="text-xs font-semibold">{t(locale)}</span>
          <ChevronDown
            className={`size-3.5 transition-transform ${
              mobileMenuOpen ? "rotate-180" : "rotate-0"
            }`}
          />
        </Button>

        <AnimatePresence>
          {mobileMenuOpen ? (
            // 语言菜单会覆盖系统标题和导航；不透底才能让选项始终清楚可读。
            <motion.div
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="absolute right-0 top-[calc(100%+0.5rem)] z-40 w-36 origin-top-right rounded-control-large border border-border-subtle bg-surface-inset p-2 shadow-surface-floating"
              exit={{ opacity: 0, scale: 0.985, y: -4 }}
              initial={{ opacity: 0, scale: 0.985, y: -4 }}
              role="menu"
            >
              {(["zh", "en"] as const).map((itemLocale) => (
                <Button
                  className="w-full justify-between"
                  disabled={isSwitching}
                  key={itemLocale}
                  onClick={() => handleSwitch(itemLocale)}
                  role="menuitemradio"
                  aria-checked={locale === itemLocale}
                  size="default"
                  type="button"
                  variant="ghost"
                >
                  {t(itemLocale)}
                  {locale === itemLocale ? <Check className="size-4" /> : null}
                </Button>
              ))}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <div
        aria-busy={isSwitching}
        aria-live="polite"
        className="hidden items-center gap-1 rounded-full border border-border-subtle bg-white/70 p-1 shadow-[var(--surface-shadow-interactive)] backdrop-blur sm:inline-flex"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full text-primary">
          {isSwitching ? (
            <LoaderCircle className="size-4.5 animate-spin" />
          ) : (
            <Languages className="size-4.5" />
          )}
        </span>
        <Button
          className="min-w-14 rounded-full px-3"
          disabled={isSwitching}
          onClick={() => handleSwitch("zh")}
          size="compact"
          type="button"
          variant={locale === "zh" ? "primary" : "ghost"}
        >
          {activeSwitchingLocale === "zh" ? (
            <>
              <LoaderCircle className="size-3.5 animate-spin" />
              {t("switching")}
            </>
          ) : (
            t("zh")
          )}
        </Button>
        <Button
          className="min-w-14 rounded-full px-3"
          disabled={isSwitching}
          onClick={() => handleSwitch("en")}
          size="compact"
          type="button"
          variant={locale === "en" ? "primary" : "ghost"}
        >
          {activeSwitchingLocale === "en" ? (
            <>
              <LoaderCircle className="size-3.5 animate-spin" />
              {t("switching")}
            </>
          ) : (
            t("en")
          )}
        </Button>
      </div>

      <AnimatePresence>
        {isSwitching ? (
          <motion.div
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex cursor-wait items-start justify-end bg-transparent p-4 sm:p-6"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
          >
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-border-subtle bg-white/80 px-4 text-sm font-semibold text-primary shadow-[var(--surface-shadow-interactive)] backdrop-blur"
              exit={{ opacity: 0, y: -6 }}
              initial={{ opacity: 0, y: -6 }}
              role="status"
            >
              <LoaderCircle className="size-4 animate-spin" />
              {t("switching")}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

/**
 * 语言偏好需要同时写入服务端可读 Cookie、浏览器本地存储和当前文档语言。
 * 把浏览器对象的修改集中在事件辅助函数中，组件渲染本身仍保持为纯计算。
 */
function persistLocalePreference(nextLocale: Locale) {
  document.cookie = `${LOCALE_COOKIE_NAME}=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax`;
  window.localStorage.setItem(LOCALE_COOKIE_NAME, nextLocale);
  document.documentElement.lang = getDocumentLanguage(nextLocale);
}
