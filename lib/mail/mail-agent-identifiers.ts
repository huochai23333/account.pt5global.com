type AgentIdentitySource = {
  userId: string;
  name: string | null;
  email: string | null;
};

function uuidToken(userId: string, length: number) {
  return userId.replaceAll("-", "").slice(0, length).toLowerCase().padEnd(length, "0");
}

/**
 * Gmail 加号别名只能使用稳定的 ASCII 字符。用户名称无法直接使用时回退到登录邮箱前缀，
 * 最后才使用用户 UUID，确保中文用户名也能在首次打开工作台时自动得到可用地址。
 */
export function createSuggestedMailAlias(source: AgentIdentitySource) {
  const normalize = (value: string | null) => (value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s_]+/g, ".")
    .replace(/[^a-z0-9.-]/g, "")
    .replace(/[.-]{2,}/g, ".")
    .replace(/^[.-]+|[.-]+$/g, "");
  const nameAlias = normalize(source.name);
  const emailAlias = normalize(source.email?.split("@")[0] ?? "");
  const base = nameAlias.length >= 2 ? nameAlias : emailAlias.length >= 2 ? emailAlias : `sales-${uuidToken(source.userId, 8)}`;
  return base.slice(0, 40).replace(/[.-]+$/g, "") || `sales-${uuidToken(source.userId, 8)}`;
}

/** Ref 前缀与别名保持可辨识关系，同时满足数据库 2–16 位大写字母数字限制。 */
export function createSuggestedRefPrefix(alias: string, userId: string) {
  const raw = alias.replace(/[^a-z0-9]/gi, "").toUpperCase();
  if (raw.length >= 2 && raw.length <= 16) return raw;
  if (raw.length > 16) return `${raw.slice(0, 11)}${uuidToken(userId, 4).toUpperCase()}`;
  return `SALES${uuidToken(userId, 4).toUpperCase()}`;
}

export function addStableAliasSuffix(alias: string, userId: string) {
  return `${alias.slice(0, 33).replace(/[.-]+$/g, "")}-${uuidToken(userId, 6)}`;
}

export function addStableRefSuffix(refPrefix: string, userId: string) {
  return `${refPrefix.slice(0, 11)}${uuidToken(userId, 4).toUpperCase()}`;
}
