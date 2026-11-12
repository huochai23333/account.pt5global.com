/**
 * 诊断只需要知道配置是否存在；保留实际值仅用于核对本地地址，绝不输出整个对象。
 * 不执行 .env 中的文本，不展开变量，不把它当作脚本加载。
 */
export function parseEnvironment(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(
      /^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/,
    );
    if (!match) continue;
    const raw = match[2];
    values[match[1]] = /^(["']).*\1$/.test(raw)
      ? raw.slice(1, -1)
      : raw.replace(/\s+#.*$/, "");
  }
  return values;
}

export function isLocalEndpoint(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "http:" &&
      !url.username &&
      !url.password &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

/** Auth健康响应不检查邮件链接；迁移本机端口后，其独立外部地址也必须指向当前项目。 */
export function isDeclaredLocalAuthUrl(value, apiPort) {
  return isDeclaredLocalAuthEndpoint(value, apiPort, "/auth/v1");
}

/** CLI为四类邮件分别配置完整验证地址；它们可能覆盖外部地址，不能只检查一个变量。 */
export function isDeclaredLocalAuthCallbackUrl(value, apiPort) {
  return isDeclaredLocalAuthEndpoint(value, apiPort, "/auth/v1/verify");
}

function isDeclaredLocalAuthEndpoint(value, apiPort, pathname) {
  try {
    const url = new URL(value);
    return isLocalEndpoint(value) && !!apiPort && url.port === String(apiPort) &&
      url.pathname === pathname && !url.search && !url.hash;
  } catch {
    return false;
  }
}

/** 数据库任务只认本项目网关；回环地址也必须使用本项目端口，避免误连同机其他项目。 */
export function isLocalJobEndpoint(value, apiPort) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" || url.username || url.password) return false;
    const projectGateway =
      url.hostname === "supabase_kong_pt5-dropshipping" && url.port === "8000";
    const hostGateway =
      url.hostname === "host.docker.internal" && !!apiPort && url.port === String(apiPort);
    const loopbackGateway = isLocalEndpoint(value) && !!apiPort && url.port === String(apiPort);
    return (
      (projectGateway || hostGateway || loopbackGateway) &&
      /^\/functions\/v1\/[a-z0-9-]+$/.test(url.pathname) &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

export function describeConfiguration(values) {
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  ];
  return required.map((name) => ({
    name,
    present: Boolean(values[name]),
    // 返回结构不允许包含配置值，即使后续直接 JSON.stringify 也不会泄露密钥。
  }));
}

/** npx 可能继承外层 npm 的 user-agent；实际执行包的版本比继承提示更可靠。 */
export function chooseNpmVersion(invokedVersion, userAgent) {
  return invokedVersion || userAgent?.match(/npm\/([^ ]+)/)?.[1] || null;
}

/** 只评价本次已复现的版本，未知/缺失值不能因为数值转换为零而误报健康。 */
export function hasKnownGatewayReuseRisk(version, pool) {
  return /^PostgREST 14\.(5|10)$/.test(version ?? "") && pool !== "0";
}
