/** 从明确的 [api] 段读取端口，不能误取 [db] 或其他项目的端口。 */
export function readDeclaredApiPort(config) {
  const section = config.match(/(?:^|\r?\n)\[api\][ \t]*\r?\n([\s\S]*?)(?=\r?\n\[|$)/)?.[1];
  const value = section?.match(/^\s*port\s*=\s*(\d+)\s*(?:#.*)?$/m)?.[1];
  const port = Number(value);
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? String(port) : null;
}

/** 本机夹具必须与同级仓库声明的 API 原点一致；不保留旧端口的放行分支。 */
export function isDeclaredLocalApi(value, declaredPort) {
  try {
    const url = new URL(value);
    return !!declaredPort && url.protocol === "http:" && !url.username && !url.password
      && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      && url.port === String(declaredPort) && url.pathname === "/" && !url.search && !url.hash;
  } catch { return false; }
}
