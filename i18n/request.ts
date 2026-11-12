import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { LOCALE_COOKIE_NAME, resolveRequestLocale } from "@/lib/locale";

export default getRequestConfig(async () => {
  // 请求优先使用用户已选的语言，再参考浏览器偏好；这里只在服务端加载整份字典。
  const [cookieStore, requestHeaders] = await Promise.all([
    cookies(),
    headers(),
  ]);
  const locale = resolveRequestLocale(
    cookieStore.get(LOCALE_COOKIE_NAME)?.value,
    requestHeaders.get("accept-language"),
  );

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
