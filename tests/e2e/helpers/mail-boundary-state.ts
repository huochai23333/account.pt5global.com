/** 仅保存当前串行用例的模拟凭证；快照和入站入参均克隆，避免断言修改服务内部状态。 */
type SentReceipt = {
  messageId: string;
  threadId: string;
  verifiedInSent: boolean;
  raw: string;
};
export type InboundMessage = {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  attachment?: {
    id: string;
    filename: string;
    contentType: string;
    content: string;
  };
};

export const mailBoundaryState: {
  sent: SentReceipt[];
  inbound: InboundMessage[];
  attachmentFetches: number;
  feishuMessageIds: string[];
} = {
  sent: [],
  inbound: [],
  attachmentFetches: 0,
  feishuMessageIds: [],
};

export function resetMailBoundaryState() {
  mailBoundaryState.sent = [];
  mailBoundaryState.inbound = [];
  mailBoundaryState.attachmentFetches = 0;
  mailBoundaryState.feishuMessageIds = [];
}

export function getMailBoundaryState() {
  return structuredClone(mailBoundaryState);
}

/** 测试把客户来信放入 Gmail 假边界，真实 Worker 仍会负责同步、路由和最终落库。 */
export function queueMailBoundaryInbound(message: InboundMessage) {
  mailBoundaryState.inbound.push(structuredClone(message));
  return String(100 + mailBoundaryState.inbound.length);
}
