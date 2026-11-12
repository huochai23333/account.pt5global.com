// 这里只解码载荷以辅助浏览器导航，不验证签名；服务端授权必须走 Auth 验证和数据库当前权限。
export function readAuthClaimsFromAccessToken(accessToken: string | null | undefined) {
  if (!accessToken) {
    return null;
  }

  const [, payloadSegment] = accessToken.split(".");

  if (!payloadSegment) {
    return null;
  }

  try {
    const payload = decodeBase64Url(payloadSegment);
    const parsed = JSON.parse(payload);

    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = (4 - (normalized.length % 4)) % 4;
  const base64 = `${normalized}${"=".repeat(padding)}`;

  if (typeof atob === "function") {
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));

    return new TextDecoder().decode(bytes);
  }

  return Buffer.from(base64, "base64").toString("utf8");
}
