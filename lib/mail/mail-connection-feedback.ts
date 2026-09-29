export const MAIL_CONNECTION_COOKIE = "pt5-mail-connection";

/** 页面只接受约定的结果名称，不能把第三方异常或任意网址文字直接展示给用户。 */
export type MailConnectionReason = "cancelled" | "incomplete" | "state" | "tokens" | "profile" | "account" | "scope" | "watch" | "save" | "unconfirmed" | "unavailable";
export type MailConnectionFeedback = {
  result: "success" | "failed" | "partial_failed";
  reason: MailConnectionReason;
};
export class MailConnectionError extends Error {
  constructor(readonly reason: MailConnectionReason) {
    super("公司邮箱连接未完成。");
  }
}
export function parseConnectionReason(value: unknown): MailConnectionReason {
  return ["cancelled", "incomplete", "state", "tokens", "profile", "account", "scope", "watch", "save", "unconfirmed"].includes(String(value))
    ? value as MailConnectionReason : "unavailable";
}
