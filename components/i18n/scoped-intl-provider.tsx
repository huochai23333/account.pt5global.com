import type { ReactNode } from "react";

import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";

import { getScopedMessages } from "@/lib/i18n-messages";
import type { Locale } from "@/lib/locale";

type ScopedIntlProviderProps = {
  children: ReactNode;
  namespaces: readonly string[];
};

export async function ScopedIntlProvider({
  children,
  namespaces,
}: ScopedIntlProviderProps) {
  const locale = (await getLocale()) as Locale;
  // 分页、日期和共享界面文案都随局部提供器一起加载，页面只需声明自己的领域文案。
  // 新增分页的目录无需逐个补命名空间，英语和中文也会使用相同的底栏结构。
  const scopedNamespaces = Array.from(
    new Set([...namespaces, "DashboardFramework", "DashboardPagination", "DatePicker", "UiText"]),
  );
  const messages = await getScopedMessages(locale, scopedNamespaces);

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
