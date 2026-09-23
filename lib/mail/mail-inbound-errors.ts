export type UnsupportedInboundReason =
  | "attachment_too_large"
  | "too_many_attachments"
  | "attachments_too_large"
  | "blocked_attachment"
  | "missing_sender";

/** 输入本身无法通过重试改变；worker 应记录终态并继续处理同批其他来信。 */
export class UnsupportedInboundMessageError extends Error {
  constructor(public readonly reason: UnsupportedInboundReason) {
    super("这封来信的内容无法导入工作台。");
    this.name = "UnsupportedInboundMessageError";
  }
}
