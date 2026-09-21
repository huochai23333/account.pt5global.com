type MailEnv = {
  credentialKey: string;
  contentKey: string;
  emailHashSecret: string;
  sharedMailboxEmail: string;
  attachmentBucket: string;
  attachmentScannerUrl: string | null;
  siteUrl: string;
};

function requireHexKey(name: string) {
  const value = process.env[name]?.trim() ?? "";
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error(`${name} 必须是 64 位十六进制字符串。`);
  return value;
}

/** 邮件密钥只在服务端读取；任何变量都不能使用 NEXT_PUBLIC_ 前缀。 */
export function getMailEnv(): MailEnv {
  const emailHashSecret = process.env.MAIL_EMAIL_HASH_SECRET?.trim() ?? "";
  if (emailHashSecret.length < 32) throw new Error("MAIL_EMAIL_HASH_SECRET 至少需要 32 个字符。");
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
  return {
    credentialKey: requireHexKey("MAIL_CREDENTIAL_ENCRYPTION_KEY"),
    contentKey: requireHexKey("MAIL_CONTENT_ENCRYPTION_KEY"),
    emailHashSecret,
    sharedMailboxEmail: process.env.MAIL_SHARED_MAILBOX_EMAIL?.trim().toLowerCase() || "chinapt5@gmail.com",
    attachmentBucket: process.env.MAIL_ATTACHMENT_BUCKET?.trim() || "pt5-mail-attachments",
    attachmentScannerUrl: process.env.MAIL_ATTACHMENT_SCANNER_URL?.trim() || null,
    siteUrl: new URL(siteUrl).origin,
  };
}
