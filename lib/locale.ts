import { defaultLocale, localeCookieName, type Locale } from "@/i18n/config";

export type { Locale } from "@/i18n/config";

export type LocalizedValue<T = string> = {
  zh: T;
  en: T;
};

export const DEFAULT_LOCALE: Locale = defaultLocale;
export const LOCALE_COOKIE_NAME = localeCookieName;

export function normalizeLocale(value: string | null | undefined): Locale {
  return value === "en" ? "en" : DEFAULT_LOCALE;
}

/** 明确选择的 Cookie 优先；没有有效选择时，按浏览器语言权重寻找本项目支持的语言。 */
export function resolveRequestLocale(
  cookieLocale: string | null | undefined,
  acceptLanguage: string | null | undefined,
): Locale {
  if (cookieLocale === "zh" || cookieLocale === "en") {
    return cookieLocale;
  }

  const requestedLanguages = (acceptLanguage ?? "")
    .split(",")
    .map((item) => {
      const [language, qualityValue] = item.trim().split(";q=");
      const quality = qualityValue ? Number.parseFloat(qualityValue) : 1;

      return {
        language: language.toLowerCase(),
        quality: Number.isFinite(quality) ? quality : 0,
      };
    })
    .filter((item) => item.language && item.quality > 0)
    .sort((left, right) => right.quality - left.quality);

  for (const item of requestedLanguages) {
    if (item.language === "zh" || item.language.startsWith("zh-")) {
      return "zh";
    }

    if (item.language === "en" || item.language.startsWith("en-")) {
      return "en";
    }
  }

  return DEFAULT_LOCALE;
}

export function getDocumentLanguage(locale: Locale) {
  return locale === "en" ? "en" : "zh-CN";
}
