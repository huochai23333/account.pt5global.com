type ProfileWriteExpectation = {
  city: string;
  name?: string;
  userId: string;
};

type ProfileRequestExpectation = {
  city?: string;
  name?: string;
  requestId?: string;
  status: "approved" | "pending" | "rejected";
};

/** 资料表写入必须返回同一用户和提交后的字段，空回执就是 0 行更新。 */
export function requireProfileWriteReceipt(
  value: unknown,
  expected: ProfileWriteExpectation,
) {
  const receipt = requireRecord(value, "个人资料没有返回可确认的保存结果。");
  if (
    receipt.user_id !== expected.userId ||
    receipt.city !== expected.city ||
    (expected.name !== undefined && receipt.name !== expected.name)
  ) {
    throw new Error("个人资料保存结果与提交内容不一致。");
  }
}

/** 资料修改申请和管理员审核必须返回同一申请、目标状态及提交内容。 */
export function requireProfileRequestReceipt(
  value: unknown,
  expected: ProfileRequestExpectation,
) {
  const receipt = requireRecord(value, "资料修改没有返回可确认的处理结果。");
  if (
    typeof receipt.id !== "string" ||
    !receipt.id ||
    receipt.status !== expected.status ||
    (expected.requestId !== undefined && receipt.id !== expected.requestId) ||
    (expected.name !== undefined && receipt.requested_name !== expected.name) ||
    (expected.city !== undefined && receipt.requested_city !== expected.city)
  ) {
    throw new Error("资料修改处理结果与当前操作不一致。");
  }
}

function requireRecord(value: unknown, message: string) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(message);
  }
  return value as Record<string, unknown>;
}
