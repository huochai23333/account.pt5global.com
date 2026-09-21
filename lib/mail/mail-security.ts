import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";

const ENCRYPTION_VERSION = "v1";

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

/** 可检索隐私字段只保存不可逆盲索引，数据库中不会出现客户邮箱明文索引。 */
export function createBlindIndex(value: string, secret: string) {
  if (secret.length < 32) throw new Error("邮件索引密钥至少需要 32 个字符。");
  return createHmac("sha256", secret).update(value.trim().toLowerCase()).digest("hex");
}

function parseEncryptionKey(keyHex: string) {
  if (!/^[a-f0-9]{64}$/i.test(keyHex)) throw new Error("邮件加密密钥必须是 64 位十六进制字符串。");
  return Buffer.from(keyHex, "hex");
}

/** 使用 AES-256-GCM 加密邮件内容，同时保存认证标签以检测密文篡改。 */
export function encryptMailValue(value: string, keyHex: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", parseEncryptionKey(keyHex), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [
    ENCRYPTION_VERSION,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(":");
}

export function decryptMailValue(value: string, keyHex: string) {
  const [version, ivValue, tagValue, ciphertextValue] = value.split(":");
  if (version !== ENCRYPTION_VERSION || !ivValue || !tagValue || !ciphertextValue) {
    throw new Error("无法识别邮件密文格式。");
  }
  const decipher = createDecipheriv("aes-256-gcm", parseEncryptionKey(keyHex), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function maskEmail(email: string) {
  const [local = "", domain = ""] = email.split("@");
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(3, local.length - visible.length))}@${domain}`;
}
