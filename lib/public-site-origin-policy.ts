export type PublicOriginResolution = { origin: string; reason: "missing" | "format" | "protocol" | "host" | "port" | null };

const LOCAL_HOST = /^(?:localhost|127\.0\.0\.1)$/;
const LOCAL_SUFFIX = /(?:^|\.)(?:localhost|local|localdomain|internal|lan|home|test|invalid|example)$|(?:^|\.)home\.arpa$/;

/** URL 会把缩写、十六进制 IP 归一化；校验解析后的 hostname，才能同时挡住这些写法。 */
function isPublicDomain(hostname: string) {
  return hostname.length <= 253 && hostname.includes(".") && !LOCAL_SUFFIX.test(hostname)
    && !/^[\d.]+$/.test(hostname) && !hostname.includes(":")
    && hostname.split(".").every((label) => /^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(label));
}

/** 地址策略保持纯函数，生产与本地使用同一规则，也能独立测试生产环境的输入。 */
export function resolveConfiguredPublicOrigin(value: string | undefined, defaultOrigin: string, production: boolean): PublicOriginResolution {
  const fallback = (reason: PublicOriginResolution["reason"]): PublicOriginResolution => ({ origin: defaultOrigin, reason });
  if (!value?.trim()) return fallback("missing");
  try {
    const url = new URL(value.trim());
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash || value.includes("\\")) return fallback("format");
    const local = LOCAL_HOST.test(url.hostname);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && !production && local)) return fallback("protocol");
    if (!isPublicDomain(url.hostname) && !(local && !production)) return fallback("host");
    // HTTPS 的显式 443 会被 URL 归一化为空；只有本机开发地址可以指定其他端口。
    if (url.port && (production || !local)) return fallback("port");
    return { origin: url.origin, reason: null };
  } catch { return fallback("format"); }
}

/** 云端永远采用配置地址；开发请求只允许配置域名、默认域名及两个明确的本机域名。 */
export function resolveRequestPublicOrigin(headers: Headers, configuredOrigin: string, defaultOrigin: string, production: boolean) {
  if (production) return configuredOrigin;
  const host = (headers.get("x-forwarded-host") ?? headers.get("host"))?.split(",")[0]?.trim().toLowerCase();
  if (!host || /[/?#@\\\s]/.test(host)) return configuredOrigin;
  if (/^(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(host)) {
    return resolveConfiguredPublicOrigin(`http://${host}`, configuredOrigin, false).origin;
  }
  for (const origin of [configuredOrigin, defaultOrigin]) {
    if (new URL(origin).host === host) return origin;
  }
  return configuredOrigin;
}
