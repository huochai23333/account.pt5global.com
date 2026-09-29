export type FeishuConnectionReason = "cancelled" | "incomplete" | "state" | "unavailable";

export class FeishuConnectionError extends Error {
  readonly reason: FeishuConnectionReason;
  constructor(reason: FeishuConnectionReason) { super("飞书绑定未完成。"); this.reason = reason; }
}

/** 查询参数只是失败提示；成功始终由真实绑定记录判断，不能由网址宣称成功。 */
export function getFeishuConnectionFeedback(params: Record<string, string | string[] | undefined>): FeishuConnectionReason | null {
  if (params.feishuConnection !== "failed") return null;
  const reason = params.feishuReason;
  return typeof reason === "string" && ["cancelled", "incomplete", "state"].includes(reason)
    ? reason as FeishuConnectionReason : "unavailable";
}
